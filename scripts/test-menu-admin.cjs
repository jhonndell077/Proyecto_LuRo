const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
async function app(collaborator=false){
  const html=fs.readFileSync(path.resolve(__dirname,'../public/app.html'),'utf8');
  const dom=new JSDOM(html,{url:'http://fixture.local/app.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[];
  const commands=w.document.createElement('div');commands.id='comandas';w.document.getElementById('main-content').append(commands);
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
test('visual editor previews drafts without mutating dishes and preserves unrelated metadata on save',async()=>{const a=await app();try{
 a.w.eval("db.platos[0].menu={tracking:'keep'}");
 a.w.document.querySelector('[data-edit-dish="0"]').click();
 const desc=a.w.document.getElementById('menu-description');desc.value='Descripción <segura> del mangú';desc.dispatchEvent(new a.w.Event('input',{bubbles:true}));
 const frame=a.w.document.getElementById('menu-dish-preview');assert.match(frame.srcdoc,/Descripción &lt;segura&gt;/);assert.equal(frame.getAttribute('sandbox'),'');
 assert.equal(a.w.eval('db.platos[0].menu.description'),undefined);assert.match(a.w.document.getElementById('menu-draft-status').textContent,/pendientes/);
 a.w.document.getElementById('menu-dish-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));
 assert.equal(a.w.eval('db.platos[0].menu.description'),'Descripción <segura> del mangú');assert.equal(a.w.eval('db.platos[0].menu.tracking'),'keep');assert.match(a.w.document.getElementById('menu-draft-status').textContent,/Sincronizado/);
}finally{a.w.close();}});
test('draft discard, search and failed uploads keep clear state',async()=>{const a=await app();try{
 a.w.confirm=()=>true;a.w.document.querySelector('[data-edit-dish="0"]').click();
 const desc=a.w.document.getElementById('menu-description');desc.value='Borrador';desc.dispatchEvent(new a.w.Event('input',{bubbles:true}));a.w.document.getElementById('menu-discard-draft').click();assert.equal(desc.value,'');
 a.w.subirBaseActualAlCloud=async()=>false;desc.value='Sin subir';desc.dispatchEvent(new a.w.Event('input',{bubbles:true}));a.w.document.getElementById('menu-dish-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));assert.match(a.w.document.getElementById('menu-draft-status').textContent,/No sincronizado/);assert.equal(desc.disabled,false);
 const search=a.w.document.getElementById('menu-dish-search');search.value='inexistente';search.dispatchEvent(new a.w.Event('input'));assert.equal(a.w.document.querySelectorAll('[data-edit-dish]').length,0);
}finally{a.w.close();}});
test('catalog isolates owners and modules and expired discounts do not change preview price',async()=>{const a=await app();try{
 a.w.eval("db.platos.push({owner:'other',modulo:'COCINA',nombre:'Privado'},{owner:'owner',modulo:'BAR',nombre:'Otro módulo'})");a.w.document.getElementById('menu-dish-search').dispatchEvent(new a.w.Event('input'));assert.equal(a.w.document.querySelectorAll('[data-edit-dish]').length,1);
 a.w.document.querySelector('[data-edit-dish="0"]').click();a.w.document.getElementById('menu-offer').value='50';a.w.document.getElementById('menu-offer-until').value='2020-01-01T10:00';a.w.document.getElementById('menu-offer').dispatchEvent(new a.w.Event('input',{bubbles:true}));const html=a.w.document.getElementById('menu-dish-preview').srcdoc;assert.match(html,/RD\$250/);assert.doesNotMatch(html,/<del>/);
}finally{a.w.close();}});

test('pending requests remain visible across modules in the floating notification',async()=>{const a=await app();try{
 a.w.luroMenuAdminCall=async(name)=>name==='menuListTasks'?{tasks:[{id:'hero-phrase',title:'Incluir frase',status:'pending'}]}:{orders:[{id:'WEB-1',status:'pending',total:250,items:[]}]};
 await a.calls[1]();const notice=a.w.document.getElementById('menu-floating-notice');assert.equal(notice.hidden,false);assert.match(notice.textContent,/1 pedido/);assert.match(notice.textContent,/1 tarea/);
 a.w.showPage('home');assert.equal(notice.hidden,false);assert.match(a.w.document.getElementById('menu-task-list').textContent,/Incluir frase/);
}finally{a.w.close();}});

test('accepted requests leave cashier queue and retain kitchen/delivery controls',async()=>{const a=await app();try{
 let orders=[{id:'WEB-fixture',status:'pending',customer:{name:'Ana'},total:20,payment:{status:'pending'},items:[{name:'Pan',quantity:1}]}];
 a.w.luroMenuAdminCall=async(name,data)=>{if(name==='menuUpdateOrder')orders=orders.map(o=>({...o,status:data.status}));return {orders};};
 await a.calls[1]();assert.equal(a.w.document.querySelectorAll('#menu-orders-list [data-order]').length,2);
 a.w.document.querySelector('#menu-orders-list [data-next="accepted"]').click();await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
 assert.equal(a.w.document.querySelectorAll('#menu-orders-list [data-order]').length,0);
 assert.ok(a.w.document.querySelector('#menu-kitchen-list [data-next="preparing"]'));
 orders[0].status='ready';await a.calls[1]();assert.ok(a.w.document.querySelector('#menu-kitchen-list [data-next="delivered"]'));
}finally{a.w.close();}});
