"use strict";
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const D=require('./menu-domain');
const P=require('./pos-domain');
const permissions={activate:[],createOrder:['salida'],review:['salida'],dispatch:['salida'],capturePayment:['salida'],startPreparation:['comandas'],ready:['comandas'],deliver:['comandas','salida'],cancel:['salida'],receive:[],receiveStock:[],recount:[],decompose:[],produce:['produccion-interna'],setAvailability:[],reverseProduction:[],refund:[],refundPayment:[]};
const unpack=s=>s.data()?.db||s.data()?.['base de datos']||{};
module.exports=function registerPos({db,resolveSession,assertOwnerActive}){
 const call=fn=>onCall({cors:true},async r=>{try{return await fn(r);}catch(e){if(e instanceof HttpsError)throw e;if(e instanceof P.PosError)throw new HttpsError(e.code,e.message);throw new HttpsError('internal','No se pudo completar la operación POS.');}});
 function context(session,data){const owner=D.key(session.owner),module=D.text(data.module,80);if(data.owner&&D.key(data.owner)!==owner)throw new HttpsError('permission-denied','Negocio no autorizado.');if(!/^[a-z0-9_.@-]{1,100}$/.test(owner)||!module||/[\/\x00-\x1f]/.test(module))throw new HttpsError('invalid-argument','Módulo inválido.');return {owner,module,ref:db.collection('datos_del_propietario').doc(owner),scope:D.hash(owner+'\0'+module)};}
 function capabilities(session,auth){if(session.customerHash)return ['createOrder'];if(!session.collaborator&&['admin','super-master'].includes(session.role))return Object.keys(permissions);if(!auth?.exists||auth.data().activo===false)return [];const p=auth.data().permisos||[];return Object.keys(permissions).filter(t=>permissions[t].length&&permissions[t].some(x=>p.includes(x)));}
 function authRef(s){return s.collaborator?db.collection('autorizaciones').doc(`${D.key(s.owner)}__${D.key(s.username)}`):null;}
 async function executeFor(session,data){
  await assertOwnerActive(session.owner);const c=context(session,data),type=D.text(data.type,40),input=data.input||{},operationId=D.text(data.operationId,120);if(!/^[A-Za-z0-9_.:-]{8,120}$/.test(operationId)||!Object.hasOwn(permissions,type))throw new HttpsError('invalid-argument','Operación inválida.');
  if(session.customerHash&&type!=='createOrder')throw new HttpsError('permission-denied','Operación no autorizada.');
  const principal=session.customerHash||session.username;const hash=D.hash(P.canonical({module:c.module,type,input,principal})),receiptRef=c.ref.collection('pos_operations').doc(D.hash(c.module+'\0'+principal+'\0'+operationId));
  const orderId=type==='createOrder'?(session.customerHash?`WEB-${D.hash(session.customerHash+':'+operationId).slice(0,28)}`:`WEB-${D.hash(c.owner+'\0'+c.module+'\0'+operationId).slice(0,28)}`):D.text(input.orderId,80);
  if(orderId&&!/^WEB-[a-f0-9]{28}$/.test(orderId))throw new HttpsError('invalid-argument','Pedido inválido.');
  const orderRef=orderId?db.collection('menu_orders').doc(c.scope).collection('orders').doc(orderId):null,rr=db.collection('menu_reservations').doc(c.scope),ar=authRef(session);
  return db.runTransaction(async tx=>{
   const [receipt,ownerSnap,resSnap,authSnap,orderSnap]=await Promise.all([tx.get(receiptRef),tx.get(c.ref),tx.get(rr),ar?tx.get(ar):null,orderRef?tx.get(orderRef):null]);
   if(!capabilities(session,authSnap).includes(type))throw new HttpsError('permission-denied','No tienes permiso para esta operación.');
   if(receipt.exists){if(receipt.data().hash!==hash)throw new HttpsError('already-exists','La clave de operación ya fue usada con otro contenido.');return {...receipt.data().result,replayed:true};}
   if(!ownerSnap.exists)throw new HttpsError('not-found','Base no encontrada.');const payload=unpack(ownerSnap),version=Number(payload.posModules?.[c.module]?.version)||0;
   if(data.expectedVersion!=null&&data.expectedVersion!==version)throw new HttpsError('aborted','La base cambió. Actualiza antes de continuar.');
   if(orderSnap?.exists&&type==='createOrder')throw new HttpsError('already-exists','Pedido existente.');
   if(orderSnap?.exists&&orderSnap.data().engineVersion!==3)throw new HttpsError('failed-precondition','Este pedido anterior conserva su flujo original.');
   if(type==='activate'&&!payload.posModules?.[c.module]?.managed){const legacyOrders=await tx.get(db.collection('menu_orders').doc(c.scope).collection('orders').where('status','in',['pending','reviewed','accepted','preparing','ready','partially_delivered']).limit(1));if(!legacyOrders.empty)throw new HttpsError('failed-precondition','Finaliza los pedidos activos antes de activar POS 3.0.');const unpaid=await tx.get(db.collection('menu_orders').doc(c.scope).collection('orders').where('payment.status','in',['pending','partial']));if(unpaid.docs.some(x=>!['rejected','cancelled'].includes(x.data().status)))throw new HttpsError('failed-precondition','Cierra los cobros pendientes anteriores antes de activar POS 3.0.');if(Buffer.byteLength(JSON.stringify(payload))>900000)throw new HttpsError('failed-precondition','La base requiere un respaldo externo verificado antes de activar.');}
   const now=Date.now(),ctx={...c,actor:session.username||session.customerHash,operationId,orderId,now,order:orderSnap?.exists?orderSnap.data():null,reservations:resSnap.data()||{},customerHash:session.customerHash,membership:session.membership};
   let out;
   if(type==='deliver'&&Array.isArray(input.items)){
    if(!input.items.length||input.items.length>30||new Set(input.items.map(x=>x.lineId)).size!==input.items.length)throw new HttpsError('invalid-argument','Entregas inválidas.');let current=payload,order=ctx.order,reservations=ctx.reservations;
    for(let i=0;i<input.items.length;i++){out=P.apply(current,type,{...input,...input.items[i]}, {...ctx,operationId:operationId+'-'+i,order,reservations});current=out.payload;order=out.order;reservations=out.reservations;}
   }else out=P.apply(payload,type,input,ctx);
   if(Buffer.byteLength(JSON.stringify({db:out.payload,'base de datos':out.payload}))>950000)throw new HttpsError('resource-exhausted','La base alcanzó el límite seguro. No se aplicó la operación; requiere consolidación de historiales.');
   if(type==='activate'&&!payload.posModules?.[c.module]?.managed)tx.set(c.ref.collection('pos_backups').doc(D.hash(c.module+'\0'+operationId)),{module:c.module,createdAt:now,actor:ctx.actor,db:payload,sha256:D.hash(P.canonical(payload))});
   tx.set(c.ref,{db:out.payload,'base de datos':out.payload,updatedAtClient:now,updatedFrom:'pos3',syncKey:'pos3-'+operationId},{merge:true});
   if(out.order&&orderRef)tx.set(orderRef,out.order);tx.set(rr,out.reservations);const result={...out.result,order:out.order||null};tx.set(receiptRef,{hash,type,module:c.module,actor:ctx.actor,createdAt:now,result});return result;
  });
 }
 async function getState(session,data){await assertOwnerActive(session.owner);const c=context(session,data),ar=authRef(session);const [snap,auth,rs]=await Promise.all([c.ref.get(),ar?ar.get():null,db.collection('menu_reservations').doc(c.scope).get()]);const caps=capabilities(session,auth);if(!caps.length||session.customerHash)throw new HttpsError('permission-denied','Sin acceso POS.');const payload=unpack(snap),state=payload.posModules?.[c.module]||{},scope=x=>D.key(x.owner)===c.owner&&x.modulo===c.module;
  const active=await db.collection('menu_orders').doc(c.scope).collection('orders').where('status','in',['pending','reviewed','accepted','preparing','ready','partially_delivered']).get();
  const orderCollection=db.collection('menu_orders').doc(c.scope).collection('orders');const [recent,debt]=await Promise.all([orderCollection.orderBy('createdAt','desc').limit(100).get(),orderCollection.where('payment.status','in',['pending','partial']).get()]);const orders=[...new Map([...recent.docs,...active.docs,...debt.docs.filter(x=>x.data().status==='delivered')].map(x=>[x.id,x.data()])).values()];const canCash=caps.includes('capturePayment'),canInventory=caps.includes('receive');
  const inventory=(canInventory?payload.almacen||[]:[]).filter(scope).map(x=>({id:x.id||'name:'+x.nombre,name:x.nombre,unit:x.unidad,quantity:x.actual,origin:'almacen'}));
  return {productionHistory:caps.includes('reverseProduction')?(payload.historial_prod||[]).filter(scope).slice(-100):[],managed:state.managed===true,policy:state.policy||'BEFORE_KITCHEN',version:Number(state.version)||0,capabilities:caps,orders:orders.map(o=>canCash?o:{id:o.id,status:o.status,mesa:o.mesa,items:o.items.map(({recipeSnapshot,...l})=>l),notes:o.notes,createdAt:o.createdAt}),products:(payload.platos||[]).filter(scope).map(x=>({id:D.dishId(x),name:x.nombre,price:Number(x.precio)||0,stock:Math.max(0,Number(x.stock||0)-Number(rs.data()?.quantities?.[D.dishId(x)]||0))})),inventory,production:canInventory?(payload.produccion_stock||[]).filter(scope):[],recipes:caps.includes('produce')?(payload.productionRecipes||[]).filter(x=>scope(x)&&!x.deleted):[],tables:Array.from({length:20},(_,i)=>({id:'Mesa '+(i+1),name:'Mesa '+(i+1)})),payments:canCash?(payload.posPayments||[]).filter(scope).slice(-100):[],movements:canInventory?(payload.inventoryMovements||[]).filter(scope).slice(-100):[]};
 }
 return {posExecute:call(async r=>executeFor(await resolveSession(r,true),r.data||{})),posGetState:call(async r=>getState(await resolveSession(r,true),r.data||{})),executeFor,getState};
};
module.exports.permissions=permissions;
