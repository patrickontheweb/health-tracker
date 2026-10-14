import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const protectedTypes=new Set(['AWS::DynamoDB::Table','AWS::Cognito::UserPool','AWS::Cognito::UserPoolClient','AWS::S3::Bucket']);
export function checkChanges(changes){
  for(const {ResourceChange:r} of changes){
    if(r.Action==='Remove')throw new Error(`Refusing resource removal: ${r.LogicalResourceId}`);
    if(protectedTypes.has(r.ResourceType)&&r.Action==='Modify'&&r.Replacement!=='False')throw new Error(`Refusing replacement of saved-data/account resource: ${r.LogicalResourceId}`);
  }
}
export function previousParameters(template,current,artifactKey){
  const existing=new Map(current.map(p=>[p.ParameterKey,p.ParameterValue]));
  return Object.entries(template.Parameters).flatMap(([key,definition])=>{
    if(key==='ArtifactKey')return [{ParameterKey:key,ParameterValue:artifactKey}];
    if(existing.has(key))return [{ParameterKey:key,UsePreviousValue:true}];
    if(!Object.hasOwn(definition,'Default'))throw new Error(`New parameter needs an explicit value: ${key}`);
    return [];
  });
}
function runAws(...args){return execFileSync('aws',[...args,'--region','us-east-1','--no-cli-pager','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
function output(stack,key){const value=stack.Outputs.find(o=>o.OutputKey===key)?.OutputValue;if(!value)throw new Error(`Missing ${key}; complete the one-time infrastructure permissions setup first`);return value;}
export async function infrastructure({env=process.env,aws=runAws,fetchHttp=fetch,templatePath='aws/template.json'}={}){
  const sha=env.GITHUB_SHA,run=env.GITHUB_RUN_ID,attempt=env.GITHUB_RUN_ATTEMPT,mode=env.INFRA_OPERATION;
  if(!/^[a-f0-9]{40}$/.test(sha??'')||!/^\d+$/.test(run??'')||!/^\d+$/.test(attempt??''))throw new Error('Run this through GitHub Actions');
  if(env.AWS_STACK_NAME!=='health-habits'||env.AWS_REGION!=='us-east-1'||env.AWS_ARTIFACT_BUCKET!=='pcmckenna-health')throw new Error('Unexpected infrastructure target');
  if(!['preview','apply'].includes(mode))throw new Error('Choose preview or apply');
  const json=(...args)=>JSON.parse(aws(...args)),stack=json('cloudformation','describe-stacks','--stack-name','health-habits').Stacks[0];
  if(!['CREATE_COMPLETE','UPDATE_COMPLETE','UPDATE_ROLLBACK_COMPLETE'].includes(stack.StackStatus))throw new Error('Wait for the current stack operation');
  const role=output(stack,'CloudFormationRoleArn'),functionName=output(stack,'ApiFunctionName');
  if(stack.Parameters.find(p=>p.ParameterKey==='ArtifactBucket')?.ParameterValue!=='pcmckenna-health')throw new Error('Artifact bucket does not match');
  const summary=async text=>{console.log(text);if(env.GITHUB_STEP_SUMMARY)await writeFile(env.GITHUB_STEP_SUMMARY,text+'\n',{flag:'a'});};
  if(mode==='apply'){
    const name=env.INFRA_CHANGE_SET;
    if(!/^lifestylerx-[a-f0-9]{12}-\d+-\d+$/.test(name??''))throw new Error('Provide the exact change-set name from a preview');
    const plan=json('cloudformation','describe-change-set','--stack-name','health-habits','--change-set-name',name);
    if(plan.StackId!==stack.StackId||plan.Status!=='CREATE_COMPLETE'||plan.ExecutionStatus!=='AVAILABLE')throw new Error('Change set is not available for this stack');
    const metadata=JSON.parse(plan.Description);
    if(metadata.commit!==sha)throw new Error('Main changed since this preview; create a new preview');
    // DescribeChangeSet does not return RoleARN. Record the explicit role passed
    // to CreateChangeSet in the preview metadata and compare it to stack outputs.
    if(metadata.role!==role)throw new Error('Unexpected CloudFormation execution role');
    checkChanges(plan.Changes??[]);
    const live=json('lambda','get-function','--function-name',functionName);
    if(live.Configuration.CodeSha256!==metadata.codeSha)throw new Error('Application code changed since preview; create a new preview');
    await summary(`Applying reviewed change set **${name}** for commit \`${sha}\`.`);
    aws('cloudformation','execute-change-set','--stack-name','health-habits','--change-set-name',name);
    try{aws('cloudformation','wait','stack-update-complete','--stack-name','health-habits');}
    catch(error){const state=json('cloudformation','describe-stacks','--stack-name','health-habits').Stacks[0].StackStatus;throw new Error(`Stack update did not complete successfully (${state}); inspect CloudFormation events`,{cause:error});}
    await summary('Infrastructure update completed successfully. Application code and existing parameters were preserved.');return {applied:true,name};
  }
  const template=JSON.parse(await readFile(templatePath,'utf8'));
  aws('cloudformation','validate-template','--template-body',`file://${resolve(templatePath)}`);
  // The application's S3 key changes on each release outside CloudFormation.
  // Snapshot the actual deployed package to avoid reverting it during a stack update.
  const live=json('lambda','get-function','--function-name',functionName),response=await fetchHttp(live.Code.Location,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('Could not snapshot the current Lambda package');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('base64')!==live.Configuration.CodeSha256)throw new Error('Lambda package checksum mismatch');
  const directory=await mkdtemp(join(tmpdir(),'lifestylerx-infra-')),jar=join(directory,'current-api.jar'),parameters=join(directory,'parameters.json');
  const artifactKey=`releases/infrastructure/${run}-${attempt}/api.jar`;
  await writeFile(jar,bytes);await writeFile(parameters,JSON.stringify(previousParameters(template,stack.Parameters,artifactKey)));
  aws('s3','cp',jar,`s3://pcmckenna-health/${artifactKey}`);
  const name=`lifestylerx-${sha.slice(0,12)}-${run}-${attempt}`;
  aws('cloudformation','create-change-set','--stack-name','health-habits','--change-set-name',name,'--change-set-type','UPDATE','--template-body',`file://${resolve(templatePath)}`,'--parameters',`file://${parameters}`,'--role-arn',role,'--capabilities','CAPABILITY_IAM','--description',JSON.stringify({commit:sha,codeSha:live.Configuration.CodeSha256,role}));
  try{aws('cloudformation','wait','change-set-create-complete','--stack-name','health-habits','--change-set-name',name);}catch{
    const failed=json('cloudformation','describe-change-set','--stack-name','health-habits','--change-set-name',name);
    if(/didn.t contain changes|No updates are to be performed/i.test(failed.StatusReason??'')){await summary('No infrastructure changes.');return {applied:false,noChanges:true};}
    throw new Error(`Could not prepare change set: ${failed.StatusReason??failed.Status}`);
  }
  const plan=json('cloudformation','describe-change-set','--stack-name','health-habits','--change-set-name',name);
  checkChanges(plan.Changes??[]);
  const rows=(plan.Changes??[]).map(({ResourceChange:r})=>`| ${r.Action} | ${r.LogicalResourceId} | ${r.ResourceType} | ${r.Replacement??'—'} |`).join('\n');
  await summary(`## Infrastructure preview\n\nChange set: **${name}**\n\nCommit: \`${sha}\`\n\n| Action | Resource | Type | Replacement |\n|---|---|---|---|\n${rows}\n\nNo stack changes have been applied. To apply this preview, run this workflow with **apply** and this exact change-set name.`);
  return {applied:false,name};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await infrastructure();
