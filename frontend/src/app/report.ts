import {dateKey,parseDate,weekKeys,validateTotals,defaultGoals,monthGrid} from './habits';
import type {Entries,Goals} from './habits';

export function reportDates(start:string,end:string,today=dateKey()):string[]{
  const first=parseDate(start),last=parseDate(end);
  if(start>end)throw new Error('The start date must be on or before the end date.');
  if(end>today)throw new Error('Choose a report month on or before today.');
  const days:string[]=[];
  for(let date=new Date(first);date<=last;date.setDate(date.getDate()+1)){
    if(days.length>=366)throw new Error('Choose up to one year per report.');
    days.push(dateKey(date));
  }
  return days;
}
export function reportMonthRange(month:string,today=dateKey()){
  const first=parseDate(`${month}-01`),last=dateKey(new Date(first.getFullYear(),first.getMonth()+1,0,12));
  if(`${month}-01`>today)throw new Error('Choose this month or an earlier month.');
  return {start:`${month}-01`,end:last<today?last:today};
}
export async function readReportEntries(start:string,end:string,today:string,
  readWeek:(week:string)=>Promise<{entries:Entries}>,progress:(done:number,total:number)=>void=()=>{},pause=0):Promise<Entries>{
  const dates=reportDates(start,end,today),weeks=[...new Set(dates.map(day=>weekKeys(day)[0]))],entries:Entries={};
  for(let index=0;index<weeks.length;index++){
    const week=weeks[index],result=await readWeek(week),allowed=weekKeys(week);
    for(const [day,entry] of Object.entries(result.entries)){
      if(!allowed.includes(day))throw new Error('The report received an unexpected date.');
      validateTotals(entry);if(!Number.isSafeInteger(entry.revision)||entry.revision<1)throw new Error('The report received an invalid record.');
      // Retain neighboring-month dates for complete weekly exercise totals.
      if(day<=today)entries[day]=entry;
    }
    progress(index+1,weeks.length);
    if(index<weeks.length-1&&pause>0)await new Promise(resolve=>setTimeout(resolve,pause));
  }
  return entries;
}
export function reportModel(start:string,end:string,entries:Entries,today=dateKey(),goals:Goals=defaultGoals){
  const days=reportDates(start,end,today).map(day=>({day,entry:entries[day]??{cardio:0,lifting:0,produce:0,revision:0}}));
  for(const entry of Object.values(entries))validateTotals(entry);
  const goalDays=days.filter(({entry})=>entry.produce>=goals.produce).length;
  const cardio=days.reduce((sum,{entry})=>sum+(entry?.cardio??0),0),lifts=days.reduce((sum,{entry})=>sum+(entry?.lifting??0),0);
  const weeks=[...new Set(days.map(({day})=>weekKeys(day)[0]))].map(start=>{
    const dates=weekKeys(start),end=dates[6],available=dates.filter(day=>day<=today);
    return {start,end,closed:end<today,elapsedDays:available.length,
      cardio:available.reduce((sum,day)=>sum+(entries[day]?.cardio??0),0),lifts:available.reduce((sum,day)=>sum+(entries[day]?.lifting??0),0)};
  });
  const closed=weeks.filter(week=>week.closed);
  return {start,end,days,weeks,cardio,lifts,goalDays,belowDays:days.length-goalDays,
    completeWeeks:closed.length,cardioWeeks:closed.filter(week=>week.cardio>=goals.cardio).length,liftWeeks:closed.filter(week=>week.lifts>=goals.lifting).length};
}
function escape(value:string):string{return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
function shortDate(day:string):string{return parseDate(day).toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function status(value:number,target:number,closed:boolean){
  if(value>=target)return '<span class="met">Met</span>';
  if(!closed)return '<span class="open">Week still open</span>';
  return '<span class="below">Below target</span>';
}
export function buildReport(start:string,end:string,entries:Entries,today=dateKey(),generated=new Date(),goals:Goals=defaultGoals,username=''):string{
  const model=reportModel(start,end,entries,today,goals),month=start.slice(0,7),monthName=parseDate(start).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const monthToDate=end===today,period=`${shortDate(start)}–${shortDate(end)}, ${end.slice(0,4)}`;
  const fmt=(value:number)=>value.toLocaleString('en-US');
  const weeklyResult=(met:number)=>model.completeWeeks?`${met} of ${model.completeWeeks} closed weeks met`:'No closed weeks yet';
  const weeklyRows=model.weeks.map(week=>`<tr><td><strong>${shortDate(week.start)}–${shortDate(week.end)}</strong>${week.start.slice(0,7)!==month||week.end.slice(0,7)!==month?'<small>Includes neighboring month</small>':''}</td><td><strong>${fmt(week.cardio)} / ${goals.cardio} min</strong>${status(week.cardio,goals.cardio,week.closed)}</td><td><strong>${fmt(week.lifts)} / ${goals.lifting} sessions</strong>${status(week.lifts,goals.lifting,week.closed)}</td><td>${week.elapsedDays} / 7 days included${!week.closed?'<small>In progress</small>':''}</td></tr>`).join('');
  const vegetableDays=monthGrid(month).map(day=>{
    if(day.slice(0,7)!==month)return `<div class="day outside" aria-hidden="true">${Number(day.slice(-2))}</div>`;
    if(day>today)return `<div class="day future" title="${shortDate(day)}: future date, not logged"><span>${Number(day.slice(-2))}</span><strong>—</strong></div>`;
    const servings=entries[day]?.produce??0,state=servings>=goals.produce?'met':'below';
    return `<div class="day ${state}" title="${shortDate(day)}: ${servings} servings"><span>${Number(day.slice(-2))}</span><strong>${servings}</strong></div>`;
  }).join('');
  const futureDays=monthGrid(month).filter(day=>day.slice(0,7)===month&&day>today).length;
  const outcome=`Results: cardio target met in ${model.cardioWeeks} of ${model.completeWeeks} closed weeks; strength target met in ${model.liftWeeks} of ${model.completeWeeks}. Daily serving target met on ${model.goalDays} of ${model.days.length} days.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lifestyle Rx · ${escape(monthName)} summary</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf1f4;color:#20332c;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}.toolbar{max-width:960px;margin:auto;padding:16px 0;display:flex;justify-content:flex-end;gap:12px}.toolbar button{font:inherit;padding:10px 16px;border:1px solid #bacac1;background:white;border-radius:7px;color:#205d45;cursor:pointer}.toolbar button:first-child{background:#205d45;color:white}.paper{background:white;max-width:960px;margin:0 auto 32px;padding:36px 44px;box-shadow:0 2px 16px #20332c0c}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.8px;font-weight:700;color:#37684e}header{display:flex;justify-content:space-between;gap:20px;padding-bottom:18px;border-bottom:2px solid #205d45}h1{margin:6px 0;font-size:30px;font-weight:650;letter-spacing:-.6px;line-height:1.15}.subtitle{margin:0;color:#5d6e65}.account{text-align:right;font-size:12px;align-self:flex-end}.account strong{display:block;font-size:14px}h2{font-size:17px;margin:0 0 8px}p{margin:6px 0}.lead{padding:16px 0 12px;font-size:14px}.plan{width:100%;border-collapse:collapse;margin-bottom:20px}.plan th{text-align:left;font-size:10px;letter-spacing:.5px;text-transform:uppercase;background:#f0f5f1;color:#476253;padding:9px 10px}.plan td{padding:11px 10px;border-bottom:1px solid #dfe8e1;vertical-align:top}.plan td strong{display:block;font-size:15px}.plan td small{display:block;color:#63746a;font-size:11px;margin-top:3px}.plan .target{font-size:21px;font-weight:650;white-space:nowrap}.plan .target span{display:block;font-size:11px;font-weight:400;color:#5d6e65}.section{margin-top:22px;break-inside:avoid}.section-title{display:flex;justify-content:space-between;align-items:baseline;gap:20px}.section-title p,.muted{color:#63746a;font-size:11px}.weeks{width:100%;border-collapse:collapse;font-size:12px}.weeks th{text-align:left;font-size:11px;padding:8px 9px;border-bottom:1px solid #a9bdb0;color:#4b6556}.weeks td{padding:9px;border-bottom:1px solid #e2e9e4;vertical-align:top}.weeks td strong{font-size:12px;display:block;font-weight:600}.weeks td small,.weeks td span{display:block;font-size:10px;margin-top:3px}.met{color:#216247}.below{color:#865928}.unknown,.open{color:#6a7470}.nutrition-head{display:flex;justify-content:space-between;gap:16px}.nutrition-head p{font-size:12px;margin:0}.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;margin:8px 0 10px;color:#52665a}.legend span{display:flex;align-items:center;gap:5px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px}.legend .met,.day.met{background:#e4f2e8}.legend .below,.day.below{background:#fbf0dc}.legend .future,.day.future{background:#f0f2f3}.days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.weekday{text-align:center;font-size:10px;color:#63746a;margin-bottom:3px}.day{min-height:34px;display:flex;align-items:center;justify-content:space-between;padding:5px 9px;border-radius:4px;border:1px solid transparent;color:#344a3d}.day span{font-size:10px}.day strong{font-size:13px;font-weight:650}.day.outside{color:#b6c0b9;background:#fafbfa;font-size:10px}.note{font-size:10px;color:#63746a;margin-top:9px;line-height:1.5}footer{margin-top:20px;padding-top:12px;border-top:1px solid #dfe8e1;font-size:10px;color:#63746a}footer p{margin:4px 0}.coverage{font-weight:600;color:#40584a}tr{break-inside:avoid}thead{display:table-header-group}@media(max-width:650px){.paper{padding:24px 16px}.toolbar{padding:12px;flex-wrap:wrap}h1{font-size:25px}header{flex-direction:column;gap:8px}.account{text-align:left;align-self:flex-start}.plan td,.plan th{padding:8px 5px}.plan .target{font-size:18px}.plan td strong{font-size:12px}.weeks{font-size:10px}.weeks th,.weeks td{padding:7px 4px}.weeks td strong{font-size:10px}.nutrition-head,.section-title{display:block}.day{padding:5px;min-height:33px}.day strong{font-size:12px}.legend{gap:9px}}@page{size:letter;margin:12mm}@media print{body{background:white;font-size:11px;print-color-adjust:exact;-webkit-print-color-adjust:exact}.toolbar{display:none}.paper{padding:0;margin:0;box-shadow:none;max-width:none}h1{font-size:26px}.lead{font-size:12px;padding:12px 0 10px}.plan{margin-bottom:12px}.plan td{padding:8px 9px}.plan .target{font-size:19px}.section{margin-top:15px}.weeks td{padding:7px 8px}.day{min-height:29px;padding:4px 8px}footer{margin-top:14px;padding-top:9px}}
@media print{header{padding-bottom:12px;gap:12px}h1{font-size:22px;margin:4px 0}.eyebrow{font-size:9px}.subtitle{font-size:11px}.account{font-size:10px}.account strong{font-size:12px}.lead{font-size:10.5px;padding:9px 0 8px}.plan{margin-bottom:8px}.plan th{font-size:8px;padding:6px 8px}.plan td{padding:6px 8px}.plan td strong{font-size:11px}.plan td small,.plan .target span{font-size:9px}.plan .target{font-size:17px}.section{margin-top:12px}.section h2{font-size:13px;margin-bottom:5px}.section-title p{font-size:9px}.weeks th{font-size:9px;padding:6px 7px}.weeks td{font-size:10px;padding:5px 7px}.weeks td strong{font-size:10px}.weeks td small,.weeks td span{font-size:8.5px;margin-top:2px}.note{font-size:8.5px;margin-top:6px}.nutrition-head p{font-size:10px}.legend{font-size:8.5px;margin:5px 0 7px}.days{gap:3px}.weekday{font-size:9px}.day{min-height:23px;padding:3px 8px}.day span{font-size:9px}.day strong{font-size:11px}footer{font-size:8.5px;margin-top:9px;padding-top:7px}}
</style></head><body><nav class="toolbar" aria-label="Report actions"><button id="print-report">Print / Save as PDF</button><button id="download-report">Download report</button></nav>
<main class="paper"><header><div><div class="eyebrow">Lifestyle Rx · Prescribed activity & nutrition</div><h1>${escape(monthName)}</h1><p class="subtitle">${monthToDate?'Month-to-date':'Month-end'} summary · ${escape(period)}</p></div><div class="account">${username?'<strong>'+escape(username)+'</strong>':''}For review with your NP</div></header>
<p class="lead">${escape(outcome)}</p>
<table class="plan" aria-label="Prescribed plan and results"><thead><tr><th>Prescribed plan</th><th>Target</th><th>This month’s results</th></tr></thead><tbody>
<tr><td><strong>Cardiovascular activity</strong></td><td class="target">${goals.cardio} minutes<span>per Monday–Sunday week</span></td><td><strong>${weeklyResult(model.cardioWeeks)}</strong><small>${fmt(model.cardio)} minutes recorded within ${escape(monthName)}</small></td></tr>
<tr><td><strong>Strength training</strong></td><td class="target">${goals.lifting} sessions<span>per Monday–Sunday week</span></td><td><strong>${weeklyResult(model.liftWeeks)}</strong><small>${fmt(model.lifts)} sessions recorded within ${escape(monthName)}</small></td></tr>
<tr><td><strong>Vegetable / produce servings</strong></td><td class="target">${goals.produce} servings<span>every day</span></td><td><strong>${model.goalDays} of ${model.days.length} days at target</strong><small>${model.belowDays} below target${futureDays?` · ${futureDays} future days not logged`:``}</small></td></tr>
</tbody></table>
<section class="section"><div class="section-title"><h2>Weekly exercise against the prescription</h2><p>Monday–Sunday · whole weeks</p></div><table class="weeks"><thead><tr><th>Week</th><th>Cardio</th><th>Strength</th><th>Days included</th></tr></thead><tbody>${weeklyRows}</tbody></table>
<p class="note">Boundary weeks include dates in the neighboring month, so weekly targets are never prorated. Monthly totals above include only ${escape(shortDate(start))}–${escape(shortDate(end))}.${model.weeks.some(week=>!week.closed)?' A week still open is not counted among closed weeks.':''}</p></section>
<section class="section"><div class="nutrition-head"><h2>Daily servings · target ${goals.produce} per day</h2><p><strong>${model.goalDays}</strong> at target · <strong>${model.belowDays}</strong> below${futureDays?` · <strong>${futureDays}</strong> future days not logged`:``}</p></div>
<div class="legend"><span><i class="met"></i>At least ${goals.produce}</span><span><i class="below"></i>Below ${goals.produce}</span><span><i class="future"></i>— Future / not logged</span><span>Bold number = servings</span></div>
<div class="days" aria-label="Daily recorded servings">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>'<div class="weekday">'+day+'</div>').join('')}${vegetableDays}</div></section>
<footer><p class="coverage">Assessment covers ${model.days.length} days through ${shortDate(end)}.</p><p>Self-reported records. Missing entries through the report end date count as zero for cardio, strength, and servings. Only future dates remain unlogged. The tracker combines fruit and vegetable servings, so these records cannot confirm vegetables separately. Targets shown are the current saved prescription settings; historical target changes are not recorded.</p><p>Generated ${escape(generated.toLocaleString('en-US'))}. Saved report contains no sign-in credentials.</p></footer></main>
<script>document.getElementById('print-report').addEventListener('click',()=>window.print());document.getElementById('download-report').addEventListener('click',()=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['<!doctype html>'+document.documentElement.outerHTML],{type:'text/html;charset=utf-8'}));link.download='lifestyle-rx-${month}-summary.html';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});</script></body></html>`;
}
