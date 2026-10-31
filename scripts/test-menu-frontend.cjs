const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM,VirtualConsole} = require('jsdom');
const vm = require('node:vm');
const root=path.resolve(__dirname,'../public/menu');
const tick=()=>new Promise(r=>setTimeout(r,30));
const dish={id:'dish-test',name:'Mangú con cebollita',description:'Preparado al momento',category:'Desayunos',price:250,basePrice:250,stock:2,availability:'low_stock',image:'',offer:null,nutrition:{portion:'250 g',energiaKcal:350,proteinasG:null},allergens:'',ingredients:['Plátano','Cebolla'],soldQuantity:4};
async function app(options={}){
  const errors=[],calls=[],remote=[];
  const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://fixture.local/menu/index.html?owner=fixture&module=COCINA',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole,beforeParse(w){
    w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
    w.fetch=async(url,init)=>{
      if(!url.includes('cloudfunctions.net'))return {ok:true,json:async()=>({})};
      const name=url.split('/').pop(),data=JSON.parse(init.body).data;calls.push({name,data});
      if(options.offline)throw Error('Sin conexión de prueba');
      let result;
      if(name==='menuRegisterMember')result={accessToken:'c'.repeat(64)};
      if(name==='menuGetProfile')result={name:'Ana',points:0,premiumActive:false,history:[],verificationPending:true};
      if(name==='menuGetCatalog')result={business:'El Patio · fixture',items:options.empty?[]:[dish],brand:{}};
      if(name==='menuGetOrders')result={orders:remote};
      if(name==='menuSubmitOrder'){if(options.submitError)return {ok:false,json:async()=>({error:{message:'Cambió el precio de un plato.'}})};const order={id:'WEB-'+'1'.repeat(28),date:new Date().toISOString(),status:'pending',items:data.items.map(i=>({...i,name:dish.name})),total:250,subtotal:250,delivery:0,payment:{status:'pending'}};remote.push(order);result=order;}
      return {ok:true,json:async()=>({result})};
    };
  }});
  for(const script of dom.window.document.querySelectorAll('script[src]')){const filename=path.join(root,new URL(script.src).pathname.split('/').pop());vm.runInContext(fs.readFileSync(filename,'utf8'),dom.getInternalVMContext(),{filename});}
  await tick();await tick();return {dom,w:dom.window,errors,calls,remote};
}
test('storefront replaces illustrative menu with admin catalog',async()=>{const a=await app();try{assert.deepEqual(a.errors,[]);assert.match(a.w.document.getElementById('menu').textContent,/Mangú/);assert.doesNotMatch(a.w.document.getElementById('menu').textContent,/Yaroa|Langosta/);assert.match(a.w.document.getElementById('luro-connection-status').textContent,/actualizado/);}finally{a.w.close();}});
test('customer sends an actual pending request without claiming payment or starting kitchen timer',async()=>{const a=await app();try{a.w.eval("putInCart(defaultEntry(MENU[0]));openPayment()");a.w.document.getElementById('luro-order-name').value='Ana';a.w.document.getElementById('luro-order-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();const call=a.calls.find(x=>x.name==='menuSubmitOrder');assert.ok(call);assert.equal(call.data.items[0].unitPrice,250);assert.match(call.data.customerToken,/^[a-f0-9]{64}$/);assert.match(a.w.document.getElementById('secondary').textContent,/Esperando a caja/);assert.doesNotMatch(a.w.document.getElementById('secondary').textContent,/simulad|Tiempo en cocina|PAGO COMPLETADO/);assert.deepEqual(a.errors,[]);}finally{a.w.close();}});
test('live empty catalog has no illustrative fallback and no runtime crash',async()=>{const a=await app({empty:true});try{assert.deepEqual(a.errors,[]);assert.match(a.w.document.getElementById('menu').textContent,/No hay platos/);}finally{a.w.close();}});
test('offline prevents ordering and does not send a request',async()=>{const a=await app({offline:true});try{assert.deepEqual(a.errors,[]);assert.match(a.w.document.getElementById('luro-connection-status').textContent,/Sin conexión/);a.w.eval('openPayment()');assert.equal(a.w.document.getElementById('luro-order-form'),null);assert.ok(!a.calls.some(x=>x.name==='menuSubmitOrder'));}finally{a.w.close();}});
test('nutrition uses values from LuRo and preserves missing values as pending',async()=>{const a=await app();try{a.w.eval("openNutrition('dish-test')");const text=a.w.document.getElementById('utility-content').textContent;assert.match(text,/350 kcal/);assert.match(text,/Pendiente/);assert.match(text,/250 g/);}finally{a.w.close();}});
test('rejected submission keeps the cart and does not create a local successful order',async()=>{const a=await app({submitError:true});try{a.w.eval("putInCart(defaultEntry(MENU[0]));openPayment()");a.w.document.getElementById('luro-order-name').value='Ana';a.w.document.getElementById('luro-order-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();assert.equal(a.w.eval('cart.length'),1);assert.equal(a.w.eval('orders.length'),0);assert.match(a.w.document.getElementById('toast').textContent,/precio/);}finally{a.w.close();}});

test('Lafo answers from sales and ingredient names in Edgar context',async()=>{const a=await app();try{
 a.w.eval("openLafo();answerLafo('Qué es lo más vendido')");assert.match(a.w.document.getElementById('chat-messages').textContent,/4 porciones vendidas/);
 a.w.eval("answerLafo('De qué se compone Mangú con cebollita')");assert.match(a.w.document.getElementById('chat-messages').textContent,/Plátano, Cebolla/);assert.match(a.w.document.getElementById('chat-messages').textContent,/No comparto cantidades/);
}finally{a.w.close();}});
test('membership form sends fields and displays a private profile link',async()=>{const a=await app();try{
 a.w.eval("setView('profile')");a.w.document.getElementById('luro-join').click();const f=a.w.document.getElementById('luro-member-form');f.elements.name.value='Ana';f.elements.cedula.value='00112345678';f.elements.phone.value='8095551234';f.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.ok(a.calls.some(x=>x.name==='menuRegisterMember'&&x.data.cedula==='00112345678'));assert.ok(a.w.document.querySelector('input[aria-label="Enlace privado de miembro"]'));assert.match(a.w.document.getElementById('secondary').textContent,/Perfil creado/);assert.deepEqual(a.errors,[]);
}finally{a.w.close();}});
