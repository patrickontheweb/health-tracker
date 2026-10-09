import {Component,DestroyRef,ElementRef,OnInit,computed,inject,signal,viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AuthService} from './auth.service';
import {ConfigService} from './config.service';
import {HabitsApiService} from './habits-api.service';
import {dateKey,parseDate,weekKeys,totals,validateTotals} from './habits';
import type {Entries} from './habits';
import {registerPublicReadTool,browserModelContext} from './browser-tools';
@Component({selector:'app-root',standalone:true,imports:[FormsModule],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit {
  auth=inject(AuthService);config=inject(ConfigService);private api=inject(HabitsApiService);
  today=dateKey();selectedDate=signal(this.today);entries=signal<Entries>({});loading=signal(false);saving=signal(false);loaded=signal(false);status=signal('');error=signal(false);syncLabel=signal('Connecting to your shared log…');
  days=computed(()=>weekKeys(this.selectedDate()));weekTotals=computed(()=>totals(this.entries(),this.selectedDate()));daily=computed(()=>this.entries()[this.selectedDate()]);
  cards=computed(()=>[{title:'Cardio',period:'THIS WEEK',value:this.weekTotals().cardio,target:150,unit:'min',remainingUnit:'minutes',css:'cardio'},{title:'Weightlifting',period:'THIS WEEK',value:this.weekTotals().lifting,target:2,unit:'sessions',remainingUnit:'sessions',css:'lifting'},{title:'Fruit & vegetables',period:this.selectedDate()===this.today?'TODAY':this.shortDate(this.selectedDate()).toUpperCase(),value:this.daily()?.produce||0,target:5,unit:'servings',remainingUnit:'servings',css:'produce'}]);
  cardio=0;lifting=0;produce=0;username='';password='';newPassword='';authBusy=signal(false);authStatus=signal('');private requestId=0;
  dialog=viewChild<ElementRef<HTMLDialogElement>>('authDialog');
  private destroyRef=inject(DestroyRef);
  ngOnInit(){this.loadWeek();const lifecycle=new AbortController();this.destroyRef.onDestroy(()=>lifecycle.abort());registerPublicReadTool(()=>{if(!this.loaded())throw new Error('Shared progress has not loaded.');return {week:this.days(),entries:this.entries(),totals:this.weekTotals()};},lifecycle.signal,browserModelContext());}
  shortDate(key:string){return parseDate(key).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  dayLabel(key:string){return parseDate(key).toLocaleDateString(undefined,{weekday:'short',day:'numeric'});}
  note(card:{value:number;target:number;remainingUnit:string}){if(!this.loaded())return this.config.configured?'Waiting for saved progress':'AWS setup needed';const remaining=card.target-card.value;return remaining<=0?'Target reached':`${remaining} ${remaining===1?card.remainingUnit.replace(/s$/,''):card.remainingUnit} to go`;}
  progress(value:number,target:number){return this.loaded()?Math.min(value,target):0;}
  private fill(){const entry=this.daily();this.cardio=entry?.cardio||0;this.lifting=entry?.lifting||0;this.produce=entry?.produce||0;}
  async selectDate(key:string){if(this.saving()||!key)return;try{parseDate(key);const previous=this.days()[0];this.selectedDate.set(key);this.status.set('');this.fill();if(previous!==this.days()[0]||!this.loaded())await this.loadWeek();}catch{this.status.set('Choose a valid date.');this.error.set(true);}}
  async loadWeek(){if(this.saving())return;if(!this.config.configured){this.syncLabel.set('Preview only · connect AWS to load and save shared progress.');return;}const id=++this.requestId,week=this.days()[0];this.loading.set(true);this.loaded.set(false);this.syncLabel.set('Loading shared progress…');try{const result=await this.api.readWeek(week);if(id!==this.requestId)return;for(const [day,entry] of Object.entries(result.entries)){if(!this.days().includes(day))throw new Error('Unexpected entry');validateTotals(entry);if(!Number.isSafeInteger(entry.revision)||entry.revision<1)throw new Error('Invalid revision');}this.entries.set(result.entries);this.loaded.set(true);this.fill();this.syncLabel.set(`Shared log · updated ${new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`);this.status.set('');}catch(error){if(id===this.requestId){this.status.set(this.api.error(error));this.error.set(true);this.syncLabel.set('Unable to load shared progress.');}}finally{if(id===this.requestId)this.loading.set(false);}}
  async save(){if(this.saving())return;try{if(!this.auth.token)throw new Error('Sign in to edit this log.');if(!this.loaded())throw new Error('Load progress before saving.');if(this.selectedDate()>dateKey())throw new Error('Log a completed day, not a future date.');const entry={cardio:this.cardio,lifting:this.lifting,produce:this.produce};validateTotals(entry);this.saving.set(true);this.status.set('Saving…');this.error.set(false);const day=this.selectedDate(),result=await this.api.save(day,entry,this.daily()?.revision||0);this.entries.update(entries=>({...entries,[day]:result.entry}));this.status.set('Day saved to the shared log.');}catch(error){this.status.set(error instanceof Error&&!(error as {status?:number}).status&&error.name!=='TimeoutError'?error.message:this.api.error(error));this.error.set(true);}finally{this.saving.set(false);}}
  openLogin(){if(!this.config.configured){this.status.set('AWS must be connected before sign-in is available.');this.error.set(true);return;}this.authStatus.set('');this.dialog()?.nativeElement.showModal();}
  closeLogin(){if(this.authBusy())return;this.dialog()?.nativeElement.close();this.password='';this.newPassword='';this.auth.challenge.set(null);}
  async login(){this.authBusy.set(true);this.authStatus.set('Signing in…');try{await this.auth.login(this.username,this.password,this.newPassword);if(this.auth.signedIn()){this.authBusy.set(false);this.closeLogin();this.status.set('Signed in. You can now edit the log.');this.error.set(false);}else this.authStatus.set('Replace your temporary password to finish signing in.');}catch(error){this.authStatus.set(this.auth.error(error));}finally{this.authBusy.set(false);}}
  async logout(){try{await this.auth.logout();this.status.set('Signed out.');}catch{this.status.set('Signed out here. Other sessions will expire normally.');}}
}
