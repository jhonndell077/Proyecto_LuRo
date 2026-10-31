const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const puppeteer=require('puppeteer');
test('notifications stay separate from LuRo and microphone activation stays inside the assistant',async()=>{
 const browser=await puppeteer.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('file:')||r.url().startsWith('data:')?r.continue():r.abort());
  await page.goto(pathToFileURL(path.resolve(__dirname,'../public/app.html')).href,{waitUntil:'load'});
  assert.equal(await page.$('#luro-activar-mic-btn'),null);
  assert.ok(await page.$('#luro-mic-btn-pub'));
  await page.evaluate(()=>{document.querySelector('#login-overlay').style.display='none';document.querySelector('#module-selector').style.display='none';document.querySelector('#main-content').style.display='block';});
  for(const width of [320,390,768,1440]){
   await page.setViewport({width,height:844});
   const bounds=await page.evaluate(()=>{
    const notice=document.querySelector('#menu-floating-notice');notice.hidden=false;notice.innerHTML='<p>2 pedidos esperan en caja.</p><button class="btn">Revisar pedidos</button><p>1 tarea pendiente.</p><button class="btn">Abrir tareas</button>';
    const a=notice.getBoundingClientRect(),b=document.querySelector('#luro-assistant-fab').getBoundingClientRect();return {overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,inView:a.left>=0&&a.right<=innerWidth&&a.top>=0,gap:b.top-a.bottom};
   });
   assert.equal(bounds.overlap,false,'overlap at '+width);assert.equal(bounds.inView,true,'bounds at '+width);assert.ok(bounds.gap>=12,'spacing at '+width);
   if(width===390){fs.mkdirSync(path.resolve(__dirname,'../tmp/floating-controls'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../tmp/floating-controls/mobile.png')});}
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
