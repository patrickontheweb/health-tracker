import {Injectable,inject} from '@angular/core';
import {HttpClient,HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom,timeout} from 'rxjs';
import {ConfigService} from './config.service';
import {AuthService} from './auth.service';
import type {Entries,Entry} from './habits';
import {userPage} from './habits';
@Injectable({providedIn:'root'})
export class HabitsApiService {
  readonly page=userPage(window.location.pathname);
  private http=inject(HttpClient);private config=inject(ConfigService);private auth=inject(AuthService);
  private get url(){return this.config.value.apiUrl.replace(/\/$/,'');}
  profile(){return firstValueFrom(this.http.get<{username:string}>(`${this.url}/me/profile`,{headers:{Authorization:`Bearer ${this.auth.token}`}}).pipe(timeout(15000)));}
  readWeek(week:string){const path=this.page.username?`/users/${encodeURIComponent(this.page.username)}/entries`:'/entries';return firstValueFrom(this.http.get<{entries:Entries}>(`${this.url}${path}`,{params:{week},headers:this.page.username?{}:{Authorization:`Bearer ${this.auth.token}`}}).pipe(timeout(15000)));}
  save(day:string,entry:Omit<Entry,'revision'>,expectedRevision:number){return firstValueFrom(this.http.put<{entry:Entry}>(`${this.url}/entries/${day}`,{...entry,expectedRevision},{headers:{Authorization:`Bearer ${this.auth.token}`}}).pipe(timeout(15000)));}
  error(error:unknown):string{if(error instanceof HttpErrorResponse){if(error.status===401||error.status===403){this.auth.clear();return 'Your session ended. Sign in again to save.';}if(error.status===404)return 'User not found.';if(error.status===409)return 'This day changed on another device. Refresh progress before editing it again.';}return 'Could not reach the shared log. Refresh to check saved progress before trying again.';}
}
