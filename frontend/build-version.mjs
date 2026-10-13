import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
let version='unknown';
try{
  version=execFileSync('git',['rev-parse','--short=7','HEAD'],{encoding:'utf8'}).trim();
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())version+=' (local changes)';
}catch{}
writeFileSync(new URL('./src/app/build-version.ts',import.meta.url),`export const buildVersion=${JSON.stringify(version)};\n`);
