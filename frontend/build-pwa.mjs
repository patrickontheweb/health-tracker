import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root='dist/health-habits/browser';
const files=(await readdir(root)).filter(name=>name==='index.html'||name==='manifest.webmanifest'||/\.(js|css)$/.test(name)&&name!=='sw.js');
files.push('icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png');
const hash=createHash('sha256');for(const file of files)hash.update(await readFile(join(root,file)));
const cache='lifestylerx-shell-'+hash.digest('hex').slice(0,16);
// Only the generic app shell is cached. Config, tokens, API responses and logs
// always use the network; a failed save is never represented as a successful save.
await writeFile(join(root,'sw.js'),`const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('lifestylerx-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(cache=>cache.match('/index.html')).then(cached=>cached||fetch(event.request)));return;}
 if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(cached=>cached||fetch(event.request)));
});
`);
