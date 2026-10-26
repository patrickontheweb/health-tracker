import {Injectable,inject,signal,isDevMode} from '@angular/core';
import {HttpClient,HttpHeaders,HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom,timeout} from 'rxjs';
import {ConfigService} from './config.service';
interface AuthResult {AuthenticationResult?:{AccessToken:string;ExpiresIn:number;RefreshToken?:string};ChallengeName?:string;Session?:string;ChallengeParameters?:Record<string,string>;}
@Injectable({providedIn:'root'})
export class AuthService {
  private http=inject(HttpClient);private config=inject(ConfigService);private accessToken:string|null=null;private expiry=0;
  signedIn=signal(false);challenge=signal<{session:string;username:string}|null>(null);
  private devSession=false;
  private refreshToken:string|null=null;private refreshing:Promise<void>|null=null;private generation=0;
  private get storageKey(){return 'lifestylerx.session.'+this.config.value.clientId;}
  private forget(){try{localStorage.removeItem(this.storageKey);}catch{}}
  async restore(){try{const saved=JSON.parse(localStorage.getItem(this.storageKey)||'null');if(saved&&typeof saved.token==='string'&&saved.until>Date.now()){this.refreshToken=saved.token;await this.refresh();}else this.forget();}catch{this.clear();}}
  private accept(result:AuthResult){if(!result.AuthenticationResult)throw new Error('Your session ended. Please sign in again.');this.accessToken=result.AuthenticationResult.AccessToken;this.expiry=Date.now()+result.AuthenticationResult.ExpiresIn*1000;this.signedIn.set(true);}
  private refresh(){if(this.refreshing)return this.refreshing;const generation=this.generation;this.refreshing=this.call('InitiateAuth',{ClientId:this.config.value.clientId,AuthFlow:'REFRESH_TOKEN_AUTH',AuthParameters:{REFRESH_TOKEN:this.refreshToken}}).then(result=>{if(generation===this.generation)this.accept(result);}).catch(error=>{if(generation===this.generation&&error instanceof HttpErrorResponse&&error.status===400)this.clear();throw error;}).finally(()=>{this.refreshing=null;});return this.refreshing;}
  async ensureSession(){if(!this.devSession&&this.refreshToken&&Date.now()>=this.expiry-60000)await this.refresh();}

  get canDevLogin(){try{const url=new URL(this.config.value.apiUrl);return isDevMode()&&this.config.value.devLogin===true&&url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);}catch{return false;}}
  async devLogin(){
    if(!this.canDevLogin)throw new Error('Dev Login is only available locally.');
    const result=await firstValueFrom(this.http.post<AuthResult>(`${this.config.value.apiUrl.replace(/\/$/,'')}/dev/login`,{}).pipe(timeout(15000)));
    if(!result.AuthenticationResult)throw new Error('Local development login is not enabled on this backend.');
    this.accessToken=result.AuthenticationResult.AccessToken;this.expiry=Date.now()+result.AuthenticationResult.ExpiresIn*1000;
    this.devSession=true;this.challenge.set(null);this.signedIn.set(true);
  }
  constructor(){setInterval(()=>{if(this.signedIn()){if(this.refreshToken)void this.ensureSession().catch(()=>{});else if(Date.now()>=this.expiry)this.clear();}},30000);}
  get token(){if(Date.now()>=this.expiry&&!this.refreshToken)this.clear();return this.accessToken;}
  private async call(action:string,body:unknown){const region=this.config.value.region;return firstValueFrom(this.http.post<AuthResult>(`https://cognito-idp.${region}.amazonaws.com/`,body,{headers:new HttpHeaders({'Content-Type':'application/x-amz-json-1.1','X-Amz-Target':`AWSCognitoIdentityProviderService.${action}`})}).pipe(timeout(15000)));}
  async login(username:string,password:string,newPassword:string,remember=false){
    const challenge=this.challenge();
    const result=challenge?await this.call('RespondToAuthChallenge',{ClientId:this.config.value.clientId,ChallengeName:'NEW_PASSWORD_REQUIRED',Session:challenge.session,ChallengeResponses:{USERNAME:challenge.username,NEW_PASSWORD:newPassword}}):await this.call('InitiateAuth',{ClientId:this.config.value.clientId,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:username.trim(),PASSWORD:password}});
    if(result.ChallengeName==='NEW_PASSWORD_REQUIRED'&&result.Session){this.challenge.set({session:result.Session,username:result.ChallengeParameters?.['USER_ID_FOR_SRP']||username.trim()});return;}
    if(!result.AuthenticationResult)throw new Error('Check this account’s sign-in settings in Cognito.');
    this.forget();this.refreshToken=result.AuthenticationResult.RefreshToken??null;
    if(remember&&this.refreshToken){try{localStorage.setItem(this.storageKey,JSON.stringify({token:this.refreshToken,until:Date.now()+30*86400000}));}catch{this.refreshToken=null;throw new Error('This browser cannot remember you. Uncheck Remember me and sign in again.');}}
    this.devSession=false;this.challenge.set(null);this.accept(result);
  }
  async changePassword(previous:string,next:string){await this.ensureSession();if(this.devSession)throw new Error('Password changes are available for Cognito accounts only.');await this.call('ChangePassword',{AccessToken:this.token,PreviousPassword:previous,ProposedPassword:next});}
  clear(){this.generation++;this.forget();this.refreshToken=null;this.accessToken=null;this.expiry=0;this.devSession=false;this.signedIn.set(false);this.challenge.set(null);}
  async logout(){const token=this.token,local=this.devSession;this.clear();if(token&&!local)await this.call('GlobalSignOut',{AccessToken:token});}
  error(error:unknown):string{if(error instanceof HttpErrorResponse)return error.error?.message||'Sign-in failed. Check your username and password.';return error instanceof Error?error.message:'Could not sign in.';}
}
