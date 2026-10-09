import {Injectable,inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom,timeout} from 'rxjs';
export interface AppConfig {apiUrl:string;region:string;clientId:string;}
@Injectable({providedIn:'root'})
export class ConfigService {
  private http=inject(HttpClient);
  value:AppConfig={apiUrl:'',region:'',clientId:''};
  get configured(){return Boolean(this.value.apiUrl&&this.value.region&&this.value.clientId);}
  async load(){try{this.value=await firstValueFrom(this.http.get<AppConfig>('config.json').pipe(timeout(10000)));}catch{/* A missing configuration leaves a clearly labelled read-only preview. */}}
}
