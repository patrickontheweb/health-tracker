import {Component,DestroyRef,ElementRef,OnInit,computed,inject,signal,viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AuthService} from './auth.service';
import {ConfigService} from './config.service';
import {HabitsApiService} from './habits-api.service';
import {dateKey,parseDate,weekKeys,totals,validateTotals,monthGrid,monthRows,shiftMonth,produceDayState} from './habits';
import type {Entries,Entry} from './habits';
import {registerPublicReadTool,browserModelContext} from './browser-tools';
import {buildReport,readReportEntries,reportDates} from './report';
import {buildVersion} from './build-version';
@Component({selector:'app-root',standalone:true,imports:[FormsModule],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit {
  readonly buildVersion=buildVersion;
  auth=inject(AuthService);config=inject(ConfigService);private api=inject(HabitsApiService);
  today=dateKey();selectedDate=signal(this.today);entries=signal<Entries>({});loading=signal(false);saving=signal(false);loaded=signal(false);status=signal('');error=signal(false);syncLabel=signal('Connecting to your shared log…');
  days=computed(()=>weekKeys(this.selectedDate()));weekTotals=computed(()=>totals(this.entries(),this.selectedDate()));daily=computed(()=>this.entries()[this.selectedDate()]);
  cardio=0;lifting=0;produce=0;username='';password='';newPassword='';authBusy=signal(false);authStatus=signal('');private requestId=0;
  readonly produceIcons=['🥕','🍌','🍇','🍎','🥦'];
  produceSelections=[false,false,false,false,false];
  cardioSaving=signal(false);private cardioSave:Promise<void>|null=null;
  calendarMonth=signal(this.today.slice(0,7));calendarEntries=signal<Entries>({});calendarLoaded=signal(false);calendarLoading=signal(false);calendarError=signal('');private calendarRequestId=0;
  calendarDays=computed(()=>monthGrid(this.calendarMonth()));
  calendarRows=computed(()=>monthRows(this.calendarMonth()));
  calendarWeekTotals(week:string){return totals(this.calendarEntries(),week);}
  weekGoalMissed(week:string,goal:'cardio'|'lifting'){return this.calendarLoaded()&&weekKeys(week)[6]<this.today&&this.calendarWeekTotals(week)[goal]<(goal==='cardio'?150:2);}
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
      if(this.auth.token&&this.cardio!==(this.daily()?.cardio||0))throw new Error('Your cardio change could not be saved. Correct it before exporting.');
      const entries=await readReportEntries(start,end,this.today,week=>this.api.readWeek(week),(done,total)=>this.exportStatus.set(`Loading saved entries: ${done} of ${total} weeks…`));
      if(report.closed)throw new Error('The report tab was closed. Generate it again when you are ready.');
      report.document.open();report.document.write(buildReport(start,end,entries,this.today));report.document.close();
      this.exportStatus.set('Report ready. Use Print / Save as PDF in the report tab.');
    }catch(error){report?.close();this.exportError.set(true);this.exportStatus.set(error instanceof Error&&!(error as {status?:number}).status?error.message:'Unable to load the report. Please try again.');}
    finally{this.exportBusy.set(false);}
  }
  private destroyRef=inject(DestroyRef);
  ngOnInit(){this.loadWeek();this.loadCalendar();const lifecycle=new AbortController();this.destroyRef.onDestroy(()=>lifecycle.abort());registerPublicReadTool(()=>{if(!this.loaded())throw new Error('Shared progress has not loaded.');return {week:this.days(),entries:this.entries(),totals:this.weekTotals()};},lifecycle.signal,browserModelContext());}
  calendarState(day:string){return produceDayState(day,this.today,this.calendarLoaded()?this.calendarEntries():null);}
  calendarProduceIcons(day:string){return this.produceIcons.slice(0,Math.min(5,this.calendarEntries()[day]?.produce||0));}
  calendarLabel(day:string){const state=this.calendarState(day),entry=this.calendarEntries()[day];return `${parseDate(day).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}: ${state==='future'?'future date':state==='unknown'?'progress not loaded':`${entry?.produce||0} servings, ${state==='met'?'goal reached':'fewer than five'}, ${entry?.lifting||0} lift sessions, ${entry?.cardio||0} cardio minutes`}`;}
  async changeMonth(offset:number){if(this.saving())return;this.calendarMonth.set(shiftMonth(this.calendarMonth(),offset));await this.loadCalendar();}
  async calendarToday(){if(this.saving())return;this.calendarMonth.set(this.today.slice(0,7));await this.loadCalendar();}
  async loadCalendar(){
    if(!this.config.configured||this.saving())return;
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
  private savedEntry(day:string,entry:Entry){this.entries.update(entries=>({...entries,[day]:entry}));if(this.calendarRows().some(row=>weekKeys(row.week).includes(day)))this.calendarEntries.update(entries=>({...entries,[day]:entry}));}
  shortDate(key:string){return parseDate(key).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  dayLabel(key:string){return parseDate(key).toLocaleDateString(undefined,{weekday:'short',day:'numeric'});}
  private fill(){const entry=this.daily();this.cardio=entry?.cardio||0;this.lifting=entry?.lifting||0;this.produce=entry?.produce||0;this.produceSelections=this.produceIcons.map((_,index)=>index<this.produce);}
  saveCardio(){
    if(this.cardioSave)return this.cardioSave;
    if(this.saving()||this.loading()||!this.loaded()||!this.auth.token||this.cardio===(this.daily()?.cardio||0))return Promise.resolve();
    this.cardioSaving.set(true);
    this.cardioSave=this.persistCardio().finally(()=>{this.cardioSaving.set(false);this.cardioSave=null;});
    return this.cardioSave;
  }
  private async persistCardio(){
    if(this.saving()||this.loading()||!this.loaded()||!this.auth.token)return;
    const day=this.selectedDate(),saved=this.daily();
    if(this.cardio===(saved?.cardio||0))return;
    try{
      if(day>dateKey())throw new Error('Log a completed day, not a future date.');
      if(this.cardio>999)throw new Error('Enter cardio minutes from 0 to 999.');
      const entry={cardio:this.cardio,lifting:saved?.lifting||0,produce:saved?.produce||0};
      validateTotals(entry);this.saving.set(true);this.error.set(false);this.status.set('Saving cardio…');
      const result=await this.api.save(day,entry,saved?.revision||0);
      this.savedEntry(day,result.entry);this.status.set('Cardio saved to the shared log.');
    }catch(error){this.status.set(error instanceof Error&&!(error as {status?:number}).status&&error.name!=='TimeoutError'?error.message:this.api.error(error));this.error.set(true);}
    finally{this.saving.set(false);}
  }
  async toggleLifting(){
    if(this.cardioSave){await this.cardioSave;if(this.error())return;}
    if(this.saving()||this.loading()||!this.loaded()||!this.auth.token)return;
    if(this.selectedDate()>dateKey()){this.status.set('Log a completed day, not a future date.');this.error.set(true);return;}
    const previous=this.lifting,day=this.selectedDate(),saved=this.daily();
    this.lifting=this.lifting>0?0:1;
    this.saving.set(true);this.error.set(false);this.status.set('Saving weightlifting…');
    try{
      const result=await this.api.save(day,{cardio:saved?.cardio||0,lifting:this.lifting,produce:saved?.produce||0},saved?.revision||0);
      this.savedEntry(day,result.entry);
      this.status.set(this.lifting?'Weightlifting session saved.':'Weightlifting session removed.');
    }catch(error){
      this.lifting=previous;this.status.set(this.api.error(error));this.error.set(true);
    }finally{this.saving.set(false);}
  }
  async toggleProduce(index:number){
    if(this.cardioSave){await this.cardioSave;if(this.error())return;}
    if(this.saving()||this.loading()||!this.loaded()||!this.auth.token)return;
    if(this.selectedDate()>dateKey()){this.status.set('Log a completed day, not a future date.');this.error.set(true);return;}
    const previousSelections=[...this.produceSelections],previousTotal=this.produce;
    this.produceSelections=this.produceSelections.map((selected,i)=>i===index?!selected:selected);
    this.produce=this.produceSelections.filter(Boolean).length;
    const day=this.selectedDate(),saved=this.daily();
    this.saving.set(true);this.error.set(false);this.status.set('Saving serving…');
    try{
      // A quick serving save must not submit unfinished exercise fields.
      const result=await this.api.save(day,{cardio:saved?.cardio||0,lifting:saved?.lifting||0,produce:this.produce},saved?.revision||0);
      this.savedEntry(day,result.entry);
      this.status.set(`${this.produce} of 5 servings saved${this.produce===5?' · Goal reached!':'.'}`);
    }catch(error){
      this.produceSelections=previousSelections;this.produce=previousTotal;
      this.status.set(this.api.error(error));this.error.set(true);
    }finally{this.saving.set(false);}
  }
  async selectDate(key:string){if(this.saving()||!key)return;try{parseDate(key);const previous=this.days()[0];this.selectedDate.set(key);if(key.slice(0,7)!==this.calendarMonth()){this.calendarMonth.set(key.slice(0,7));this.loadCalendar();}this.status.set('');this.fill();if(previous!==this.days()[0]||!this.loaded())await this.loadWeek();}catch{this.status.set('Choose a valid date.');this.error.set(true);}}
  async loadWeek(){if(this.saving())return;if(!this.config.configured){this.syncLabel.set('Preview only · connect AWS to load and save shared progress.');return;}const id=++this.requestId,week=this.days()[0];this.loading.set(true);this.loaded.set(false);this.syncLabel.set('Loading shared progress…');try{const result=await this.api.readWeek(week);if(id!==this.requestId)return;for(const [day,entry] of Object.entries(result.entries)){if(!this.days().includes(day))throw new Error('Unexpected entry');validateTotals(entry);if(!Number.isSafeInteger(entry.revision)||entry.revision<1)throw new Error('Invalid revision');}this.entries.set(result.entries);this.loaded.set(true);this.fill();this.syncLabel.set(`Updated ${new Date().toLocaleString('en-US',{month:'2-digit',day:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit'}).replace(',','')}`);this.status.set('');}catch(error){if(id===this.requestId){this.status.set(this.api.error(error));this.error.set(true);this.syncLabel.set('Unable to load shared progress.');}}finally{if(id===this.requestId)this.loading.set(false);}}
  async save(){if(this.saving())return;try{if(!this.auth.token)throw new Error('Sign in to edit this log.');if(!this.loaded())throw new Error('Load progress before saving.');if(this.selectedDate()>dateKey())throw new Error('Log a completed day, not a future date.');const entry={cardio:this.cardio,lifting:this.lifting,produce:this.produce};validateTotals(entry);this.saving.set(true);this.status.set('Saving…');this.error.set(false);const day=this.selectedDate(),result=await this.api.save(day,entry,this.daily()?.revision||0);this.savedEntry(day,result.entry);this.status.set('Day saved to the shared log.');}catch(error){this.status.set(error instanceof Error&&!(error as {status?:number}).status&&error.name!=='TimeoutError'?error.message:this.api.error(error));this.error.set(true);}finally{this.saving.set(false);}}
  openLogin(){if(this.auth.canDevLogin){this.devLogin();return;}if(!this.config.configured){this.status.set('AWS must be connected before sign-in is available.');this.error.set(true);return;}this.authStatus.set('');this.dialog()?.nativeElement.showModal();}
  async devLogin(){if(this.authBusy())return;this.authBusy.set(true);try{await this.auth.devLogin();this.status.set('Signed in locally.');this.error.set(false);}catch(error){this.status.set(this.auth.error(error));this.error.set(true);}finally{this.authBusy.set(false);}}
  closeLogin(){if(this.authBusy())return;this.dialog()?.nativeElement.close();this.password='';this.newPassword='';this.auth.challenge.set(null);}
  async login(){this.authBusy.set(true);this.authStatus.set('Signing in…');try{await this.auth.login(this.username,this.password,this.newPassword);if(this.auth.signedIn()){this.authBusy.set(false);this.closeLogin();this.status.set('Signed in. You can now edit the log.');this.error.set(false);}else this.authStatus.set('Replace your temporary password to finish signing in.');}catch(error){this.authStatus.set(this.auth.error(error));}finally{this.authBusy.set(false);}}
  async logout(){try{await this.auth.logout();this.status.set('Signed out.');}catch{this.status.set('Signed out here. Other sessions will expire normally.');}}
}
