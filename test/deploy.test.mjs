import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deploy} from '../scripts/deploy-aws.mjs';

async function fixture({failUpdate=false,stackStatus='UPDATE_COMPLETE'}={}) {
  const dir=await mkdtemp(join(tmpdir(),'health-deploy-test-')),site=join(dir,'site'),jar=join(dir,'api.jar');
  await mkdir(site);await writeFile(join(site,'index.html'),'<html>new website</html>');await writeFile(jar,'fake-jar');
  const calls=[],env={GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',AWS_STACK_NAME:'health-habits',AWS_ARTIFACT_BUCKET:'pcmckenna-health',AWS_REGION:'us-east-1'};
  const values={ApiFunctionName:'habits-api',WebsiteBucket:'habits-website',DistributionId:'DIST123',ApiUrl:'https://api.example',WebsiteUrl:'https://site.example',ClientId:'client123',Region:'us-east-1'};
  const invokeAws=(...args)=> {
    calls.push(args);
    if(args[0]==='cloudformation') return JSON.stringify({Stacks:[{StackStatus:stackStatus,Parameters:[{ParameterKey:'ArtifactBucket',ParameterValue:'pcmckenna-health'}],Outputs:Object.entries(values).map(([OutputKey,OutputValue])=>({OutputKey,OutputValue}))}]});
    if(args[1]==='get-function') return JSON.stringify({Code:{Location:'https://code.example'},Configuration:{RevisionId:'old-revision'}});
    if(args[1]==='get-function-configuration') return JSON.stringify({RevisionId:'new-revision'});
    if(args[1]==='update-function-code' && failUpdate && args.includes(`releases/${env.GITHUB_SHA}/123-1/api.jar`)) throw new Error('Simulated update failure');
    if(args[1]==='create-invalidation') return JSON.stringify({Invalidation:{Id:'INVALIDATION123'}});
    return '{}';
  };
  const fetchHttp=async url=> {
    if(url==='https://code.example') return new Response('previous-jar');
    if(url.startsWith('https://api.example/entries')) return Response.json({entries:{}});
    if(url==='https://site.example') return new Response('<html>new website</html>');
    throw new Error('Unexpected network request');
  };
  return {env,invokeAws,fetchHttp,jar,site,calls};
}

test('successful deployment backs up code and publishes index after assets',async()=> {
  const f=await fixture();await deploy(f);
  const backup=f.calls.findIndex(a=>a[1]==='put-object' && a.includes(`releases/${f.env.GITHUB_SHA}/123-1/previous-api.jar`));
  const update=f.calls.findIndex(a=>a[1]==='update-function-code');
  const assets=f.calls.findIndex(a=>a[1]==='sync');
  const index=f.calls.findIndex(a=>a.includes('s3://habits-website/index.html'));
  assert.ok(backup<update && update<assets && assets<index);
  assert.ok(!f.calls.some(a=>a.includes('--delete')));
  assert.deepEqual(JSON.parse(await readFile(join(f.site,'config.json'),'utf8')),{apiUrl:'https://api.example',region:'us-east-1',clientId:'client123'});
});
test('failed backend update restores baseline and leaves website untouched',async()=> {
  const f=await fixture({failUpdate:true});await assert.rejects(deploy(f),/Simulated update failure/);
  assert.ok(f.calls.some(a=>a[1]==='update-function-code' && a.includes(`releases/${f.env.GITHUB_SHA}/123-1/previous-api.jar`)));
  assert.ok(!f.calls.some(a=>a[1]==='sync'));
});
test('an in-progress stack operation prevents any deployment writes',async()=> {
  const f=await fixture({stackStatus:'UPDATE_IN_PROGRESS'});await assert.rejects(deploy(f),/Wait for the AWS stack/);
  assert.deepEqual(f.calls.map(a=>a[0]),['cloudformation']);
});
test('wrong deployment target is rejected before contacting AWS',async()=> {
  const f=await fixture();f.env.AWS_ARTIFACT_BUCKET='wrong-bucket';await assert.rejects(deploy(f),/Unexpected deployment target/);assert.equal(f.calls.length,0);
});
