import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as passkeys from '../src/app/passkeys.ts';

function fixture(saved,{credentials={},enabled=false}={}){
  const storage=new Map(saved?[['lifestylerx.session.client',JSON.stringify(saved)]]:[]),calls=[];
  const config={value:{region:'us-east-1',clientId:'client',apiUrl:'https://api.example',passkeys:enabled}};
  let respond=()=>({AuthenticationResult:{AccessToken:'access',ExpiresIn:3600,RefreshToken:'refresh'}});
  const http={post(url,body){calls.push(body);return {pipe(){return Promise.resolve().then(()=>respond(body));}};}};
  const signal=value=>{const fn=()=>value;fn.set=next=>value=next;return fn;};
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/app/auth.service.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{
    exports,Date,URL,PublicKeyCredential:class{},navigator:{credentials},window:{isSecureContext:true},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setInterval(){},
    require(name){if(name==='./passkeys')return passkeys;if(name==='@angular/core')return {Injectable:()=>x=>x,inject:t=>t==='http'?http:config,signal,isDevMode:()=>false};if(name==='@angular/common/http')return {HttpClient:'http',HttpHeaders:class{},HttpErrorResponse:class extends Error{}};if(name==='rxjs')return {firstValueFrom:x=>x,timeout:()=>{}};return {ConfigService:'config'};}
  });
  return {auth:new exports.AuthService(),calls,storage,respond:fn=>respond=fn};
}
test('remember me persists only a refresh token and restores without a password',async()=>{
  const f=fixture();await f.auth.login('user','secret','',true);
  const saved=JSON.parse([...f.storage.values()][0]);assert.equal(saved.token,'refresh');assert.equal(Object.keys(saved).length,2);
  const next=fixture(saved);await next.auth.restore();assert.equal(next.auth.signedIn(),true);assert.equal(next.calls[0].AuthFlow,'REFRESH_TOKEN_AUTH');assert.equal(next.calls[0].AuthParameters.PASSWORD,undefined);
});
test('unchecked remember me never persists a session',async()=>{const f=fixture();await f.auth.login('user','secret','');assert.equal(f.storage.size,0);assert.equal(f.auth.signedIn(),true);});
test('expired saved sessions are discarded',async()=>{const f=fixture({token:'old',until:0});await f.auth.restore();assert.equal(f.calls.length,0);assert.equal(f.storage.size,0);assert.equal(f.auth.signedIn(),false);});
test('logout clears saved tokens even if remote signout fails',async()=>{const f=fixture();await f.auth.login('user','secret','',true);f.respond(()=>{throw Error('offline');});await assert.rejects(f.auth.logout());assert.equal(f.storage.has('lifestylerx.session.client'),false);assert.equal(f.auth.signedIn(),false);assert.equal(f.auth.token,null);});
test('an in-flight refresh cannot sign back in after logout',async()=>{const f=fixture({token:'refresh',until:Date.now()+60000});let finish;f.respond(()=>new Promise(resolve=>{finish=resolve;}));const restoring=f.auth.restore();await Promise.resolve();f.auth.clear();finish({AuthenticationResult:{AccessToken:'late',ExpiresIn:3600}});await restoring;assert.equal(f.auth.signedIn(),false);assert.equal(f.auth.token,null);});
test('password changes use Cognito and do not persist the new password',async()=>{const f=fixture();await f.auth.login('user','secret','');await f.auth.changePassword('secret','Short1!a');assert.equal(f.calls[1].ProposedPassword,'Short1!a');assert.equal(f.storage.size,0);});

const bytes=()=>Uint8Array.of(1,2,3).buffer;
const credential=(registration=false)=>({id:'AQID',rawId:bytes(),type:'public-key',authenticatorAttachment:'platform',getClientExtensionResults:()=>({}),response:registration?{clientDataJSON:bytes(),attestationObject:bytes(),getTransports:()=>['internal']}:{clientDataJSON:bytes(),authenticatorData:bytes(),signature:bytes(),userHandle:null}});
test('passkey login exchanges the browser assertion and retains remember-me behavior',async()=>{
  let options;const f=fixture(null,{enabled:true,credentials:{get:async value=>{options=value;return credential();}}});
  f.respond(body=>body.AuthFlow==='USER_AUTH'?{ChallengeName:'WEB_AUTHN',Session:'session',ChallengeParameters:{CREDENTIAL_REQUEST_OPTIONS:JSON.stringify({challenge:'AQID',rpId:'lifestylerx.org',userVerification:'required'})}}:{AuthenticationResult:{AccessToken:'access',ExpiresIn:3600,RefreshToken:'refresh'}});
  await f.auth.loginWithPasskey('user',true);
  assert.deepEqual(new Uint8Array(options.publicKey.challenge),new Uint8Array([1,2,3]));assert.equal(f.calls[1].Session,'session');
  assert.equal(JSON.parse(f.calls[1].ChallengeResponses.CREDENTIAL).response.signature,'AQID');assert.equal(f.auth.signedIn(),true);assert.equal(f.auth.rememberedUsername,'user');
});
test('passkey registration sends a JSON object and remembers the account only after completion',async()=>{
  const f=fixture(null,{enabled:true,credentials:{create:async()=>credential(true)}});await f.auth.login('user','secret','');
  f.respond(body=>body.Credential?{}:{CredentialCreationOptions:{challenge:'AQID',rp:{name:'Lifestyle Rx'},user:{id:'AQID',name:'user',displayName:'user'},pubKeyCredParams:[{type:'public-key',alg:-7}]}});
  await f.auth.registerPasskey('user');assert.equal(f.calls[2].Credential.response.attestationObject,'AQID');assert.equal(f.auth.rememberedUsername,'user');
});
test('cancelled passkey login does not authenticate or save a session',async()=>{
  const f=fixture(null,{enabled:true,credentials:{get:async()=>null}});f.respond(()=>({ChallengeName:'WEB_AUTHN',Session:'session',ChallengeParameters:{CREDENTIAL_REQUEST_OPTIONS:'{"challenge":"AQID"}'}}));
  await assert.rejects(f.auth.loginWithPasskey('user',true),/cancelled/);assert.equal(f.auth.signedIn(),false);assert.equal(f.storage.size,0);assert.equal(f.calls.length,1);
});
test('accounts without a registered passkey retain the password fallback',async()=>{const f=fixture(null,{enabled:true});f.respond(()=>({AvailableChallenges:['PASSWORD']}));await assert.rejects(f.auth.loginWithPasskey('user',false),/password/);assert.equal(f.auth.signedIn(),false);});
