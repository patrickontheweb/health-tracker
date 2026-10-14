import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {infrastructure,checkChanges,previousParameters} from '../scripts/infrastructure-aws.mjs';

async function fixture(){
  const sha='a'.repeat(40),code=Buffer.from('current deployed code'),codeSha=createHash('sha256').update(code).digest('base64'),role='arn:aws:iam::572526126850:role/health-habits-CloudFormationRole-test';
  const directory=await mkdtemp(join(tmpdir(),'infra-test-')),templatePath=join(directory,'template.json');
  await writeFile(templatePath,JSON.stringify({Parameters:{ArtifactBucket:{Type:'String'},ArtifactKey:{Type:'String'},CustomDomainName:{Type:'String'},NewDefault:{Type:'String',Default:''}}}));
  const env={GITHUB_SHA:sha,GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',AWS_STACK_NAME:'health-habits',AWS_REGION:'us-east-1',AWS_ARTIFACT_BUCKET:'pcmckenna-health',INFRA_OPERATION:'preview'};
  const calls=[],stack={StackId:'stack-id',StackStatus:'UPDATE_COMPLETE',Parameters:[{ParameterKey:'ArtifactBucket',ParameterValue:'pcmckenna-health'},{ParameterKey:'ArtifactKey',ParameterValue:'old.jar'},{ParameterKey:'CustomDomainName',ParameterValue:'lifestylerx.org'}],Outputs:[{OutputKey:'CloudFormationRoleArn',OutputValue:role},{OutputKey:'ApiFunctionName',OutputValue:'function-name'}]};
  const plan={StackId:'stack-id',RoleARN:role,Status:'CREATE_COMPLETE',ExecutionStatus:'AVAILABLE',Description:JSON.stringify({commit:sha,codeSha}),Changes:[{ResourceChange:{Action:'Modify',LogicalResourceId:'Website',ResourceType:'AWS::CloudFront::Distribution',Replacement:'False'}}]};
  const live={Configuration:{CodeSha256:codeSha},Code:{Location:'https://signed.example/package'}};
  const aws=(...args)=>{calls.push(args);if(args[1]==='describe-stacks')return JSON.stringify({Stacks:[stack]});if(args[1]==='describe-change-set')return JSON.stringify(plan);if(args[1]==='get-function')return JSON.stringify(live);return '{}';};
  return {env,aws,fetchHttp:async()=>new Response(code),templatePath,calls,plan,live,stack};
}
test('preview preserves parameters and actual deployed code without applying',async()=>{
  const f=await fixture(),result=await infrastructure(f);assert.equal(result.applied,false);
  assert.ok(f.calls.some(a=>a[1]==='create-change-set'));assert.ok(!f.calls.some(a=>a[1]==='execute-change-set'));
  const call=f.calls.find(a=>a[1]==='create-change-set'),path=call[call.indexOf('--parameters')+1].slice(7),parameters=JSON.parse(await readFile(path,'utf8'));
  assert.deepEqual(parameters,[{ParameterKey:'ArtifactBucket',UsePreviousValue:true},{ParameterKey:'ArtifactKey',ParameterValue:'releases/infrastructure/123-1/api.jar'},{ParameterKey:'CustomDomainName',UsePreviousValue:true}]);
});
test('apply only executes the reviewed available plan on this commit',async()=>{
  const f=await fixture();f.env.INFRA_OPERATION='apply';f.env.INFRA_CHANGE_SET='lifestylerx-aaaaaaaaaaaa-123-1';
  assert.equal((await infrastructure(f)).applied,true);assert.equal(f.calls.filter(a=>a[1]==='execute-change-set').length,1);
});
test('stale code or commit prevents execution',async()=>{
  for(const change of ['code','commit']){const f=await fixture();f.env.INFRA_OPERATION='apply';f.env.INFRA_CHANGE_SET='lifestylerx-aaaaaaaaaaaa-123-1';if(change==='code')f.live.Configuration.CodeSha256='changed';else f.plan.Description=JSON.stringify({commit:'b'.repeat(40)});await assert.rejects(infrastructure(f),/changed|changed|Main changed/);assert.ok(!f.calls.some(a=>a[1]==='execute-change-set'));}
});
test('saved-data replacements and all removals are blocked',()=>{
  for(const type of ['AWS::DynamoDB::Table','AWS::Cognito::UserPool','AWS::S3::Bucket'])assert.throws(()=>checkChanges([{ResourceChange:{Action:'Modify',ResourceType:type,LogicalResourceId:'Protected',Replacement:'True'}}]));
  assert.throws(()=>checkChanges([{ResourceChange:{Action:'Remove',ResourceType:'AWS::ApiGatewayV2::Route',LogicalResourceId:'Route'}}]));
  assert.doesNotThrow(()=>checkChanges([{ResourceChange:{Action:'Modify',ResourceType:'AWS::Lambda::Permission',Replacement:'True'}}]));
});
test('wrong target fails before AWS calls and new required parameters fail clearly',async()=>{
  const f=await fixture();f.env.AWS_STACK_NAME='other';await assert.rejects(infrastructure(f),/Unexpected infrastructure target/);assert.deepEqual(f.calls,[]);
  assert.throws(()=>previousParameters({Parameters:{Required:{Type:'String'}}},[],'code.jar'),/New parameter/);
});
test('unexpected role or stack blocks applying a plan',async()=>{
  for(const key of ['StackId','RoleARN']){const f=await fixture();f.env.INFRA_OPERATION='apply';f.env.INFRA_CHANGE_SET='lifestylerx-aaaaaaaaaaaa-123-1';f.plan[key]='other';await assert.rejects(infrastructure(f));assert.ok(!f.calls.some(a=>a[1]==='execute-change-set'));}
});
test('template grants item lookup to the app and limits pass-role to the intended services',async()=>{
  const template=JSON.parse(await readFile(new URL('../aws/template.json',import.meta.url),'utf8'));
  const app=template.Resources.FunctionRole.Properties.Policies[0].PolicyDocument.Statement;
  assert.ok(app.some(s=>s.Action.includes('dynamodb:GetItem')));
  const github=template.Resources.GitHubDeployRole.Properties.Policies[0].PolicyDocument.Statement;
  assert.ok(github.some(s=>s.Action.includes('iam:PassRole')&&s.Resource['Fn::GetAtt'][0]==='CloudFormationRole'&&s.Condition.StringEquals['iam:PassedToService']==='cloudformation.amazonaws.com'));
  const executor=template.Resources.CloudFormationRole.Properties.Policies[0].PolicyDocument.Statement;
  assert.ok(!executor.some(s=>s.Action.some(a=>['dynamodb:DeleteTable','cognito-idp:DeleteUserPool','s3:DeleteBucket'].includes(a))));
});
