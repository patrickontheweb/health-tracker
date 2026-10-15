export interface Goals {produce:number;lifting:number;cardio:number;}
export const defaultGoals:Goals={produce:5,lifting:2,cardio:150};
export interface Entry {cardio:number;lifting:number;produce:number;revision:number;weight?:number|null;systolic?:number|null;diastolic?:number|null;heartRate?:number|null;sleepHours?:number|null;calories?:number|null;sugarGrams?:number|null;saturatedFatGrams?:number|null;sodiumMg?:number|null;}
export type Measurement='weight'|'systolic'|'diastolic'|'heartRate'|'sleepHours'|'calories'|'sugarGrams'|'saturatedFatGrams'|'sodiumMg';
export function userPage(path:string){
  const parts=path.split('/').filter(Boolean).map(decodeURIComponent);
  if(!parts.length||(parts.length===1&&parts[0]==='settings'))return {username:null,date:null};
  if(parts.length>2||! /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(parts[0]))throw new Error('Invalid user URL.');
  let date:string|null=null;
  if(parts[1]){if(!/^\d{8}$/.test(parts[1]))throw new Error('Use MMDDYYYY in the URL.');date=`${parts[1].slice(4)}-${parts[1].slice(0,2)}-${parts[1].slice(2,4)}`;parseDate(date);}
  return {username:parts[0].toLowerCase(),date};
}
export type Entries=Record<string,Entry>;
export function monthGrid(month:string):(string|null)[]{const first=parseDate(`${month}-01`),offset=(first.getDay()+6)%7,last=new Date(first.getFullYear(),first.getMonth()+1,0,12).getDate();return Array.from({length:Math.ceil((offset+last)/7)*7},(_,i)=>i<offset||i>=offset+last?null:`${month}-${String(i-offset+1).padStart(2,'0')}`);}
export function monthRows(month:string):{week:string;days:(string|null)[]}[]{const days=monthGrid(month);return Array.from({length:days.length/7},(_,index)=>{const row=days.slice(index*7,index*7+7);return {week:weekKeys(row.find((day):day is string=>day!==null)!)[0],days:row};});}
export function shiftMonth(month:string,offset:number):string{const date=parseDate(`${month}-01`);date.setMonth(date.getMonth()+offset);return dateKey(date).slice(0,7);}
export function produceDayState(day:string,today:string,entries:Entries|null,goal=5):'future'|'met'|'below'|'unknown'{if(day>today)return 'future';if(entries===null)return 'unknown';return (entries[day]?.produce||0)>=goal?'met':'below';}
export function dateKey(date=new Date()):string{return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function parseDate(key:string):Date{if(!/^\d{4}-\d{2}-\d{2}$/.test(key))throw new Error('Choose a valid date.');const [y,m,d]=key.split('-').map(Number),date=new Date(y,m-1,d,12);if(dateKey(date)!==key)throw new Error('Choose a valid date.');return date;}
export function weekKeys(key:string):string[]{const date=parseDate(key);date.setDate(date.getDate()-((date.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(date);d.setDate(d.getDate()+i);return dateKey(d);});}
export function totals(entries:Entries,key:string,produceGoal=5){return weekKeys(key).reduce((sum,date)=>{const r=entries[date];if(r){sum.cardio+=r.cardio;sum.lifting+=r.lifting;sum.produceDays+=Number(r.produce>=produceGoal);}return sum;},{cardio:0,lifting:0,produceDays:0});}
export function validateTotals(values:unknown): asserts values is Pick<Entry,'cardio'|'lifting'|'produce'>{if(!values||typeof values!=='object')throw new Error('Invalid daily totals.');for(const key of ['cardio','lifting','produce']){const value=(values as Record<string,unknown>)[key];if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error('Enter whole numbers of zero or more.');}}
