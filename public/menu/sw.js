const CACHE='the-proyect-offline-v35-menu-sync';
const CORE=["luro-config.js?v=20261030-1","luro-connection.js?v=20261101-menu-sync", "luro-connection.css?v=20261031-member-cards", "table-view.js", "styles.css", "reference-panel.css", "website.js", "nutrition.css", "website.css", "offline.js", "burger-3d.css", "refinement.js", "manifest.webmanifest", "offline.css", "burger-3d.js", "mobile.css", "experience.css", "motion.css", "gastronomic.css", "nutrition-swipe.css", "refinement.css", "professional.css", "diagram.js", "diagram.css", "app.js", "dominican.css", "motion.js", "experience.js", "dish-views.js", "dish-views.css", "image-edges.css", "table-view.css", "nutrition-swipe.js", "nutrition.js", "professional.js"];
const OPTIONAL=["assets/menu-photos/cordero.svg", "assets/menu-photos/yaroa.svg", "assets/menu-photos/langosta.svg", "assets/menu-photos/pancakes.svg", "assets/menu-photos/chimi.svg", "assets/menu-photos/alitas.svg", "assets/menu-photos/hamburguesa.svg", "assets/dish-views/pancakes.png", "assets/dish-views/alitas.png", "assets/dish-views/yaroa.png", "assets/dish-views/hamburguesa.png", "assets/dish-views/cordero.png", "assets/dish-views/chimi.png", "assets/dish-views/langosta.png", "assets/models/photo-manifest.json"];
const BASE=new URL('./',self.location.href);
CORE.push('mobile-version.css?v=20261031-restore-wine');
CORE.push('sommelier.css?v=20261031-restore-wine');
const HOME=new URL('./',BASE).href;
async function save(cache,file,html=false){
 const url=new URL(file,BASE).href;
 const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));
 if(!response.ok)throw Error('download:'+file+':'+response.status);
 if(html&&!(await response.clone().text()).includes('id="menu-section"'))throw Error('session_required');
 // Store the app under its canonical URL, even when hosting redirects index.html.
 await cache.put(html?HOME:url,html?new Response(await response.text(),{status:200,headers:{'Content-Type':'text/html; charset=utf-8'}}):response);
}
async function notify(data){for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(data);}
async function extras(){const cache=await caches.open(CACHE);for(const file of OPTIONAL){try{await save(cache,file);}catch(error){await notify({type:'OFFLINE_OPTIONAL_FAILED',file});}}}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  // index.html may redirect to / on the production host. This is valid app HTML.
  await save(cache,'./',true);
  for(const file of CORE)await save(cache,file);
  await self.skipWaiting();
 }catch(error){await notify({type:'OFFLINE_ERROR',code:error.name,detail:error.message});await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 await notify({type:'OFFLINE_READY'});
 for(const key of await caches.keys())if(key.startsWith('the-proyect-offline-')&&key!==CACHE)await caches.delete(key);
 await extras();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='OFFLINE_STATUS')event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);const ready=!!(await cache.match(HOME));
  event.source?.postMessage({type:ready?'OFFLINE_READY':'OFFLINE_NOT_READY'});
 })());
 if(event.data?.type==='OFFLINE_RETRY_IMAGES')event.waitUntil(extras());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin)return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{const response=await fetch(request);if(response.ok&&!response.redirected)return response;return await cache.match(HOME)||response;}
   catch{ return await cache.match(HOME)||Response.error(); }
  })());return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);const saved=await cache.match(request);if(saved)return saved;
  const response=await fetch(request);
  if(response.ok&&url.pathname.startsWith(BASE.pathname+'assets/'))event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
  return response;
 })());
});
