import {Injectable,inject} from '@angular/core';
import {HttpClient,HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom,timeout} from 'rxjs';
import {ConfigService} from './config.service';
import {AuthService} from './auth.service';
import type {Entries,Entry,Goals} from './habits';
import {userPage} from './habits';
@Injectable({providedIn:'root'})
export class HabitsApiService {
  readonly page=userPage(window.location.pathname);
  private http=inject(HttpClient);private config=inject(ConfigService);private auth=inject(AuthService);
  private get url(){return this.config.value.apiUrl.replace(/\/$/,'');}
  private warming:Promise<void>|null=null;
  warmup(){if(!this.warming)this.warming=firstValueFrom(this.http.get(this.url+'/health').pipe(timeout(30000))).then(()=>{}).catch(()=>{this.warming=null;});return this.warming;}
  private weeks=new Map<string,Promise<{entries:Entries;goals:Goals;username?:string}>>();
  async profile(){await this.auth.ensureSession();return firstValueFrom(this.http.get<{username:string;goals:Goals}>(`${this.url}/me/profile`,{headers:{Authorization:`Bearer ${this.auth.token}`}}).pipe(timeout(15000)));}
  async settings(){await this.auth.ensureSession();return firstValueFrom(this.http.get<Goals>(this.url+'/me/settings',{headers:{Authorization:'Bearer '+this.auth.token}}).pipe(timeout(15000)));}
  async saveSettings(goals:Goals){await this.auth.ensureSession();return firstValueFrom(this.http.put<Goals>(this.url+'/me/settings',goals,{headers:{Authorization:'Bearer '+this.auth.token}}).pipe(timeout(15000)));}
  async readWeek(week:string){if(!this.page.username)await this.auth.ensureSession();const key=[this.page.username||this.auth.token,week].join(':');const pending=this.weeks.get(key);if(pending)return pending;const path=this.page.username?`/users/${encodeURIComponent(this.page.username)}/entries`:'/entries';const request=firstValueFrom(this.http.get<{entries:Entries;goals:Goals;username?:string}>(`${this.url}${path}`,{params:{week},headers:this.page.username?{}:{Authorization:`Bearer ${this.auth.token}`}}).pipe(timeout(15000))).finally(()=>{this.weeks.delete(key);});this.weeks.set(key,request);return request;}
  async save(day:string,entry:Omit<Entry,'revision'>,expectedRevision:number){await this.auth.ensureSession();return firstValueFrom(this.http.put<{entry:Entry}>(`${this.url}/entries/${day}`,{...entry,expectedRevision},{headers:{Authorization:`Bearer ${this.auth.token}`}}).pipe(timeout(15000)));}
  error(error:unknown):string{if(error instanceof HttpErrorResponse){if(error.status===401||error.status===403){this.auth.clear();return 'Your session ended. Sign in again to save.';}if(error.status===404)return 'User not found.';if(error.status===409)return 'This day changed on another device. Refresh progress before editing it again.';}return 'Could not reach the shared log. Refresh to check saved progress before trying again.';}
}
