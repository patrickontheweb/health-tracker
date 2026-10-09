import test from 'node:test';
import assert from 'node:assert/strict';
import {registerPublicReadTool} from '../src/app/browser-tools.ts';
test('public read tool exposes loaded state and rejects extra arguments',()=>{let tool;const lifecycle=new AbortController();registerPublicReadTool(()=>({cardio:150}),lifecycle.signal,{registerTool(value,options){tool=value;assert.equal(options.signal,lifecycle.signal);}});assert.equal(tool.name,'read_health_habits');assert.equal(tool.annotations.readOnlyHint,true);assert.deepEqual(tool.execute({}),{cardio:150});assert.throws(()=>tool.execute({date:'bad'}));assert.throws(()=>tool.execute([]));});
test('an unavailable browser API is harmless',()=>assert.doesNotThrow(()=>registerPublicReadTool(()=>({}),new AbortController().signal)));
