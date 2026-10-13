import {Injectable,inject,signal,isDevMode} from '@angular/core';
import {HttpClient,HttpHeaders,HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom,timeout} from 'rxjs';
import {ConfigService} from './config.service';
interface AuthResult {AuthenticationResult?:{AccessToken:string;ExpiresIn:number};ChallengeName?:string;Session?:string;ChallengeParameters?:Record<string,string>;}
@Injectable({providedIn:'root'})
export class AuthService {
  private http=inject(HttpClient);private config=inject(ConfigService);private accessToken:string|null=null;private expiry=0;
  signedIn=signal(false);challenge=signal<{session:string;username:string}|null>(null);
  private devSession=false;
  get canDevLogin(){try{const url=new URL(this.config.value.apiUrl);return isDevMode()&&this.config.value.devLogin===true&&url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);}catch{return false;}}
  async devLogin(){
    if(!this.canDevLogin)throw new Error('Dev Login is only available locally.');
    const result=await firstValueFrom(this.http.post<AuthResult>(`${this.config.value.apiUrl.replace(/\/$/,'')}/dev/login`,{}).pipe(timeout(15000)));
    if(!result.AuthenticationResult)throw new Error('Local development login is not enabled on this backend.');
    this.accessToken=result.AuthenticationResult.AccessToken;this.expiry=Date.now()+result.AuthenticationResult.ExpiresIn*1000;
    this.devSession=true;this.challenge.set(null);this.signedIn.set(true);
  }
  constructor(){setInterval(()=>{if(this.signedIn()&&Date.now()>=this.expiry)this.clear();},30000);}
  get token(){if(Date.now()>=this.expiry)this.clear();return this.accessToken;}
  private async call(action:string,body:unknown){const region=this.config.value.region;return firstValueFrom(this.http.post<AuthResult>(`https://cognito-idp.${region}.amazonaws.com/`,body,{headers:new HttpHeaders({'Content-Type':'application/x-amz-json-1.1','X-Amz-Target':`AWSCognitoIdentityProviderService.${action}`})}).pipe(timeout(15000)));}
  async login(username:string,password:string,newPassword:string){
    const challenge=this.challenge();
    const result=challenge?await this.call('RespondToAuthChallenge',{ClientId:this.config.value.clientId,ChallengeName:'NEW_PASSWORD_REQUIRED',Session:challenge.session,ChallengeResponses:{USERNAME:challenge.username,NEW_PASSWORD:newPassword}}):await this.call('InitiateAuth',{ClientId:this.config.value.clientId,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:username.trim(),PASSWORD:password}});
    if(result.ChallengeName==='NEW_PASSWORD_REQUIRED'&&result.Session){this.challenge.set({session:result.Session,username:result.ChallengeParameters?.['USER_ID_FOR_SRP']||username.trim()});return;}
    if(!result.AuthenticationResult)throw new Error('Check this account’s sign-in settings in Cognito.');
    this.accessToken=result.AuthenticationResult.AccessToken;this.expiry=Date.now()+result.AuthenticationResult.ExpiresIn*1000;this.devSession=false;this.challenge.set(null);this.signedIn.set(true);
  }
  clear(){this.accessToken=null;this.expiry=0;this.devSession=false;this.signedIn.set(false);this.challenge.set(null);}
  async logout(){const token=this.token,local=this.devSession;this.clear();if(token&&!local)await this.call('GlobalSignOut',{AccessToken:token});}
  error(error:unknown):string{if(error instanceof HttpErrorResponse)return error.error?.message||'Sign-in failed. Check your username and password.';return error instanceof Error?error.message:'Could not sign in.';}
}
