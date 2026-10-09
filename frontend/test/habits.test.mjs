import test from 'node:test';
import assert from 'node:assert/strict';
import {weekKeys,totals,validateTotals} from '../src/app/habits.ts';
test('Monday–Sunday weeks cross years',()=>assert.deepEqual(weekKeys('2027-01-03'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']));
test('weekly targets use daily records only from that week',()=>assert.deepEqual(totals({'2026-09-28':{cardio:80,lifting:1,produce:5,revision:1},'2026-10-03':{cardio:70,lifting:1,produce:6,revision:1},'2026-10-05':{cardio:200,lifting:2,produce:5,revision:1}},'2026-10-03'),{cardio:150,lifting:2,produceDays:2}));
test('fractional, negative and missing inputs are rejected',()=>{for(const cardio of [-1,1.5,'5',null,NaN])assert.throws(()=>validateTotals({cardio,lifting:0,produce:0}));assert.throws(()=>weekKeys('2026-02-30'));});
