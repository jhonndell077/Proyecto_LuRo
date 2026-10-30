const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const puppeteer=require('puppeteer');
test('mobile startup without requestIdleCallback keeps login visible and renders actual modules on navigation',async()=>{
 const browser=await puppeteer.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{delete window.requestIdleCallback;window.__startupAutoLoginCalls=0;window.addEventListener('DOMContentLoaded',()=>{window.autologinSaasPendiente=()=>{window.__startupAutoLoginCalls++;return false;};});});
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().startsWith('file:')||r.url().startsWith('data:')?r.continue():r.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../public/app.html')).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__startupAutoLoginCalls===1);
  assert.deepEqual(errors,[]);
  assert.equal(await page.$eval('#module-selector',el=>getComputedStyle(el).display),'none');
  assert.notEqual(await page.$eval('#login-overlay',el=>getComputedStyle(el).display),'none');
  await page.evaluate(()=>{sesionUser={user:'fixture-local'};db.modulosCustom=[{owner:'fixture-local',nombre:'REPOSTERÍA Y PRODUCTOS ARTESANALES'}];document.querySelector('#login-overlay').style.display='none';regresarAModulos();});
  assert.equal(await page.$$eval('.module-card',cards=>cards.length),3);
  assert.match(await page.$eval('#module-selector-header',el=>el.textContent),/Centro de modulos/);
  for(const width of [320,375,390,768,1440]){
   await page.setViewport({width,height:844,isMobile:true,hasTouch:true});
   const layout=await page.evaluate(()=>{const s=document.querySelector('#module-selector');const overflow=[...s.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&(r.left<0||r.right>innerWidth+1)});s.scrollTop=s.scrollHeight;const button=s.querySelector('.btn-add-module-float').getBoundingClientRect();return {overflow:overflow.length,reachable:button.top>=0&&button.bottom<=innerHeight+1};});
   assert.equal(layout.overflow,0,'horizontal overflow at '+width);assert.equal(layout.reachable,true,'add module reachable at '+width);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
