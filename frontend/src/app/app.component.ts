import {Component,DestroyRef,ElementRef,OnInit,computed,effect,inject,signal,untracked,viewChild} from '@angular/core';
import {ButtonDirective} from './ui/button.directive';
import {FormsModule} from '@angular/forms';
import {AuthService} from './auth.service';
import {InstallService} from './install.service';
import {ConfigService} from './config.service';
import {HabitsApiService} from './habits-api.service';
import {dateKey,parseDate,weekKeys,totals,validateTotals,monthGrid,monthRows,shiftMonth,produceDayState,defaultGoals} from './habits';
import type {Entries,Entry,Measurement,Goals} from './habits';
import {registerPublicReadTool,browserModelContext} from './browser-tools';
import {buildReport,readReportEntries,reportDates} from './report';
import {buildVersion} from './build-version';
import {WholeNumberDirective} from './whole-number.directive';
@Component({selector:'app-root',standalone:true,imports:[FormsModule,WholeNumberDirective,ButtonDirective],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit {
  readonly buildVersion=buildVersion;
  install=inject(InstallService);
  passkeyBusy=signal(false);passkeyStatus=signal('');passkeyError=signal(false);
  async addPasskey(){if(this.passkeyBusy())return;this.passkeyBusy.set(true);this.passkeyStatus.set('');this.passkeyError.set(false);try{await this.auth.registerPasskey(this.accountUsername()||'');this.passkeyStatus.set('Passkey added. Your device will prompt automatically when sign-in is needed.');}catch(error){this.passkeyError.set(true);this.passkeyStatus.set(this.auth.error(error));}finally{this.passkeyBusy.set(false);}}
  passwordLogin=signal(false);private loginAttempt=0;
  usePasswordLogin(){this.loginAttempt++;this.auth.cancelPasskeyLogin();this.passwordLogin.set(true);this.authBusy.set(false);this.authStatus.set('');}
  async passkeyLogin(){if(this.authBusy())return;this.passwordLogin.set(false);const attempt=++this.loginAttempt;this.authBusy.set(true);this.authStatus.set('Follow your phone or browser’s passkey prompt…');try{await this.auth.loginWithPasskey(this.username,this.rememberMe);if(attempt!==this.loginAttempt)return;this.authBusy.set(false);this.closeLogin();}catch(error){if(attempt===this.loginAttempt)this.authStatus.set(this.auth.error(error));}finally{if(attempt===this.loginAttempt)this.authBusy.set(false);}}
  accountMenu=viewChild<ElementRef<HTMLElement>>('accountMenu');
  accountMenuOpen=signal(false);
  private settingsReturnPath=location.pathname==='/settings'?'/':location.pathname;
  goals=signal<Goals>({...defaultGoals});
  settingsPage=signal(location.pathname.replace(/\/$/,'')==='/settings');
  settingsBusy=signal(false);settingsReady=signal(false);settingsStatus=signal('');settingsError=signal(false);
  goalDraft:Goals={...defaultGoals};
  async openSettings(){
    if(this.cardioSave)await this.cardioSave;
    if(this.saving()||!this.auth.signedIn())return;
    this.accountMenuOpen.set(false);
    if(!this.settingsPage()){this.settingsReturnPath=location.pathname;history.pushState(null,'','/settings');}
    this.settingsPage.set(true);await this.loadSettings();
  }
  closeSettings(){if(this.settingsBusy()||this.passwordBusy())return;this.currentPassword='';this.replacementPassword='';this.passwordStatus.set('');this.settingsPage.set(false);history.pushState(null,'',this.settingsReturnPath);}
  private async loadSettings(){
    const token=this.auth.token;this.settingsReady.set(false);this.settingsBusy.set(true);this.settingsStatus.set('');this.settingsError.set(false);
    try{const goals=await this.api.settings();if(token===this.auth.token&&this.auth.signedIn()){this.goalDraft={...goals};this.settingsReady.set(true);}}
    catch{this.settingsStatus.set('Unable to load settings. Please try again.');this.settingsError.set(true);}
    finally{this.settingsBusy.set(false);}
  }
  async saveSettings(){
    if(!this.auth.signedIn()||!this.settingsReady()||this.settingsBusy())return;
    const token=this.auth.token;
    if(!Object.entries(this.goalDraft).every(([key,value])=>Number.isInteger(value)&&value>=1&&value<=({produce:99,lifting:7,cardio:9999}[key as keyof Goals]))){this.settingsStatus.set('Enter positive whole numbers within the displayed limits.');this.settingsError.set(true);return;}
    this.settingsBusy.set(true);this.settingsError.set(false);this.settingsStatus.set('Saving goals…');
    try{const goals=await this.api.saveSettings({...this.goalDraft});if(token===this.auth.token&&this.auth.signedIn()){if(!this.viewUsername||this.viewUsername===this.accountUsername()){this.goals.set(goals);this.fill();}this.settingsStatus.set('Goals saved.');}}
    catch{this.settingsStatus.set('Unable to save goals. Please try again.');this.settingsError.set(true);}
    finally{this.settingsBusy.set(false);}
  }
  currentPassword='';replacementPassword='';passwordBusy=signal(false);passwordStatus=signal('');passwordError=signal(false);
  async changePassword(){if(this.passwordBusy())return;this.passwordBusy.set(true);this.passwordStatus.set('');this.passwordError.set(false);try{await this.auth.changePassword(this.currentPassword,this.replacementPassword);this.currentPassword='';this.replacementPassword='';this.passwordStatus.set('Password changed.');}catch(error){this.passwordError.set(true);this.passwordStatus.set(this.auth.error(error));}finally{this.passwordBusy.set(false);}}
  showDetails=signal(false);
  async toggleDetails(){if(this.cardioSave)await this.cardioSave;if(this.saving())return;this.showDetails.update(shown=>!shown);}

  private async prefillWeight(){
    if(this.daily()?.weight!=null)return;
    const day=this.selectedDate(),previous=parseDate(day);previous.setDate(previous.getDate()-1);
    const key=dateKey(previous);
    let weight=this.entries()[key]?.weight??this.calendarEntries()[key]?.weight??null;
    if(weight===null&&!this.days().includes(key)&&this.config.configured&&this.auth.signedIn()){
      try{const result=await this.api.readWeek(weekKeys(key)[0]);weight=result.entries[key]?.weight??null;}catch{return;}
    }
    if(this.selectedDate()===day&&this.daily()?.weight==null&&this.weight===null&&weight!==null){this.weight=weight;}
  }
  auth=inject(AuthService);config=inject(ConfigService);private api=inject(HabitsApiService);
  readonly viewUsername=this.api.page.username;accountUsername=signal<string|null>(null);
  canRead=computed(()=>!!this.viewUsername||this.auth.signedIn());
  canEdit=computed(()=>this.auth.signedIn()&&!!this.accountUsername()&&(!this.viewUsername||this.accountUsername()===this.viewUsername));
  today=dateKey();selectedDate=signal(this.api.page.date??this.today);entries=signal<Entries>({});loading=signal(false);saving=signal(false);loaded=signal(false);status=signal('');error=signal(false);syncLabel=signal('Connecting to your log…');
  days=computed(()=>weekKeys(this.selectedDate()));weekTotals=computed(()=>totals(this.entries(),this.selectedDate(),this.goals().produce));daily=computed(()=>this.entries()[this.selectedDate()]);
  cardio=0;lifting=0;produce=0;weight:number|null=null;systolic:number|null=null;diastolic:number|null=null;heartRate:number|null=null;sleepHours:number|null=null;calories:number|null=null;sugarGrams:number|null=null;saturatedFatGrams:number|null=null;sodiumMg:number|null=null;rememberMe=false;username=this.auth.rememberedUsername;password='';newPassword='';authBusy=signal(false);authStatus=signal('');private requestId=0;
  readonly produceIcons=['🥕','🍌','🍇','🍎','🥦'];
  visibleProduceIcons=computed(()=>this.produceIcons.slice(0,Math.min(5,this.goals().produce)));
  produceSelections=[false,false,false,false,false];
  cardioSaving=signal(false);private cardioSave:Promise<void>|null=null;
  calendarMonth=signal(this.selectedDate().slice(0,7));calendarEntries=signal<Entries>({});calendarLoaded=signal(false);calendarLoading=signal(false);calendarError=signal('');private calendarRequestId=0;
  calendarDays=computed(()=>monthGrid(this.calendarMonth()));
  calendarRows=computed(()=>monthRows(this.calendarMonth()));
  calendarWeekTotals(week:string){return totals(this.calendarEntries(),week,this.goals().produce);}
  weekGoalMissed(week:string,goal:'cardio'|'lifting'){return this.calendarLoaded()&&weekKeys(week)[6]<this.today&&this.calendarWeekTotals(week)[goal]<(this.goals()[goal]);}
  calendarTitle=computed(()=>parseDate(`${this.calendarMonth()}-01`).toLocaleDateString(undefined,{month:'long',year:'numeric'}));
  calendarSeasonIcon=computed(()=>{const month=Number(this.calendarMonth().slice(5,7));return month===12||month<=2?'❄️':month<=5?'🌺':month<=8?'🌞':'🍂';});
  monthPicker=viewChild<ElementRef<HTMLDialogElement>>('monthPicker');pickedMonth=Number(this.today.slice(5,7));pickedYear=Number(this.today.slice(0,4));
  readonly monthOptions=Array.from({length:12},(_,index)=>({value:index+1,label:new Date(2026,index,1).toLocaleDateString(undefined,{month:'long'})}));
  openMonthPicker(){if(this.saving())return;this.pickedMonth=Number(this.calendarMonth().slice(5,7));this.pickedYear=Number(this.calendarMonth().slice(0,4));this.monthPicker()?.nativeElement.showModal();}
  async chooseToday(){if(this.saving())return;this.monthPicker()?.nativeElement.close();await this.selectDate(this.today);}
  async chooseMonth(){if(!Number.isInteger(this.pickedYear)||this.pickedYear<1000||this.pickedYear>9999)return;const month=`${this.pickedYear}-${String(this.pickedMonth).padStart(2,'0')}`;try{parseDate(`${month}-01`);}catch{return;}this.calendarMonth.set(month);this.monthPicker()?.nativeElement.close();await this.loadCalendar();}
  readonly weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  dialog=viewChild<ElementRef<HTMLDialogElement>>('authDialog');
  exportDialog=viewChild<ElementRef<HTMLDialogElement>>('exportDialog');
  exportStart='';exportEnd='';exportBusy=signal(false);exportStatus=signal('');exportError=signal(false);
  openExport(){
    const month=this.calendarMonth()<=this.today.slice(0,7)?this.calendarMonth():this.today.slice(0,7);
    this.exportStart=`${month}-01`;
    const last=dateKey(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0,12));
    this.exportEnd=last>this.today?this.today:last;
    this.exportStatus.set('');this.exportError.set(false);this.exportDialog()?.nativeElement.showModal();
  }
  async exportReport(){
    if(this.exportBusy())return;
    let report:Window|null=null;
    try{
      const start=this.exportStart,end=this.exportEnd;
      reportDates(start,end,this.today);
      report=window.open('','_blank');
      if(!report)throw new Error('Allow pop-ups for this site, then try again.');
      report.opener=null;
      report.document.write('<!doctype html><html lang="en"><title>Preparing report</title><body style="font-family:Segoe UI,Arial;padding:40px"><h1>Preparing your report…</h1><p>You can return to the tracker while the saved entries load.</p></body></html>');report.document.close();
      this.exportBusy.set(true);this.exportError.set(false);this.exportStatus.set('Loading saved entries…');
      await this.saveCardio();
      if(this.saving())throw new Error('Wait for the current save to finish, then try again.');
      if(this.canEdit()&&this.cardio!==(this.daily()?.cardio||0))throw new Error('Your cardio change could not be saved. Correct it before exporting.');
      const entries=await readReportEntries(start,end,this.today,week=>this.api.readWeek(week),(done,total)=>this.exportStatus.set(`Loading saved entries: ${done} of ${total} weeks…`));
      if(report.closed)throw new Error('The report tab was closed. Generate it again when you are ready.');
      report.document.open();report.document.write(buildReport(start,end,entries,this.today,new Date(),this.goals()));report.document.close();
      this.exportStatus.set('Report ready. Use Print / Save as PDF in the report tab.');
    }catch(error){report?.close();this.exportError.set(true);this.exportStatus.set(error instanceof Error&&!(error as {status?:number}).status?error.message:'Unable to load the report. Please try again.');}
    finally{this.exportBusy.set(false);}
  }
  private destroyRef=inject(DestroyRef);
  constructor(){effect(()=>{
    const signedIn=this.auth.signedIn();untracked(()=>{
    this.accountUsername.set(null);this.settingsReady.set(false);
    if(!signedIn){this.goals.set({...defaultGoals});}

    if(signedIn||this.viewUsername){void this.loadWeek().then(()=>{if(this.canRead()){if(signedIn&&this.auth.signedIn())void this.loadAccount();void this.loadCalendar();}});}
    else{
      this.requestId++;this.calendarRequestId++;
      this.entries.set({});this.calendarEntries.set({});this.loaded.set(false);this.calendarLoaded.set(false);this.loading.set(false);this.calendarLoading.set(false);this.calendarError.set('');
      this.cardio=0;this.lifting=0;this.produce=0;this.weight=null;this.systolic=null;this.diastolic=null;this.heartRate=null;this.sleepHours=null;this.calories=null;this.sugarGrams=null;this.saturatedFatGrams=null;this.sodiumMg=null;this.produceSelections=this.visibleProduceIcons().map(()=>false);
      this.syncLabel.set('Sign in to view your log.');
    }
  });});}
  private async loadAccount(){const token=this.auth.token;try{const profile=await this.api.profile();if(this.auth.signedIn()&&this.auth.token===token){this.accountUsername.set(profile.username);if(!this.viewUsername||this.viewUsername===profile.username)this.goals.set(profile.goals);if(this.settingsPage())this.loadSettings();if(this.viewUsername===profile.username){this.loadWeek();this.loadCalendar();}}}catch{this.status.set('Unable to load your account. Please sign in again.');this.error.set(true);}}
  ngOnInit(){if(!this.viewUsername&&!this.auth.canDevLogin&&!this.auth.signedIn())setTimeout(()=>this.openLogin(),0);const lifecycle=new AbortController();document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||this.saving())return;const previous=this.today;this.today=dateKey();if(this.today!==previous&&this.selectedDate()===previous)void this.selectDate(this.today);},{signal:lifecycle.signal});document.addEventListener('click',event=>{const menu=this.accountMenu()?.nativeElement;if(menu&&event.target instanceof Node&&!menu.contains(event.target))this.accountMenuOpen.set(false);},{signal:lifecycle.signal});window.addEventListener('popstate',()=>{this.settingsPage.set(new URLSearchParams(location.search).has('settings'));if(this.settingsPage()&&this.auth.signedIn())this.loadSettings();},{signal:lifecycle.signal});this.destroyRef.onDestroy(()=>lifecycle.abort());registerPublicReadTool(()=>{if(!this.canRead()||!this.loaded())throw new Error('Shared progress has not loaded.');return {week:this.days(),entries:this.entries(),totals:this.weekTotals()};},lifecycle.signal,browserModelContext());}
  calendarState(day:string){return produceDayState(day,this.today,this.calendarLoaded()?this.calendarEntries():null,this.goals().produce);}
  calendarProduceIcons(day:string){return this.produceIcons.slice(0,Math.min(5,this.calendarEntries()[day]?.produce||0));}
  calendarLabel(day:string){const state=this.calendarState(day),entry=this.calendarEntries()[day];return `${parseDate(day).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}: ${state==='future'?'future date':state==='unknown'?'progress not loaded':`${entry?.produce||0} servings, ${state==='met'?'goal reached':'below goal'}, ${entry?.lifting||0} lift sessions, ${entry?.cardio||0} cardio minutes`}`;}
  async changeMonth(offset:number){if(this.saving())return;this.calendarMonth.set(shiftMonth(this.calendarMonth(),offset));await this.loadCalendar();}
  async calendarToday(){if(this.saving())return;this.calendarMonth.set(this.today.slice(0,7));await this.loadCalendar();}
  async loadCalendar(){
    if(!this.canRead()||!this.config.configured||this.saving())return;
    const id=++this.calendarRequestId,month=this.calendarMonth(),dates=monthGrid(month).filter((day):day is string=>!!day&&day<=this.today);
    this.calendarLoading.set(true);this.calendarLoaded.set(false);this.calendarError.set('');
    try{
      const weeks=[...new Set(dates.map(day=>weekKeys(day)[0]))];
      const covered=new Set(weeks.flatMap(weekKeys));
      const results=await Promise.all(weeks.map(async week=>({week,result:await this.api.readWeek(week)})));
      if(id!==this.calendarRequestId)return;
      const entries:Entries={};
      for(const {week,result} of results)for(const [day,entry] of Object.entries(result.entries)){
        if(!weekKeys(week).includes(day))throw new Error('Unexpected entry');validateTotals(entry);
        if(!Number.isSafeInteger(entry.revision)||entry.revision<1)throw new Error('Invalid revision');
        entries[day]=entry;
      }
      // A save may finish while the month requests are in flight; keep its newer revision.
      for(const [day,entry] of Object.entries({...this.calendarEntries(),...this.entries()}))if(covered.has(day)&&entry.revision>(entries[day]?.revision||0))entries[day]=entry;
      this.calendarEntries.set(entries);this.calendarLoaded.set(true);
    }catch{if(id===this.calendarRequestId)this.calendarError.set('Unable to load this month.');}
    finally{if(id===this.calendarRequestId)this.calendarLoading.set(false);}
  }
  private savedEntry(day:string,entry:Entry){if(!this.canEdit())return;this.entries.update(entries=>({...entries,[day]:entry}));if(this.calendarRows().some(row=>weekKeys(row.week).includes(day)))this.calendarEntries.update(entries=>({...entries,[day]:entry}));}
  shortDate(key:string){return parseDate(key).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  private bodyValues(entry:Entry|undefined):Record<Measurement,number|null>{return {weight:entry?.weight??null,systolic:entry?.systolic??null,diastolic:entry?.diastolic??null,heartRate:entry?.heartRate??null,sleepHours:entry?.sleepHours??null,calories:entry?.calories??null,sugarGrams:entry?.sugarGrams??null,saturatedFatGrams:entry?.saturatedFatGrams??null,sodiumMg:entry?.sodiumMg??null};}
  private saveDaily(day:string,entry:Pick<Entry,'cardio'|'lifting'|'produce'>,revision:number){return this.api.save(day,{...entry,...this.bodyValues(this.entries()[day])},revision);}
  saveWeight(){return this.saveMeasurement('weight');}
  async saveMeasurement(field:Measurement){
    if(this.cardioSave){await this.cardioSave;if(this.error())return;}
    if(this.saving()||this.loading()||!this.loaded()||!this.canEdit()||this[field]===(this.daily()?.[field]??null))return;
    this.cardioSaving.set(true);
    this.cardioSave=this.persistMeasurement(field).finally(()=>{this.cardioSaving.set(false);this.cardioSave=null;});
    await this.cardioSave;
  }
  private async persistMeasurement(field:Measurement){
    const day=this.selectedDate(),saved=this.daily(),value=this[field];
    const labels:Record<Measurement,string>={weight:'Weight',systolic:'Systolic BP',diastolic:'Diastolic BP',heartRate:'Heart rate',sleepHours:'Sleep',calories:'Calories',sugarGrams:'Sugar',saturatedFatGrams:'Saturated fat',sodiumMg:'Sodium'};
    try{
      if(day>dateKey())throw new Error('Log a completed day, not a future date.');
      const decimal=['sleepHours','sugarGrams','saturatedFatGrams'].includes(field);
      const max=field==='sleepHours'?24:['sugarGrams','saturatedFatGrams'].includes(field)?9999:['calories','sodiumMg'].includes(field)?99999:999;
      const min=['sleepHours','calories','sugarGrams','saturatedFatGrams','sodiumMg'].includes(field)?0:1;
      if(value!==null&&(!Number.isFinite(value)||value<min||value>max||(decimal?Math.abs(value*10-Math.round(value*10))>0.000001:!Number.isInteger(value))))throw new Error(`Enter ${labels[field].toLowerCase()} from ${min} to ${max}${decimal?' with at most one decimal place':''}, or leave it blank.`);
      this.saving.set(true);this.error.set(false);this.status.set(`Saving ${labels[field].toLowerCase()}…`);
      const result=await this.api.save(day,{cardio:saved?.cardio||0,lifting:saved?.lifting||0,produce:saved?.produce||0,...this.bodyValues(saved),[field]:value},saved?.revision||0);
      this.savedEntry(day,result.entry);this.status.set(`${labels[field]} ${value===null?'removed':'saved'}.`);
    }catch(error){this.status.set(error instanceof Error&&!(error as {status?:number}).status?error.message:this.api.error(error));this.error.set(true);}
    finally{this.saving.set(false);}
  }
  dayLabel(key:string){return parseDate(key).toLocaleDateString(undefined,{weekday:'short',day:'numeric'});}
  private fill(){const entry=this.daily();this.cardio=entry?.cardio||0;this.lifting=entry?.lifting||0;this.produce=entry?.produce||0;this.weight=entry?.weight??null;this.systolic=entry?.systolic??null;this.diastolic=entry?.diastolic??null;this.heartRate=entry?.heartRate??null;this.sleepHours=entry?.sleepHours??null;this.calories=entry?.calories??null;this.sugarGrams=entry?.sugarGrams??null;this.saturatedFatGrams=entry?.saturatedFatGrams??null;this.sodiumMg=entry?.sodiumMg??null;this.prefillWeight();this.produceSelections=this.visibleProduceIcons().map((_,index)=>index<this.produce);}
  saveCardio(){
    if(this.cardioSave)return this.cardioSave;
    if(this.saving()||this.loading()||!this.loaded()||!this.canEdit()||this.cardio===(this.daily()?.cardio||0))return Promise.resolve();
    this.cardioSaving.set(true);
    this.cardioSave=this.persistCardio().finally(()=>{this.cardioSaving.set(false);this.cardioSave=null;});
    return this.cardioSave;
  }
  private async persistCardio(){
    if(this.saving()||this.loading()||!this.loaded()||!this.canEdit())return;
    const day=this.selectedDate(),saved=this.daily();
    if(this.cardio===(saved?.cardio||0))return;
    try{
      if(day>dateKey())throw new Error('Log a completed day, not a future date.');
      if(this.cardio>999)throw new Error('Enter cardio minutes from 0 to 999.');
      const entry={cardio:this.cardio,lifting:saved?.lifting||0,produce:saved?.produce||0};
      validateTotals(entry);this.saving.set(true);this.error.set(false);this.status.set('Saving cardio…');
      const result=await this.saveDaily(day,entry,saved?.revision||0);
      this.savedEntry(day,result.entry);this.status.set('Cardio saved to the shared log.');
    }catch(error){this.status.set(error instanceof Error&&!(error as {status?:number}).status&&error.name!=='TimeoutError'?error.message:this.api.error(error));this.error.set(true);}
    finally{this.saving.set(false);}
  }
  async toggleLifting(){
    if(this.cardioSave){await this.cardioSave;if(this.error())return;}
    if(this.saving()||this.loading()||!this.loaded()||!this.canEdit())return;
    if(this.selectedDate()>dateKey()){this.status.set('Log a completed day, not a future date.');this.error.set(true);return;}
    const previous=this.lifting,day=this.selectedDate(),saved=this.daily();
    this.lifting=this.lifting>0?0:1;
    this.saving.set(true);this.error.set(false);this.status.set('Saving weightlifting…');
    try{
      const result=await this.saveDaily(day,{cardio:saved?.cardio||0,lifting:this.lifting,produce:saved?.produce||0},saved?.revision||0);
      this.savedEntry(day,result.entry);
      this.status.set(this.lifting?'Weightlifting session saved.':'Weightlifting session removed.');
    }catch(error){
      this.lifting=previous;this.status.set(this.api.error(error));this.error.set(true);
    }finally{this.saving.set(false);}
  }
  async toggleProduce(index?:number){
    if(this.cardioSave){await this.cardioSave;if(this.error())return;}
    if(this.saving()||this.loading()||!this.loaded()||!this.canEdit())return;
    if(this.selectedDate()>dateKey()){this.status.set('Log a completed day, not a future date.');this.error.set(true);return;}
    const previousSelections=[...this.produceSelections],previousTotal=this.produce;
    if(index===undefined){
      const next=this.produceSelections.indexOf(false);
      if(next>=0)this.produceSelections=this.produceSelections.map((selected,i)=>selected||i===next);
      this.produce++;
    }else{
      this.produceSelections=this.produceSelections.map((selected,i)=>i===index?!selected:selected);
      this.produce=this.produceSelections.filter(Boolean).length;
    }
    const day=this.selectedDate(),saved=this.daily();
    this.saving.set(true);this.error.set(false);this.status.set('Saving serving…');
    try{
      // A quick serving save must not submit unfinished exercise fields.
      const result=await this.saveDaily(day,{cardio:saved?.cardio||0,lifting:saved?.lifting||0,produce:this.produce},saved?.revision||0);
      this.savedEntry(day,result.entry);
      this.status.set(`${this.produce} servings saved${this.produce>=this.goals().produce?' · Goal reached!':'.'}`);
    }catch(error){
      this.produceSelections=previousSelections;this.produce=previousTotal;
      this.status.set(this.api.error(error));this.error.set(true);
    }finally{this.saving.set(false);}
  }
  async selectDate(key:string){if(this.saving()||!key)return;try{parseDate(key);const previous=this.days()[0];this.selectedDate.set(key);if(this.viewUsername)history.replaceState(null,'','/'+this.viewUsername+'/'+key.slice(5,7)+key.slice(8,10)+key.slice(0,4));if(key.slice(0,7)!==this.calendarMonth()){this.calendarMonth.set(key.slice(0,7));this.loadCalendar();}this.status.set('');this.fill();if(previous!==this.days()[0]||!this.loaded())await this.loadWeek();}catch{this.status.set('Choose a valid date.');this.error.set(true);}}
  async loadWeek(){if(this.saving()||!this.canRead())return;if(!this.config.configured){this.syncLabel.set('Preview only · connect AWS to load and save shared progress.');return;}const id=++this.requestId,week=this.days()[0];this.loading.set(true);this.loaded.set(false);this.syncLabel.set('Loading shared progress…');try{const result=await this.api.readWeek(week);if(id!==this.requestId)return;for(const [day,entry] of Object.entries(result.entries)){if(!this.days().includes(day))throw new Error('Unexpected entry');validateTotals(entry);if(!Number.isSafeInteger(entry.revision)||entry.revision<1)throw new Error('Invalid revision');}if(!this.viewUsername&&result.username)this.accountUsername.set(result.username);this.goals.set(result.goals??{...defaultGoals});this.entries.set(result.entries);this.loaded.set(true);this.fill();this.syncLabel.set(`Updated ${new Date().toLocaleString('en-US',{month:'2-digit',day:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit'}).replace(',','')}`);this.status.set('');}catch(error){if(id===this.requestId){this.status.set(this.api.error(error));this.error.set(true);this.syncLabel.set('Unable to load shared progress.');}}finally{if(id===this.requestId)this.loading.set(false);}}
  async save(){if(this.saving())return;try{if(!this.canEdit())throw new Error('Sign in as this user to edit the log.');if(!this.canRead()||!this.loaded())throw new Error('Load progress before saving.');if(this.selectedDate()>dateKey())throw new Error('Log a completed day, not a future date.');const entry={cardio:this.cardio,lifting:this.lifting,produce:this.produce};validateTotals(entry);this.saving.set(true);this.status.set('Saving…');this.error.set(false);const day=this.selectedDate(),result=await this.saveDaily(day,entry,this.daily()?.revision||0);this.savedEntry(day,result.entry);this.status.set('Day saved to the shared log.');}catch(error){this.status.set(error instanceof Error&&!(error as {status?:number}).status&&error.name!=='TimeoutError'?error.message:this.api.error(error));this.error.set(true);}finally{this.saving.set(false);}}
  openLogin(){if(this.auth.canDevLogin){this.devLogin();return;}if(!this.config.configured){this.status.set('AWS must be connected before sign-in is available.');this.error.set(true);return;}void this.api.warmup();this.authStatus.set('');this.passwordLogin.set(!this.auth.passkeysSupported);this.dialog()?.nativeElement.showModal();if(this.auth.passkeysSupported&&this.username.trim())void this.passkeyLogin();}
  async devLogin(){if(this.authBusy())return;this.authBusy.set(true);try{await this.auth.devLogin();this.status.set('Signed in locally.');this.error.set(false);}catch(error){this.status.set(this.auth.error(error));this.error.set(true);}finally{this.authBusy.set(false);}}
  closeLogin(){if(this.authBusy())return;this.dialog()?.nativeElement.close();this.password='';this.newPassword='';this.auth.challenge.set(null);}
  async login(){if(this.authBusy())return;if(!this.passwordLogin()&&!this.auth.challenge()){await this.passkeyLogin();return;}this.authBusy.set(true);this.authStatus.set('Signing in…');try{await this.auth.login(this.username,this.password,this.newPassword,this.rememberMe);if(this.auth.signedIn()){this.authBusy.set(false);this.closeLogin();this.status.set('Signed in. You can now edit the log.');this.error.set(false);}else this.authStatus.set('Replace your temporary password to finish signing in.');}catch(error){this.authStatus.set(this.auth.error(error));}finally{this.authBusy.set(false);}}
  async logout(){try{await this.auth.logout();this.status.set('Signed out.');}catch{this.status.set('Signed out here. Other sessions will expire normally.');}}
}
