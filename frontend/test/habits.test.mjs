import test from 'node:test';
import assert from 'node:assert/strict';
import {weekKeys,totals,validateTotals,monthGrid,monthRows,shiftMonth,produceDayState} from '../src/app/habits.ts';
test('Monday–Sunday weeks cross years',()=>assert.deepEqual(weekKeys('2027-01-03'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']));
test('weekly targets use daily records only from that week',()=>assert.deepEqual(totals({'2026-09-28':{cardio:80,lifting:1,produce:5,revision:1},'2026-10-03':{cardio:70,lifting:1,produce:6,revision:1},'2026-10-05':{cardio:200,lifting:2,produce:5,revision:1}},'2026-10-03'),{cardio:150,lifting:2,produceDays:2}));
test('fractional, negative and missing inputs are rejected',()=>{for(const cardio of [-1,1.5,'5',null,NaN])assert.throws(()=>validateTotals({cardio,lifting:0,produce:0}));assert.throws(()=>weekKeys('2026-02-30'));});
test('calendar fills Monday–Sunday weeks across month and year boundaries',()=>{const days=monthGrid('2024-02');assert.deepEqual(days.slice(0,4),['2024-01-29','2024-01-30','2024-01-31','2024-02-01']);assert.equal(days.filter(day=>day.startsWith('2024-02')).length,29);assert.equal(days.at(-1),'2024-03-03');assert.equal(days.length%7,0);assert.equal(monthGrid('2026-02').filter(day=>day.startsWith('2026-02')).length,28);assert.equal(monthGrid('2027-01')[0],'2026-12-28');assert.equal(monthGrid('2021-02').length,28);assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2027-01',-1),'2026-12');});
test('calendar distinguishes future, unmet goals and unavailable data',()=>{const entries={'2026-10-12':{cardio:0,lifting:0,produce:5,revision:1},'2026-10-13':{cardio:0,lifting:0,produce:4,revision:1}};assert.equal(produceDayState('2026-10-12','2026-10-13',entries),'met');assert.equal(produceDayState('2026-10-13','2026-10-13',entries),'below');assert.equal(produceDayState('2026-10-11','2026-10-13',entries),'below');assert.equal(produceDayState('2026-10-14','2026-10-13',entries),'future');assert.equal(produceDayState('2026-10-12','2026-10-13',null),'unknown');});
test('calendar row totals include the full week across month boundaries',()=>{const rows=monthRows('2026-10');assert.equal(rows[0].week,'2026-09-28');assert.equal(rows.at(-1).week,'2026-10-26');assert.ok(rows.every(row=>row.days.length===7&&row.days.every(Boolean)));assert.deepEqual(rows[0].days,weekKeys(rows[0].week));assert.deepEqual(rows.at(-1).days,weekKeys(rows.at(-1).week));assert.deepEqual(totals({'2026-09-28':{cardio:80,lifting:1,produce:0,revision:1},'2026-10-01':{cardio:70,lifting:1,produce:0,revision:1}},rows[0].week),{cardio:150,lifting:2,produceDays:0});});

test('both edge weeks count neighboring months and agree in either month view',()=>{
  const entries={
    '2026-09-27':{cardio:999,lifting:7,produce:5,revision:1},
    '2026-09-28':{cardio:80,lifting:1,produce:5,revision:1},
    '2026-10-01':{cardio:70,lifting:1,produce:5,revision:1},
    '2026-10-26':{cardio:35,lifting:1,produce:5,revision:1},
    '2026-11-01':{cardio:25,lifting:2,produce:5,revision:1},
    '2026-11-02':{cardio:999,lifting:7,produce:5,revision:1}
  };
  const october=monthRows('2026-10'),november=monthRows('2026-11');
  assert.deepEqual(totals(entries,october[0].week),{cardio:150,lifting:2,produceDays:2});
  assert.deepEqual(totals(entries,october.at(-1).week),{cardio:60,lifting:3,produceDays:2});
  assert.deepEqual(totals(entries,october.at(-1).week),totals(entries,november[0].week));
});

test('public username links support MMDDYYYY and reject invalid dates',async()=>{const {userPage}=await import('../src/app/habits.ts');assert.deepEqual(userPage('/PCMCKENNA/10132026'),{username:'pcmckenna',date:'2026-10-13'});assert.deepEqual(userPage('/alice'),{username:'alice',date:null});assert.deepEqual(userPage('/'),{username:null,date:null});assert.throws(()=>userPage('/alice/02312026'));assert.throws(()=>userPage('/alice/10132026/extra'));});
