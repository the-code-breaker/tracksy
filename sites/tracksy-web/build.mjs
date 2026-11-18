import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
const root=dirname(fileURLToPath(import.meta.url)),workspace=resolve(root,'../..'),mobile=resolve(workspace,'apps/mobile'),dist=resolve(root,'public');
const require=createRequire(import.meta.url),{generateImageAsync}=require('@expo/image-utils');
// Recreate only this generated directory. Old static route aliases can shadow
// the runtime catch-all and refer to an obsolete JavaScript bundle.
if(dist!==resolve(workspace,'sites/tracksy-web/public'))throw Error('Unexpected generated output directory');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});await cp(resolve(mobile,'dist'),dist,{recursive:true});
await mkdir(resolve(dist,'icons'),{recursive:true});
for(const size of[192,512]){
 const image=await generateImageAsync({projectRoot:mobile},{src:resolve(mobile,'assets/branding/icon.png'),width:size,height:size,resizeMode:'contain',backgroundColor:'#ffffff'});
 await writeFile(resolve(dist,`icons/icon-${size}.png`),image.source);
}
let html=await readFile(resolve(dist,'index.html'),'utf8');
html=html.replace(/<meta name="viewport"[^>]*>/,'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">');
const entry=html.match(/src="([^" ]+entry-[^" ]+\.js)"/)?.[1];if(!entry)throw Error('Expected the actual Expo app export');
const digest=createHash('sha256').update(await readFile(resolve(dist,'.'+entry))).update(await readFile(fileURLToPath(import.meta.url))).digest('hex').slice(0,16);
html=html.replace('</head>',`<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Tracksy"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="theme-color" content="#f7faf9"><meta name="color-scheme" content="light dark"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/icon-192.png"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;overscroll-behavior:none}body{position:fixed;inset:0;background:#f7faf9}#root{height:var(--tracksy-height,100dvh);min-height:0;overflow:hidden}[aria-modal=true]{height:var(--tracksy-height,100dvh)!important;bottom:auto!important}input:not([aria-label="Total amount"]),textarea{font-size:16px!important}button,input,textarea{font-family:inherit}a,[role=button],[role=tab],[role=radio]{-webkit-tap-highlight-color:transparent;touch-action:manipulation}@media(prefers-color-scheme:dark){body{background:#11191c}}</style><script src="/pwa.js" defer></script></head>`);
await writeFile(resolve(dist,'index.html'),html);
await writeFile(resolve(dist,'manifest.webmanifest'),JSON.stringify({id:'/',name:'Tracksy',short_name:'Tracksy',description:'Shared expenses, made simple.',start_url:'/',scope:'/',display:'standalone',background_color:'#f7faf9',theme_color:'#f7faf9',icons:[192,512].map(size=>({src:`/icons/icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))}));
await writeFile(resolve(dist,'pwa.js'),`(()=>{const resize=()=>document.documentElement.style.setProperty('--tracksy-height',Math.round(window.visualViewport?.height||window.innerHeight)+'px');resize();window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));})();`);
await writeFile(resolve(dist,'sw.js'),`const CACHE='tracksy-shell-${digest}';self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/index.html','${entry}','/icons/icon-192.png','/icons/icon-512.png'])).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('tracksy-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/index.html')));return;}if(url.search||!['/_expo/','/assets/','/icons/'].some(prefix=>url.pathname.startsWith(prefix)))return;event.respondWith(caches.open(CACHE).then(async cache=>{const existing=await cache.match(request);if(existing)return existing;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}));});`);
new Script(await readFile(resolve(dist,'sw.js'),'utf8'));
new Script(await readFile(resolve(dist,'pwa.js'),'utf8'));
await writeFile(resolve(root,'app-shell.ts'),'export default '+JSON.stringify(html)+';\n');
const app=JSON.parse(await readFile(resolve(mobile,'app.json'),'utf8'));
await writeFile(resolve(dist,'app-build.json'),JSON.stringify({appVersion:app.expo.version,source:'apps/mobile',entry,digest}));
console.log(`Prepared the actual Tracksy ${app.expo.version} app export with mobile viewport, Home Screen icons and a static-only offline shell.`);
