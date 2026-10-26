import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

function runAws(...args) {
  return execFileSync('aws',[...args,'--no-cli-pager','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
}
function requireOutput(outputs,key) {
  const value=outputs.find(o=>o.OutputKey===key)?.OutputValue;
  if(!value) throw new Error(`Missing stack output ${key}; update the stack using aws/template.json first`);
  return value;
}
async function checkApi(apiUrl,fetchHttp) {
  for(let attempt=0;attempt<5;attempt++) {
    try {
      const response=await fetchHttp(`${apiUrl}/health`,{signal:AbortSignal.timeout(30000)});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const body=await response.json();
      if(body.status!=='ok') throw new Error('Invalid API response');
      return;
    } catch(error) {
      if(attempt===4) throw new Error(`API smoke check failed: ${error.message}`);
      await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));
    }
  }
}

export async function deploy({env=process.env,invokeAws=runAws,fetchHttp=fetch,
  jar='backend/target/health-habits-api-1.0.0-lambda.jar',site='frontend/dist/health-habits/browser'}={}) {
const aws=invokeAws,json=(...args)=>JSON.parse(aws(...args));
const sha=env.GITHUB_SHA,run=env.GITHUB_RUN_ID,attempt=env.GITHUB_RUN_ATTEMPT;
if(!/^[a-f0-9]{40}$/.test(sha??'') || !/^\d+$/.test(run??'') || !/^\d+$/.test(attempt??'')) throw new Error('This deployment must run in GitHub Actions');
const stack=env.AWS_STACK_NAME,bucket=env.AWS_ARTIFACT_BUCKET;
if(stack!=='health-habits' || bucket!=='pcmckenna-health' || env.AWS_REGION!=='us-east-1') throw new Error('Unexpected deployment target');
const description=json('cloudformation','describe-stacks','--stack-name',stack).Stacks[0];
if(!['CREATE_COMPLETE','UPDATE_COMPLETE','UPDATE_ROLLBACK_COMPLETE'].includes(description.StackStatus)) throw new Error('Wait for the AWS stack operation to finish before deploying');
if(description.Parameters.find(p=>p.ParameterKey==='ArtifactBucket')?.ParameterValue!==bucket) throw new Error('Artifact bucket does not match the AWS stack');
const outputs=description.Outputs;
if(requireOutput(outputs,'RecordsMode')!=='per-user-v1')throw new Error('Update the stack for per-user records before deploying');
if(!description.Parameters.find(p=>p.ParameterKey==='LegacyLogOwnerSub')?.ParameterValue)throw new Error('Set LegacyLogOwnerSub to preserve the existing log under its owner account before deploying');
const functionName=requireOutput(outputs,'ApiFunctionName'),websiteBucket=requireOutput(outputs,'WebsiteBucket');
const distribution=requireOutput(outputs,'DistributionId'),apiUrl=requireOutput(outputs,'ApiUrl');
const websiteUrl=requireOutput(outputs,'WebsiteUrl'),clientId=requireOutput(outputs,'ClientId');
const region=requireOutput(outputs,'Region');
if(region!=='us-east-1') throw new Error('Unexpected stack region');
await stat(jar);await stat(join(site,'index.html'));await stat(join(site,'sw.js'));
// Generate the website configuration from the actual AWS outputs on every deployment.
await writeFile(join(site,'config.json'),JSON.stringify({apiUrl,region,clientId,passkeys:outputs.find(o=>o.OutputKey==='PasskeysEnabled')?.OutputValue==='true'},null,2)+'\n');
const release=`releases/${sha}/${run}-${attempt}`;
const artifactKey=`${release}/api.jar`,baselineKey=`${release}/previous-api.jar`;
const temp=await mkdtemp(join(tmpdir(),'health-deploy-'));
const previous=json('lambda','get-function','--function-name',functionName);
const oldCode=await fetchHttp(previous.Code.Location,{signal:AbortSignal.timeout(60000)});
if(!oldCode.ok) throw new Error('Could not back up current Lambda code');
const baseline=join(temp,'previous-api.jar');
await writeFile(baseline,Buffer.from(await oldCode.arrayBuffer()));
// Back up the currently deployed code before changing anything live.
aws('s3api','put-object','--bucket',bucket,'--key',baselineKey,'--body',baseline,'--server-side-encryption','AES256');
aws('s3api','put-object','--bucket',bucket,'--key',artifactKey,'--body',jar,'--server-side-encryption','AES256');
let backendChanged=false,websiteStarted=false;
try {
  backendChanged=true;
  json('lambda','update-function-code','--function-name',functionName,'--s3-bucket',bucket,'--s3-key',artifactKey,'--revision-id',previous.Configuration.RevisionId);
  aws('lambda','wait','function-updated-v2','--function-name',functionName);
  await checkApi(apiUrl,fetchHttp);
  websiteStarted=true;
  // Upload new hashed assets first, retaining old assets for already-open browsers.
  aws('s3','sync',site,`s3://${websiteBucket}/`,'--exclude','index.html','--exclude','config.json','--exclude','sw.js','--exclude','manifest.webmanifest','--cache-control','public,max-age=31536000,immutable');
  aws('s3','cp',join(site,'config.json'),`s3://${websiteBucket}/config.json`,'--content-type','application/json','--cache-control','no-cache');
  aws('s3','cp',join(site,'index.html'),`s3://${websiteBucket}/index.html`,'--content-type','text/html','--cache-control','no-cache');
  aws('s3','cp',join(site,'manifest.webmanifest'),`s3://${websiteBucket}/manifest.webmanifest`,'--content-type','application/manifest+json','--cache-control','no-cache');
  aws('s3','cp',join(site,'sw.js'),`s3://${websiteBucket}/sw.js`,'--content-type','application/javascript','--cache-control','no-cache');
  const invalidation=json('cloudfront','create-invalidation','--distribution-id',distribution,'--paths','/*');
  aws('cloudfront','wait','invalidation-completed','--distribution-id',distribution,'--id',invalidation.Invalidation.Id);
  const response=await fetchHttp(websiteUrl,{signal:AbortSignal.timeout(30000),cache:'no-store'});
  if(!response.ok || (await response.text())!==await readFile(join(site,'index.html'),'utf8')) throw new Error('Website verification failed after cache invalidation');
  const manifest={commit:sha,artifactKey,baselineKey,functionName,websiteBucket,distribution,deployedAt:new Date().toISOString()};
  const manifestFile=join(temp,'deployment.json');await writeFile(manifestFile,JSON.stringify(manifest,null,2));
  aws('s3api','put-object','--bucket',bucket,'--key',`${release}/deployment.json`,'--body',manifestFile,'--server-side-encryption','AES256');
  if(env.GITHUB_STEP_SUMMARY) await writeFile(env.GITHUB_STEP_SUMMARY,`Deployed commit \`${sha}\` to [the health tracker](${websiteUrl}).\n\nAPI artifact: \`${artifactKey}\`.\n`,{flag:'a'});
  console.log('API and website deployment verified.');
} catch(error) {
  if(backendChanged && !websiteStarted) {
    console.error('Backend verification failed; restoring the previous Lambda code.');
    aws('lambda','wait','function-updated-v2','--function-name',functionName);
    const current=json('lambda','get-function-configuration','--function-name',functionName);
    json('lambda','update-function-code','--function-name',functionName,'--s3-bucket',bucket,'--s3-key',baselineKey,'--revision-id',current.RevisionId);
    aws('lambda','wait','function-updated-v2','--function-name',functionName);
  }
  throw error;
}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await deploy();
