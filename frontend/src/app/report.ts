import {dateKey,parseDate,weekKeys,validateTotals,defaultGoals} from './habits';
import type {Entries,Goals} from './habits';

export function reportDates(start:string,end:string,today=dateKey()):string[]{
  const first=parseDate(start),last=parseDate(end);
  if(start>end)throw new Error('The start date must be on or before the end date.');
  if(end>today)throw new Error('Choose an end date on or before today.');
  const days:string[]=[];
  for(let date=new Date(first);date<=last;date.setDate(date.getDate()+1)){
    if(days.length>=366)throw new Error('Choose up to one year per report.');
    days.push(dateKey(date));
  }
  return days;
}
export async function readReportEntries(start:string,end:string,today:string,
  readWeek:(week:string)=>Promise<{entries:Entries}>,progress:(done:number,total:number)=>void=()=>{},pause=200):Promise<Entries>{
  const dates=reportDates(start,end,today),weeks=[...new Set(dates.map(day=>weekKeys(day)[0]))],entries:Entries={};
  for(let index=0;index<weeks.length;index++){
    const week=weeks[index],result=await readWeek(week),allowed=weekKeys(week);
    for(const [day,entry] of Object.entries(result.entries)){
      if(!allowed.includes(day))throw new Error('The report received an unexpected date.');
      validateTotals(entry);if(!Number.isSafeInteger(entry.revision)||entry.revision<1)throw new Error('The report received an invalid record.');
      if(day>=start&&day<=end)entries[day]=entry;
    }
    progress(index+1,weeks.length);
    if(index<weeks.length-1&&pause>0)await new Promise(resolve=>setTimeout(resolve,pause));
  }
  return entries;
}
export function reportModel(start:string,end:string,entries:Entries,today=dateKey(),goals:Goals=defaultGoals){
  const days=reportDates(start,end,today).map(day=>({day,entry:entries[day]??null}));
  let cardio=0,lifts=0,produce=0,goalDays=0,recorded=0,streak=0,bestStreak=0;
  const weeks=new Map<string,{start:string;days:number;cardio:number;lifts:number;produce:number;full:boolean}>();
  for(const {day,entry} of days){
    if(entry)validateTotals(entry);
    cardio+=entry?.cardio||0;lifts+=entry?.lifting||0;produce+=entry?.produce||0;recorded+=Number(!!entry);
    if((entry?.produce||0)>=goals.produce){goalDays++;streak++;bestStreak=Math.max(bestStreak,streak);}else streak=0;
    const key=weekKeys(day)[0],week=weeks.get(key)||{start:key,days:0,cardio:0,lifts:0,produce:0,full:false};
    week.days++;week.cardio+=entry?.cardio||0;week.lifts+=entry?.lifting||0;week.produce+=entry?.produce||0;week.full=week.days===7;weeks.set(key,week);
  }
  const weekly=[...weeks.values()],complete=weekly.filter(week=>week.full);
  return {start,end,days,weeks:weekly,cardio,lifts,produce,goalDays,recorded,bestStreak,
    cardioWeeks:complete.filter(week=>week.cardio>=goals.cardio).length,liftWeeks:complete.filter(week=>week.lifts>=goals.lifting).length,completeWeeks:complete.length};
}
function escape(value:string):string{return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
function shortDate(day:string):string{return parseDate(day).toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function chart(title:string,labels:string[],values:number[],target:number,color:string,partial:boolean[]=[],produceChart=false):string{
  const width=960,height=250,left=48,top=24,bottom=210,plotWidth=884,max=Math.max(target*1.15,...values)*1.08,unit=plotWidth/Math.max(values.length,1);
  const y=(value:number)=>bottom-(value/max)*(bottom-top);
  const ticks=Array.from({length:4},(_,i)=>{const value=Math.round(max*i/3);return `<line x1="${left}" y1="${y(value)}" x2="${width-28}" y2="${y(value)}" stroke="#e5eaf1"/><text x="${left-9}" y="${y(value)+4}" text-anchor="end" fill="#69768a" font-size="12">${value}</text>`;}).join('');
  const bars=values.map((value,i)=>{const barWidth=Math.max(1,unit*.64),x=left+i*unit+(unit-barWidth)/2,h=bottom-y(value),fill=produceChart?(value>=target?'#31946b':'#cf8297'):color;return `<rect x="${x.toFixed(2)}" y="${y(value).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0,h).toFixed(2)}" rx="${Math.min(4,barWidth/3)}" fill="${fill}" opacity="${partial[i]?.toString()==='true'?'.45':'.9'}"><title>${escape(labels[i])}: ${value}${partial[i]?' (partial week)':''}</title></rect>`;}).join('');
  const labelStep=Math.max(1,Math.ceil(labels.length/10));
  const axis=labels.map((label,i)=>i%labelStep===0||i===labels.length-1?`<text x="${left+(i+.5)*unit}" y="235" text-anchor="middle" fill="#69768a" font-size="11">${escape(label)}</text>`:'').join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}" xmlns="http://www.w3.org/2000/svg"><title>${escape(title)}</title>${ticks}<line x1="${left}" y1="${y(target)}" x2="${width-28}" y2="${y(target)}" stroke="#4a5567" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${width-28}" y="${y(target)-7}" text-anchor="end" fill="#4a5567" font-size="12">Goal ${target}</text>${bars}${axis}</svg>`;
}
export function buildReport(start:string,end:string,entries:Entries,today=dateKey(),generated=new Date(),goals:Goals=defaultGoals):string{
  const model=reportModel(start,end,entries,today,goals),range=`${shortDate(start)}, ${start.slice(0,4)} – ${shortDate(end)}, ${end.slice(0,4)}`;
  const fmt=(n:number)=>n.toLocaleString('en-US'),percentage=Math.round(model.goalDays/model.days.length*100);
  const average=(model.produce/model.days.length).toFixed(1),partial=model.weeks.map(week=>!week.full);
  const weeklyRows=model.weeks.map(week=>`<tr><td>${escape(shortDate(week.start))}</td><td>${week.full?'Full week':`Partial · ${week.days} days`}</td><td>${fmt(week.cardio)} / ${goals.cardio}</td><td>${fmt(week.lifts)} / ${goals.lifting}</td><td>${week.full?(week.cardio>=goals.cardio&&week.lifts>=goals.lifting?'Both goals met':week.cardio>=goals.cardio?'Cardio goal met':week.lifts>=goals.lifting?'Lift goal met':'Below goals'):'Not graded'}</td></tr>`).join('');
  const dailyRows=model.days.map(({day,entry})=>`<tr><td>${escape(parseDate(day).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}))}</td><td>${entry?fmt(entry.cardio):'—'}</td><td>${entry?fmt(entry.lifting):'—'}</td><td>${entry?fmt(entry.produce):'—'}</td><td>${!entry?'Not logged':entry.produce>=goals.produce?'Goal met':'Below '+goals.produce}</td></tr>`).join('');
  const longRange=model.days.length>90;
  const produceValues=longRange?model.weeks.map(week=>Number((week.produce/week.days).toFixed(1))):model.days.map(({entry})=>entry?.produce||0);
  const produceLabels=longRange?model.weeks.map(week=>shortDate(week.start)):model.days.map(({day})=>shortDate(day));
  const produceTitle=longRange?'Average daily servings, by week':'Daily fruits and vegetables';
  const fullGoal=(met:number)=>model.completeWeeks?`${met} of ${model.completeWeeks}`:'No full weeks';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Habit report · ${escape(start)} to ${escape(end)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#20304a;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5}.toolbar{display:flex;justify-content:flex-end;gap:12px;padding:16px 24px;max-width:1060px;margin:auto}.toolbar button{border:1px solid #ccd6e3;background:white;color:#23446f;border-radius:7px;padding:10px 16px;cursor:pointer;font:inherit}.toolbar button:first-child{background:#1650d8;border-color:#1650d8;color:white}.paper{background:white;max-width:1060px;margin:0 auto 36px;padding:42px 48px;box-shadow:0 2px 20px #20304a0a}header{border-bottom:2px solid #e6ecf3;padding-bottom:22px;margin-bottom:26px}.eyebrow{color:#1650d8;letter-spacing:2px;text-transform:uppercase;font-size:11px;font-weight:700}h1{font-size:32px;line-height:1.2;letter-spacing:-.5px;margin:8px 0}h2{font-size:19px;margin:0 0 4px}h3{font-size:15px;margin:0}.muted{color:#69768a}.range{font-size:17px;margin:8px 0}.generated{font-size:11px;margin:0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}.metric{padding:17px;background:#f5f8fc;border-radius:9px;border-top:3px solid #1650d8}.metric:nth-child(2){border-color:#76549b}.metric:nth-child(3){border-color:#31946b}.metric:nth-child(4){border-color:#64748b}.metric strong{display:block;font-size:27px;line-height:1.2;margin:5px 0}.metric small{font-size:11px;color:#69768a}.insights{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0;padding:18px 0;border-top:1px solid #e6ecf3;border-bottom:1px solid #e6ecf3}.insights strong{display:block;font-size:16px}.insights span{font-size:12px;color:#69768a}.chart{margin:30px 0;break-inside:avoid}.chart p{margin:0 0 12px;font-size:12px;color:#69768a}.chart svg{width:100%;height:auto;display:block}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}th{text-align:left;background:#f3f6fa;color:#42536d;padding:10px 9px;border-bottom:1px solid #ccd6e3}td{padding:8px 9px;border-bottom:1px solid #e6ecf3}tbody tr:nth-child(even){background:#fbfcfe}thead{display:table-header-group}tr{break-inside:avoid}.table-section{margin-top:34px}.footnote{font-size:11px;color:#69768a;margin-top:24px}@media(max-width:650px){.paper{padding:24px 18px}.summary{grid-template-columns:repeat(2,1fr)}.insights{grid-template-columns:1fr}.toolbar{flex-wrap:wrap;padding:12px}table{font-size:10px}td,th{padding:6px 4px}}@page{size:A4;margin:13mm}@media print{body{background:white;font-size:11px;color:#20304a;print-color-adjust:exact;-webkit-print-color-adjust:exact}.toolbar{display:none}.paper{box-shadow:none;padding:0;margin:0;max-width:none}.summary{grid-template-columns:repeat(4,1fr)}.metric strong{font-size:23px}.chart{margin:20px 0}.table-section h2{break-after:avoid}footer{margin-top:20px}}</style></head><body>
  <nav class="toolbar" aria-label="Report actions"><button id="print-report">Print / Save as PDF</button><button id="download-report">Download report</button></nav><main class="paper"><header><div class="eyebrow">Health habits</div><h1>Health habit activity report</h1><p class="range">${escape(range)}</p><p class="generated muted">Generated ${escape(generated.toLocaleString('en-US'))}</p></header>
  <p><strong>Tracked goals:</strong> ${goals.cardio} minutes of cardiovascular exercise and ${goals.lifting} weightlifting sessions per Monday–Sunday week; at least ${goals.produce} servings of fruits and vegetables per day.</p><p class="muted">Self-reported activity for personal tracking and discussion with your primary care clinician.</p><section class="summary" aria-label="Report totals"><div class="metric">Cardio minutes<strong>${fmt(model.cardio)}</strong><small>${model.days.filter(({entry})=>(entry?.cardio||0)>0).length} active days</small></div><div class="metric">Lift sessions<strong>${fmt(model.lifts)}</strong><small>Weekly goal: ${goals.lifting} sessions</small></div><div class="metric">Serving goals met<strong>${model.goalDays} / ${model.days.length}</strong><small>${percentage}% of selected days</small></div><div class="metric">Days recorded<strong>${model.recorded} / ${model.days.length}</strong><small>Days with a saved entry</small></div></section>
  <section class="insights"><div><strong>${average} servings/day</strong><span>Average across all selected days</span></div><div><strong>${model.bestStreak}-day streak</strong><span>Longest run with at least 5 servings</span></div><div><strong>${escape(fullGoal(model.cardioWeeks))} cardio · ${escape(fullGoal(model.liftWeeks))} lift</strong><span>Full weeks meeting each exercise goal</span></div></section>
  <section class="chart"><h2>Cardio by week</h2><p>Minutes logged in the selected range. Dashed line: ${goals.cardio}-minute weekly goal. Pale bars represent partial weeks.</p>${chart('Cardio minutes by week',model.weeks.map(week=>shortDate(week.start)),model.weeks.map(week=>week.cardio),goals.cardio,'#4778cf',partial)}</section>
  <section class="chart"><h2>Lifts by week</h2><p>Sessions logged in the selected range. Dashed line: ${goals.lifting}-session weekly goal. Pale bars represent partial weeks.</p>${chart('Lift sessions by week',model.weeks.map(week=>shortDate(week.start)),model.weeks.map(week=>week.lifts),goals.lifting,'#805caa',partial)}</section>
  <section class="chart"><h2>${produceTitle}</h2><p>Green: at least ${goals.produce} servings. Pink: fewer than ${goals.produce}; unlogged days appear as zero. ${longRange?'Longer reports group the daily average by week.':'Each bar represents one selected day.'}</p>${chart(produceTitle,produceLabels,produceValues,goals.produce,'#31946b',[],true)}</section>
  <section class="table-section"><h2>Weekly breakdown</h2><table><thead><tr><th>Week of</th><th>Coverage</th><th>Cardio minutes</th><th>Lift sessions</th><th>Exercise goals</th></tr></thead><tbody>${weeklyRows}</tbody></table></section>
  <section class="table-section"><h2>Daily details</h2><table><thead><tr><th>Date</th><th>Cardio minutes</th><th>Lift sessions</th><th>Servings</th><th>Serving goal</th></tr></thead><tbody>${dailyRows}</tbody></table></section>
  <footer class="footnote">Days without an entry are marked “Not logged” and contribute zero to totals, averages and goal completion. Partial weeks include only the selected dates and are not graded against whole-week exercise goals. This report is a snapshot of saved entries; it contains no login credentials and works offline.</footer></main>
  <script>document.getElementById('print-report').addEventListener('click',()=>window.print());document.getElementById('download-report').addEventListener('click',()=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['<!doctype html>'+document.documentElement.outerHTML],{type:'text/html;charset=utf-8'}));link.download='habit-report-${start}-to-${end}.html';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});</script></body></html>`;
}
