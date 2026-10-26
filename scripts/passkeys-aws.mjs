// CloudFormation completion alone is not proof that Cognito's separate
// MFA/WebAuthn configuration was applied, especially with MFA disabled.
export function checkPasskeys({aws,outputs,repair=false,log=console.log}){
  const value=key=>outputs.find(o=>o.OutputKey===key)?.OutputValue;
  if(value('PasskeysEnabled')!=='true')return;
  const pool=value('UserPoolId'),website=new URL(value('WebsiteUrl'));
  if(!/^us-east-1_[a-zA-Z0-9]+$/.test(pool??'')||website.protocol!=='https:'||website.pathname!=='/'||website.username||website.password||website.port)throw new Error('Invalid passkey configuration target');
  const desired={RelyingPartyId:website.hostname,UserVerification:'required'};
  const read=()=>JSON.parse(aws('cognito-idp','get-user-pool-mfa-config','--user-pool-id',pool));
  const matches=config=>config.WebAuthnConfiguration?.RelyingPartyId===desired.RelyingPartyId&&config.WebAuthnConfiguration?.UserVerification===desired.UserVerification;
  let current=read();
  log(`Cognito passkey domain: ${current.WebAuthnConfiguration?.RelyingPartyId||'(unset)'}`);
  if(!matches(current)&&repair){
    // Replay existing MFA settings so a passkey repair cannot disable another factor.
    aws('cognito-idp','set-user-pool-mfa-config','--cli-input-json',JSON.stringify({...current,UserPoolId:pool,WebAuthnConfiguration:{...current.WebAuthnConfiguration,...desired}}));
    current=read();
  }
  if(!matches(current))throw new Error(`Cognito passkey configuration is missing or incorrect for ${desired.RelyingPartyId}`);
  log(`Verified Cognito passkeys for ${desired.RelyingPartyId} with required user verification.`);
}
