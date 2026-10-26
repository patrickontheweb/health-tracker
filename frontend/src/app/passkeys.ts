// Convert WebAuthn's binary fields explicitly, including on older mobile browsers.
export function decode(value:string):ArrayBuffer {
  const text=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(text,c=>c.charCodeAt(0)).buffer;
}
export function encode(value:ArrayBuffer):string {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
type Descriptor={id:string;type:PublicKeyCredentialType;transports?:AuthenticatorTransport[]};
type Creation=Omit<PublicKeyCredentialCreationOptions,'challenge'|'user'|'excludeCredentials'> & {challenge:string;user:{id:string;name:string;displayName:string};excludeCredentials?:Descriptor[]};
type Request=Omit<PublicKeyCredentialRequestOptions,'challenge'|'allowCredentials'> & {challenge:string;allowCredentials?:Descriptor[]};
export function creationOptions(value:unknown):PublicKeyCredentialCreationOptions {
  const options=(typeof value==='string'?JSON.parse(value):value) as Creation;
  return {...options,challenge:decode(options.challenge),user:{...options.user,id:decode(options.user.id)},excludeCredentials:options.excludeCredentials?.map(c=>({...c,id:decode(c.id)}))};
}
export function requestOptions(value:string):PublicKeyCredentialRequestOptions {
  const options=JSON.parse(value) as Request;
  return {...options,challenge:decode(options.challenge),allowCredentials:options.allowCredentials?.map(c=>({...c,id:decode(c.id)}))};
}
export function credentialJSON(credential:PublicKeyCredential){
  const response=credential.response;
  const common={id:credential.id,rawId:encode(credential.rawId),type:credential.type,authenticatorAttachment:credential.authenticatorAttachment,clientExtensionResults:credential.getClientExtensionResults()};
  if('attestationObject' in response){const registration=response as AuthenticatorAttestationResponse;return {...common,response:{clientDataJSON:encode(response.clientDataJSON),attestationObject:encode(registration.attestationObject),transports:registration.getTransports?.()??[]}};}
  const assertion=response as AuthenticatorAssertionResponse;
  return {...common,response:{clientDataJSON:encode(response.clientDataJSON),authenticatorData:encode(assertion.authenticatorData),signature:encode(assertion.signature),userHandle:assertion.userHandle?encode(assertion.userHandle):null}};
}
