import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPasskeys} from '../scripts/passkeys-aws.mjs';
const outputs=Object.entries({PasskeysEnabled:'true',UserPoolId:'us-east-1_test',WebsiteUrl:'https://lifestylerx.org'}).map(([OutputKey,OutputValue])=>({OutputKey,OutputValue}));
function fixture(config={MfaConfiguration:'OFF'}){
  const calls=[];let current=config;
  return {calls,run(repair=false,ignoreUpdate=false){return checkPasskeys({outputs,repair,log:()=>{},aws:(...args)=>{calls.push(args);if(args[1]==='set-user-pool-mfa-config'){const input=JSON.parse(args.at(-1));assert.equal(input.UserPoolId,'us-east-1_test');if(!ignoreUpdate)current=input;return '{}';}return JSON.stringify(current);}});}};
}
test('missing relying party is repaired and verified in Cognito',()=>{const f=fixture();f.run(true);assert.equal(f.calls.filter(a=>a[1]==='get-user-pool-mfa-config').length,2);const body=JSON.parse(f.calls[1].at(-1));assert.equal(body.WebAuthnConfiguration.RelyingPartyId,'lifestylerx.org');assert.equal(body.WebAuthnConfiguration.UserVerification,'required');assert.equal(body.MfaConfiguration,'OFF');});
test('matching live configuration is read without mutation',()=>{const f=fixture({WebAuthnConfiguration:{RelyingPartyId:'lifestylerx.org',UserVerification:'required'}});f.run(true);assert.equal(f.calls.length,1);});
test('deployment fails on a missing domain instead of publishing broken passkeys',()=>{const f=fixture();assert.throws(()=>f.run(),/missing or incorrect/);assert.equal(f.calls.length,1);});
test('repair preserves existing MFA configuration',()=>{const f=fixture({MfaConfiguration:'OPTIONAL',SoftwareTokenMfaConfiguration:{Enabled:true}});f.run(true);const body=JSON.parse(f.calls[1].at(-1));assert.equal(body.MfaConfiguration,'OPTIONAL');assert.deepEqual(body.SoftwareTokenMfaConfiguration,{Enabled:true});});
test('an unpersisted repair fails verification',()=>assert.throws(()=>fixture().run(true,true),/missing or incorrect/));
test('disabled passkeys do not call Cognito',()=>checkPasskeys({outputs:[],aws:()=>assert.fail('unexpected AWS call')}));
