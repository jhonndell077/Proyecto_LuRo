'use strict';
// Real transactions in a fixed local emulator; no production credentials loaded.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const PROJECT='demo-luro-pos3',HOST='127.0.0.1:18180';
function guard(){assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST,'Fixed localhost emulator required');assert.equal(process.env.GCLOUD_PROJECT,PROJECT,'Demo project required');}
function fixture(owner,stock=9){return {tenant:{negocioId:'synthetic-'+owner,owner},platos:[{id:'chicken',menuId:'chicken',owner,modulo:'COCINA',nombre:'Pechuga de 8 Oz',stock,precio:725,receta:[{nombre:'Pechuga cruda',cantidad:8,unidad:'Oz',origen:'almacen'}]}],almacen:[{id:'raw',owner,modulo:'COCINA',nombre:'Pechuga cruda',actual:stock*8,unidad:'Oz',costoUnitario:10}],produccion_stock:[],ventas:[],entradas:[],decomisos:[],historial_prod:[],comandasActivas:[],comandasHistorial:[],facturasResumen:[],menuIntegration:{COCINA:{enabled:true,business:'Synthetic only'}}};}
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
function load(db,name='pos-operations',extra={}){const file=path.resolve(__dirname,'../../functions/'+name+'.js'),localRequire=createRequire(file),box={Promise,Buffer,module:{exports:{}},require:n=>n==='firebase-functions/v2/https'?{onCall:(_,fn)=>fn,HttpsError}:localRequire(n)};vm.runInThisContext('(function(module,require){'+fs.readFileSync(file,'utf8')+'\n})',{filename:file})(box.module,box.require);return box.module.exports({db,resolveSession:async r=>{if(!r.data.syntheticSession)throw new HttpsError('unauthenticated','Synthetic session required');return r.data.syntheticSession;},assertOwnerActive:async owner=>{assert.ok(owner.startsWith('qa_'),'Synthetic tenants only');},...extra});}
async function main(){
 guard();const requireFunctions=createRequire(path.resolve(__dirname,'../../functions/package.json')),admin=requireFunctions('firebase-admin');
 const app=admin.initializeApp({projectId:PROJECT},'pos3-qa-'+Date.now()),db=app.firestore();
 try{
  const api=load(db),owners=['qa_alpha','qa_beta','qa_race','qa_web'];
  for(const owner of owners){const payload=fixture(owner,owner==='qa_race'?1:9);await db.doc('datos_del_propietario/'+owner).set({db:payload,'base de datos':structuredClone(payload),synthetic:true});}
  let sequence=0;
  const call=(owner,type,input={},extra={})=>api.posExecute({data:{owner,module:'COCINA',type,input,operationId:'qa-operation-'+String(++sequence).padStart(6,'0'),syntheticSession:{owner,username:owner,role:'admin',collaborator:false},...extra}});
  const state=async owner=>(await db.doc('datos_del_propietario/'+owner).get()).data().db;
  await call('qa_alpha','activate',{policy:'AFTER_DELIVERY'});
  const created=await call('qa_alpha','createOrder',{items:[{id:'chicken',quantity:9}],customerName:'Synthetic guest',table:'Mesa QA'}),orderId=created.orderId;
  assert.ok(orderId,'Created order id');
  const op=(type,input={},extra={})=>call('qa_alpha',type,{orderId,...input},extra);
  await op('review');await op('dispatch');await op('startPreparation');await op('ready');
  const scope=requireFunctions('./menu-domain').hash('qa_alpha\0COCINA'),orderRef=db.doc(`menu_orders/${scope}/orders/${orderId}`),lineId=(await orderRef.get()).data().items[0].lineId;
  const retryKey='qa-delivery-retry-000001';
  await op('deliver',{lineId,quantity:4},{operationId:retryKey});await op('deliver',{lineId,quantity:4},{operationId:retryKey});
  let payload=await state('qa_alpha');assert.equal(payload.platos[0].stock,5);assert.equal(payload.almacen[0].actual,40);assert.equal(payload.posDeliveries.length,1);
  await op('deliver',{lineId,quantity:5});payload=await state('qa_alpha');assert.equal(payload.platos[0].stock,0);assert.equal(payload.almacen[0].actual,0);assert.equal(payload.posDeliveries.length,2);assert.equal(payload.ventas.reduce((s,x)=>s+Number(x.cantidad),0),9);assert.equal((await orderRef.get()).data().status,'delivered');
  await op('capturePayment',{amount:6525,received:7000,method:'Efectivo'},{operationId:'qa-payment-retry-000001'});await op('capturePayment',{amount:6525,received:7000,method:'Efectivo'},{operationId:'qa-payment-retry-000001'});payload=await state('qa_alpha');assert.equal(payload.posPayments.length,1);assert.equal(payload.facturasResumen.length,1);
  await assert.rejects(op('deliver',{lineId,quantity:1}));
  await assert.rejects(call('qa_alpha','createOrder',{items:[{id:'chicken',quantity:1}]},{syntheticSession:{owner:'qa_beta',username:'qa_beta',role:'admin'}}));
  await db.doc('autorizaciones/qa_alpha__qa_cook').set({activo:true,permisos:['comandas']});
  await assert.rejects(call('qa_alpha','receiveStock',{productId:'raw',quantity:8,unit:'Oz'},{syntheticSession:{owner:'qa_alpha',username:'qa_cook',role:'colaborador',collaborator:true}}));
  await call('qa_beta','activate',{policy:'BEFORE_KITCHEN'});const paidOrder=await call('qa_beta','createOrder',{items:[{id:'chicken',quantity:1}]});await call('qa_beta','review',{orderId:paidOrder.orderId});await assert.rejects(call('qa_beta','dispatch',{orderId:paidOrder.orderId}));await call('qa_beta','capturePayment',{orderId:paidOrder.orderId,amount:725,method:'Transferencia'});await call('qa_beta','dispatch',{orderId:paidOrder.orderId});
  await call('qa_race','activate',{policy:'BEFORE_KITCHEN'});
  const outcomes=await Promise.allSettled([call('qa_race','createOrder',{items:[{id:'chicken',quantity:1}]},{syntheticSession:{owner:'qa_race',username:'actor_a',role:'admin'}}),call('qa_race','createOrder',{items:[{id:'chicken',quantity:1}]},{syntheticSession:{owner:'qa_race',username:'actor_b',role:'admin'}})]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1,'Only one actor reserves last portion');
  await call('qa_web','activate',{policy:'BEFORE_KITCHEN'});
  const menu=load(db,'menu-integration',{posExecuteFor:api.executeFor});
  const webRequest={owner:'qa_web',module:'COCINA',customerToken:'b'.repeat(64),requestId:'qa-web-request-000001',name:'Synthetic web guest',items:[{id:'chicken',quantity:1,unitPrice:725}]};
  const webOrder=await menu.menuSubmitOrder({data:webRequest}),webRetry=await menu.menuSubmitOrder({data:webRequest});
  assert.equal(webOrder.id,webRetry.id,'Menu retry reuses canonical order');assert.equal(webOrder.engineVersion,3);
  for(const response of [webOrder,webRetry]){assert.equal(JSON.stringify(response).includes('recipeSnapshot'),false);assert.equal(JSON.stringify(response).includes('resourceReservations'),false);}
  const webOrders=await menu.menuGetOrders({data:{owner:'qa_web',module:'COCINA',customerToken:webRequest.customerToken}});
  assert.equal(webOrders.orders.length,1);assert.equal(webOrders.orders[0].id,webOrder.id);assert.equal(JSON.stringify(webOrders).includes('recipeSnapshot'),false);assert.equal(JSON.stringify(webOrders).includes('resourceReservations'),false);
  const webScope=requireFunctions('./menu-domain').hash('qa_web\0COCINA'),webReservation=(await db.doc('menu_reservations/'+webScope).get()).data();
  assert.equal(webReservation.quantities.chicken,1,'Web retry reserves one portion only');assert.equal(Object.values(webReservation.materials).reduce((sum,q)=>sum+q,0),8,'Web retry reserves eight Oz only');
  const webCanonical=(await db.doc(`menu_orders/${webScope}/orders/${webOrder.id}`).get()).data();assert.ok(webCanonical.items[0].recipeSnapshot);assert.ok(webCanonical.items[0].resourceReservations);assert.equal((await state('qa_web')).platos[0].stock,9,'Reservation does not prematurely consume stock');
  const denied=await fetch(`http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents/datos_del_propietario/qa_alpha`);assert.equal(denied.status,403);
  console.log(JSON.stringify({result:'PASS',project:PROJECT,partialDeliveries:[4,5],delivered:9,idempotentDelivery:true,idempotentPayment:true,lastPortionWinners:1,tenantIsolation:true,permissionDenied:true,beforeKitchenPaymentEnforced:true,webMenuEngine:3,webRetryReservation:1,publicRecipeRedacted:true,anonymousRead:'denied'}));
 }finally{await app.delete();}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={guard,fixture};
