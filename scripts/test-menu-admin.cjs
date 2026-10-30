const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
async function app(collaborator=false){
  const html=fs.readFileSync(path.resolve(__dirname,'../public/app.html'),'utf8');
  const dom=new JSDOM(html,{url:'http://fixture.local/app.html',runScripts:'outside-only'}),w=dom.window,calls=[];
  w.setInterval=fn=>(calls.push(fn),calls.length);w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
  vm.runInContext(`let db={platos:[{owner:'owner',modulo:'COCINA',nombre:'Mangú',precio:250,stock:2}],clientesFidelizacion:[]};let sesionUser={user:'owner'};let moduloActual='COCINA';let esColaboradorSesion=${collaborator};let permisosSesion=['salida'];function guardarDatos(){}function obtenerNombreNegocioActual(){return 'El Patio'}function showPage(){};window.obtenerOwnerSesionActual=()=> 'owner';window.subirBaseActualAlCloud=async()=>true;window.descargarBaseDesdeCloud=async()=>true;window.__apiCalls=[];window.luroMenuAdminCall=async(name,data)=>{window.__apiCalls.push({name,data});return {orders:[]}};`,dom.getInternalVMContext());
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../public/assets/js/menu-admin.js'),'utf8'),dom.getInternalVMContext());
  await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));
  calls[0]();await new Promise(r=>setImmediate(r));return {w,calls};
}
test('admin mounts in existing configuration and saves through the existing authenticated sync',async()=>{const a=await app();try{const form=a.w.document.getElementById('menu-settings-form');assert.ok(form);a.w.document.getElementById('menu-enabled').checked=true;form.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(a.w.eval('db.menuIntegration.COCINA.enabled'),true);assert.match(a.w.document.getElementById('menu-live-link').href,/owner=owner&module=COCINA/);}finally{a.w.close();}});
test('dish nutrition and promotions are persisted without replacing recipe or price',async()=>{const a=await app();try{a.w.document.getElementById('menu-dish-select').value='0';a.w.document.getElementById('menu-dish-select').dispatchEvent(new a.w.Event('change'));a.w.document.getElementById('menu-n-energiaKcal').value='300';a.w.document.getElementById('menu-dish-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(a.w.eval('db.platos[0].menu.nutrition.energiaKcal'),300);assert.equal(a.w.eval('db.platos[0].precio'),250);}finally{a.w.close();}});
test('cashier can see orders but cannot edit restaurant configuration',async()=>{const a=await app(true);try{assert.equal(a.w.document.getElementById('luro-menu-admin').hidden,true);assert.equal(a.w.document.getElementById('menu-operations').hidden,false);assert.ok(a.w.__apiCalls.some(x=>x.name==='menuListOrders'));}finally{a.w.close();}});

 test('menu opens on the LURO origin and automatic refresh errors stay visible to cashiers',async()=>{const a=await app(true);try{assert.equal(new URL(a.w.document.getElementById('menu-live-link').href).origin,'http://fixture.local');assert.equal(new URL(a.w.document.getElementById('menu-live-link').href).pathname,'/menu/index.html');assert.match(a.w.document.getElementById('menu-orders-status').textContent,/Conectado a LURO/);a.w.luroMenuAdminCall=async()=>{throw Error('Sin conexión cloud');};await a.calls[1]();assert.match(a.w.document.getElementById('menu-orders-status').textContent,/Sin conexión cloud/);}finally{a.w.close();}});
