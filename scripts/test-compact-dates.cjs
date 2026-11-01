const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const puppeteer=require('puppeteer');
test('compact date ranges keep results visible and preserve live filtering',async()=>{
 const browser=await puppeteer.launch({channel:'chrome',headless:true});try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('file:')||r.url().startsWith('data:')?r.continue():r.abort());
  await page.setViewport({width:390,height:844});await page.goto(pathToFileURL(path.resolve(__dirname,'../public/app.html')).href,{waitUntil:'load'});
  await page.evaluate(()=>{sesionUser={user:'fixture',role:'admin',activo:true};esColaboradorSesion=false;moduloActual='COCINA';moduloVistaActual='COCINA';validarAccesoCuentaActual=()=>true;document.getElementById('login-overlay').style.display='none';document.getElementById('module-selector').style.display='none';document.getElementById('main-content').style.display='block';const common={owner:'fixture',modulo:'COCINA'};db.ventas=[{...common,fecha:'2026-11-01T10:00:00',plato:'Venta noviembre',totalVenta:200,ganancia:80},{...common,fecha:'2026-10-20T10:00:00',plato:'Venta octubre',totalVenta:100,ganancia:30}];db.entradas=[{...common,fecha:'2026-11-01T10:00:00',producto:'Entrada noviembre',cant:10,medida:'g'}];db.decomisos=[];});
  for(const width of [320,390,768,1440]){
   await page.setViewport({width,height:844});for(const id of ['ventas','entradas-almacen','historial-decomiso']){
    await page.evaluate(id=>showPage(id),id);const result=await page.evaluate(id=>{const s=document.getElementById(id),dates=[...s.querySelectorAll('input[type=date]')].map(x=>x.getBoundingClientRect()),t=s.querySelector('.luro-table-viewport').getBoundingClientRect(),totals=s.querySelector('.resumen-caja')?.getBoundingClientRect();return {ranges:s.querySelectorAll('.luro-date-range').length,group:s.querySelector('input[type=date]').parentElement.outerHTML,dates:dates.map(r=>({top:r.top,width:r.width,height:r.height})),sameRow:Math.abs(dates[0].top-dates[1].top)<1,compact:dates.every(r=>r.height<=38&&r.width<=196),within:s.scrollWidth<=s.clientWidth+2,tableVisible:t.top<400,totalVisible:!totals||totals.bottom<844};},id);
    assert.equal(result.sameRow,true,JSON.stringify({width,id,result}));assert.equal(result.compact,true);assert.equal(result.within,true);assert.equal(result.tableVisible,true);assert.equal(result.totalVisible,true);
   }
  }
  await page.setViewport({width:390,height:844});await page.evaluate(()=>showPage('ventas'));await page.$eval('#filtro-ventas-desde',e=>{e.value='2026-11-01';e.dispatchEvent(new Event('change',{bubbles:true}));});await page.$eval('#filtro-ventas-hasta',e=>{e.value='2026-11-01';e.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.match(await page.$eval('#tabla-historial-ventas',e=>e.textContent),/Venta noviembre/);assert.doesNotMatch(await page.$eval('#tabla-historial-ventas',e=>e.textContent),/Venta octubre/);assert.match(await page.$eval('#total-ganancias-cuadro',e=>e.textContent),/80.00/);
  await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('ventas')).opacity)===1);fs.mkdirSync(path.resolve(__dirname,'../tmp/luro25'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../tmp/luro25/ventas-mobile.png')});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
