"use strict";
// Pure operations over the EXISTING owner payload. Persistence belongs to pos-operations.
const D = require('./menu-domain');
const S = require('./stock-domain');
class PosError extends Error { constructor(message, code='failed-precondition'){super(message);this.code=code;} }
const fail=(m,c)=>{throw new PosError(m,c);};
const clone=x=>JSON.parse(JSON.stringify(x));
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function positive(v){const n=Number(v);if(!Number.isFinite(n)||n<=0)fail('Indica una cantidad positiva.');return n;}
function scoped(x,c){return D.key(x.owner)===c.owner&&x.modulo===c.module;}
function item(db,input,c){const list=input.origin==='produccion'?db.produccion_stock:db.almacen;const found=(list||[]).filter(x=>scoped(x,c)&&(input.productId?String(x.id||'name:'+x.nombre)===String(input.productId):D.key(x.nombre)===D.key(input.name)));if(found.length!==1)fail('Selecciona un producto único del almacén.');return found[0];}
function dish(db,id,c){const p=(db.platos||[]).find(x=>scoped(x,c)&&D.dishId(x)===id);if(!p)fail('Plato no encontrado.');return p;}
function movement(db,c,row,delta,kind,reference){db.inventoryMovements||=[];db.inventoryMovements.push({id:D.hash(c.operationId+'\0'+db.inventoryMovements.length).slice(0,32),operationId:c.operationId,owner:c.owner,modulo:c.module,productId:row.id||null,producto:row.nombre,unidad:row.unidad||'Unidad',quantity:delta,kind,reference:reference||'',createdAt:c.now,actor:c.actor});}
function normalizeOrder(order){order.items.forEach((l,i)=>{l.lineId||=order.id+'-'+i;l.deliveredQuantity=Number(l.deliveredQuantity)||0;});return order;}
function resourceKey(db,p){return ((db.produccion_stock||[]).includes(p)?'produccion:':'almacen:')+(p.id||D.key(p.nombre));}
function reserveResources(db,order,reservations,c){
 reservations.materials||={};
 for(const line of order.items){const p=dish(db,line.id,c);let required;
  if(line.consumptionPolicy==='batch'){const target=(db.produccion_stock||[]).find(x=>scoped(x,c)&&String(x.id)===String(p.finishedProductId));if(!target)fail('Vincula un producto terminado para la receta por lote.');required=[{item:target,quantity:line.quantity}];}
  else required=S.requirements(db,line.recipeSnapshot,c.owner,c.module,line.quantity);
  line.resourceReservations=required.map(r=>{const id=resourceKey(db,r.item),reserved=Number(reservations.materials[id])||0;if(Number(r.item.actual)-reserved+1e-9<r.quantity)fail('Insumos insuficientes para reservar: '+r.item.nombre);reservations.materials[id]=reserved+r.quantity;return {id,quantity:r.quantity};});
 }
}
function apply(payload,type,input,ctx){
 const db=clone(payload),c={now:Date.now(),...ctx},reservations=clone(c.reservations||{});input={...input};if(type==='receive')type='receiveStock';reservations.quantities||={};reservations.pending||={};let order=c.order?normalizeOrder(clone(c.order)):null,result={ok:true};
 db.posModules||={};const state=db.posModules[c.module]||{version:0};
 if(type!=='activate'&&!state.managed)fail('Activa primero el motor POS de este módulo.');
 if(type==='activate'){if(!state.managed){if((db.comandasActivas||[]).some(x=>scoped(x,c))||Object.values(db.mesasEstado?.carritoPorMesa||{}).some(lines=>Array.isArray(lines)&&lines.length))fail('Cierra las cuentas y comandas tradicionales antes de activar.');for(const p of db.platos||[])if(scoped(p,c))p.menuId=D.dishId(p);state.managed=true;state.policy=input.policy||'BEFORE_KITCHEN';if(!['BEFORE_KITCHEN','AFTER_DELIVERY'].includes(state.policy))fail('Política inválida.');state.activatedAt=c.now;state.activatedBy=c.actor;}result={ok:true,managed:true,policy:state.policy};}
 else if(type==='receiveStock'||type==='recount'||type==='decompose'){
  const p=item(db,input,c),old=Number(p.actual);if(!Number.isFinite(old)||old<0)fail('Existencia inválida.');let qty;
  if(type==='recount'){qty=Number(input.quantity);if(!Number.isFinite(qty)||qty<0)fail('Recuento inválido.');}
  else {const received=positive(input.quantity);const converted=S.convert(received,input.unit||p.unidad,p.unidad);qty=type==='receiveStock'?old+converted:old-converted;}
  if(qty< -1e-9||qty+1e-9<Number(reservations.materials?.[resourceKey(db,p)]||0))fail('No hay suficiente existencia libre de reservas.');p.actual=Math.max(0,qty);movement(db,c,p,p.actual-old,type,input.reason);
  if(type==='receiveStock'){db.entradas||=[];db.entradas.push({id:c.operationId,owner:c.owner,modulo:c.module,producto:p.nombre,cantidad:p.actual-old,cant:p.actual-old,unidad:p.unidad,medida:p.unidad,costoTotal:(p.actual-old)*(Number(p.costoUnitario)||0),cantidadRecibida:Number(input.quantity),unidadRecibida:input.unit||p.unidad,fecha:new Date(c.now).toISOString(),operador:c.actor,distribuidor:p.distribuidor||'',costoUnitario:Number(p.costoUnitario)||0});}
  if(type==='decompose'){db.decomisos||=[];db.decomisos.push({id:c.operationId,owner:c.owner,modulo:c.module,producto:p.nombre,cantidad:old-p.actual,unidad:p.unidad,motivo:D.text(input.reason,300),fecha:new Date(c.now).toISOString(),operador:c.actor});}
  result={ok:true,quantity:p.actual};
 }
 else if(type==='setAvailability'){
  const p=dish(db,input.productId,c),qty=Number(input.quantity);if(!Number.isInteger(qty)||qty<0)fail('Indica una disponibilidad entera y no negativa.');let capacity;
  if(p.consumptionPolicy==='batch'){const output=(db.produccion_stock||[]).find(x=>scoped(x,c)&&String(x.id)===String(p.finishedProductId));capacity=Math.floor(Number(output?.actual)||0);}else capacity=S.capacity(db,p,c.owner,c.module);
  if(qty>capacity||qty<Number(reservations.quantities[D.dishId(p)]||0))fail('La disponibilidad debe respetar los insumos y las reservas.');p.stock=qty;result={ok:true,quantity:qty,capacity};
 }
 else if(type==='produce'){
  if(input.direct)fail('La carga directa requiere una recepción, no una producción.');
  const recipe=(db.productionRecipes||[]).find(r=>scoped(r,c)&&String(r.id)===String(input.recipeId));if(!recipe)fail('Selecciona una receta de producción registrada.');
  const q=positive(input.quantity),yieldQty=positive(recipe.quantity||recipe.rendimiento||1),factor=q/yieldQty;
  const ingredients=clone(recipe.recipe||recipe.insumos||[]).map(i=>({...i,cantidad:positive(i.cantidad)*factor,mermaReal:Number(i.mermaReal||0)*factor}));
  const plan=S.plan(db,{name:recipe.name||recipe.nombre,quantity:q,unit:recipe.unit||recipe.unidad,recipe:ingredients,ideal:recipe.ideal||0},c.owner,c.module);
  for(const r of plan.requirements)if(Number(r.item.actual)-Number(reservations.materials?.[resourceKey(db,r.item)]||0)+1e-9<r.quantity)fail('El insumo está reservado para pedidos.');const record=S.commit(db,plan,c.owner,c.module,c.actor,c.operationId);for(const r of plan.requirements)movement(db,c,r.item,-r.quantity,'production-consumption',record.id);const target=plan.existing||db.produccion_stock[db.produccion_stock.length-1];movement(db,c,target,plan.existing?S.convert(q,plan.unit,target.unidad):q,'production-output',record.id);result={ok:true,productionId:record.id};
 }
 else if(type==='reverseProduction'){
  const record=(db.historial_prod||[]).find(r=>r.id===input.productionId&&scoped(r,c));if(!record)fail('Lote no encontrado.');const target=(db.produccion_stock||[]).find(x=>scoped(x,c)&&D.key(x.nombre)===D.key(record.lote?.nombre));if(target&&Number(target.actual)-Number(reservations.materials?.[resourceKey(db,target)]||0)<Number(record.lote?.cantidad))fail('El lote tiene porciones reservadas.');const before=new Map([...(db.almacen||[]),...(db.produccion_stock||[])].filter(x=>scoped(x,c)).map(x=>[x,Number(x.actual)]));S.reverse(db,record,c.owner,c.module);for(const [row,qty] of before)if(Number(row.actual)!==qty)movement(db,c,row,Number(row.actual)-qty,'production-reversal',record.id);record.reversedAt=c.now;record.reverseOperationId=c.operationId;result={ok:true,productionId:record.id};
 }
 else if(type==='createOrder'){
  if(order)fail('El pedido ya existe.');const lines=input.items;if(!Array.isArray(lines)||!lines.length||lines.length>30)fail('Pedido inválido.');const seen=new Set();
  const items=lines.map((line,i)=>{const l={...line,id:line.id||line.productId};if(seen.has(l.id))fail('Combina los renglones del mismo plato.');seen.add(l.id);const p=dish(db,l.id,c),q=positive(l.quantity);if(c.customerHash&&p.menu?.hidden===true)fail('Plato no publicado.');if(!Number.isInteger(q)||q>99)fail('Cantidad de plato inválida.');const available=Number(p.stock)-(Number(reservations.quantities[l.id])||0);if(q>available)fail('Disponibilidad insuficiente.');const price=c.customerHash?D.catalog(db,c.owner,c.module,{},c.now).items.find(x=>x.id===l.id)?.price:D.money(p.precio);if(!Number.isFinite(price)||price<0)fail('Precio inválido.');if(c.customerHash&&l.unitPrice!=null&&D.money(l.unitPrice)!==price)fail('Cambió el precio. Actualiza el carrito.');reservations.quantities[l.id]=(Number(reservations.quantities[l.id])||0)+q;return {id:l.id,lineId:c.orderId+'-'+i,name:p.nombre,quantity:q,unitPrice:price,notes:D.text(l.notes,400),deliveredQuantity:0,consumptionPolicy:p.consumptionPolicy||'on-demand',recipeSnapshot:clone(p.receta||[])};});
  const total=D.money(items.reduce((s,l)=>s+l.quantity*l.unitPrice,0));order={id:c.orderId,engineVersion:3,owner:c.owner,module:c.module,channel:c.customerHash?'web':input.channel==='lafo'?'lafo':'pos',customer:{name:D.text(input.customerName||input.name||'Cliente',80),membership:c.membership||null},mesa:D.text(input.table||input.tableId,80),notes:D.text(input.notes,400),items,subtotal:total,total,delivery:0,status:'pending',payment:{status:'pending',method:'Caja'},createdAt:c.now,updatedAt:c.now};if(c.customerHash){const minute=Math.floor(c.now/60000);const count=reservations.minute===minute?Number(reservations.count||0):0;if(count>=60||Object.values(reservations.pending).reduce((sum,x)=>sum+Number(x||0),0)>=200)fail('Hay demasiados pedidos pendientes.');reservations.minute=minute;reservations.count=count+1;order.customerHash=c.customerHash;reservations.pending[c.customerHash]=(Number(reservations.pending[c.customerHash])||0)+1;if(reservations.pending[c.customerHash]>3)fail('Ya tienes tres pedidos pendientes.');}result={ok:true,orderId:order.id};
  reserveResources(db,order,reservations,c);
 }
 else {
  if(!order||order.owner!==c.owner||order.module!==c.module)fail('Pedido no encontrado.','not-found');
  if(type==='review'){if(order.status!=='pending')fail('El pedido ya fue revisado.');order.status='reviewed';order.reviewedAt=c.now;}
  else if(type==='capturePayment'){
   if(order.status==='pending')fail('Revisa el pedido antes de cobrar.');if(['rejected','cancelled'].includes(order.status))fail('Pedido cancelado.');const amount=D.money(positive(input.amount));if(amount<=0)fail('El importe mínimo es 0.01.');const paid=D.money(order.payment?.amount||0);if(amount>D.money(order.total-paid))fail('El importe supera el saldo.');if(!['Efectivo','Transferencia','Tarjeta'].includes(input.method))fail('Método de pago inválido.');if(input.method==='Efectivo'&&(!Number.isFinite(Number(input.received))||Number(input.received)<amount))fail('El efectivo recibido debe cubrir el importe.');
   db.posPayments||=[];const payment={id:c.operationId,owner:c.owner,modulo:c.module,orderId:order.id,amount,method:input.method,reference:D.text(input.reference,150),createdAt:c.now,actor:c.actor,status:'confirmed'};db.posPayments.push(payment);order.payment={status:D.money(paid+amount)===order.total?'paid':'partial',amount:D.money(paid+amount),method:input.method,paidAt:D.money(paid+amount)===order.total?c.now:null};
   if(order.payment.status==='paid'){db.facturasResumen||=[];if(!db.facturasResumen.some(f=>f.menuOrderId===order.id))db.facturasResumen.push({id:'POS-'+order.id,menuOrderId:order.id,owner:c.owner,modulo:c.module,fecha:new Date(c.now).toISOString(),total:order.total,cliente:order.customer?.name||'',items:clone(order.items),metodoPago:input.method});}
  }
  else if(type==='refund'||type==='refundPayment'){
   const amount=D.money(positive(input.amount)),paid=Number(order.payment?.amount)||0,refunded=Number(order.payment?.refundedAmount)||0;if(amount<=0)fail('El importe mínimo es 0.01.');if(!D.text(input.reason,300))fail('Indica el motivo de devolución.');if(amount>D.money(paid-refunded))fail('La devolución supera el pago recibido.');db.posPayments||=[];db.posPayments.push({id:c.operationId,owner:c.owner,modulo:c.module,orderId:order.id,amount:-amount,method:order.payment.method||'Caja',status:'refund',reason:D.text(input.reason,300),createdAt:c.now,actor:c.actor});order.payment.refundedAmount=D.money(refunded+amount);order.payment.status=order.payment.refundedAmount===paid?'refunded':'partially_refunded';for(const invoice of db.facturasResumen||[])if(invoice.menuOrderId===order.id){invoice.refundedAmount=order.payment.refundedAmount;invoice.adjustmentStatus=order.payment.status;}
  }
  else if(type==='dispatch'){
   if(order.status!=='reviewed')fail('Revisa el pedido antes de enviarlo.');if(state.policy!=='AFTER_DELIVERY'&&order.payment?.status!=='paid')fail('Confirma el pago antes de enviar a cocina.');order.status='accepted';order.acceptedAt=c.now;db.comandasActivas||=[];if(!db.comandasActivas.some(x=>x.menuOrderId===order.id))db.comandasActivas.push({id:'CMD-'+order.id,menuOrderId:order.id,owner:c.owner,modulo:c.module,mesa:order.mesa||order.id,createdAt:c.now,items:order.items.map(l=>({lineId:l.lineId,nombre:l.name,cantidad:l.quantity,notes:l.notes})),notes:order.notes||''});
   if(order.customerHash)reservations.pending[order.customerHash]=Math.max(0,Number(reservations.pending[order.customerHash]||0)-1);
  }
  else if(type==='startPreparation'){if(order.status!=='accepted')fail('La comanda no está aceptada.');order.status='preparing';order.preparingAt=c.now;}
  else if(type==='ready'){if(order.status!=='preparing')fail('Inicia la preparación primero.');order.status='ready';order.readyAt=c.now;}
  else if(type==='deliver'){
   if(!['ready','partially_delivered'].includes(order.status))fail('La comanda todavía no está lista.');const line=order.items.find(l=>l.lineId===input.lineId);if(!line)fail('Renglón no encontrado.');const qty=positive(input.quantity);if(!Number.isInteger(qty)||qty>line.quantity-line.deliveredQuantity)fail('Cantidad de entrega inválida.');const p=dish(db,line.id,c);if(Number(p.stock)<qty)fail('Existencias insuficientes para entregar.');
   if(!Array.isArray(line.resourceReservations))fail('El pedido requiere conciliación de reservas.');const requirements=line.resourceReservations.map(r=>{const found=[...(db.almacen||[]),...(db.produccion_stock||[])].find(x=>scoped(x,c)&&resourceKey(db,x)===r.id);if(!found)fail('No se encuentra el insumo reservado.');return {item:found,quantity:r.quantity*qty/line.quantity};});
   for(const r of requirements)if(!Number.isFinite(Number(r.item.actual))||Number(r.item.actual)+1e-9<r.quantity)fail('Insumos insuficientes: '+r.item.nombre);
   for(const r of requirements){r.item.actual=Number(r.item.actual)-r.quantity;movement(db,c,r.item,-r.quantity,'sale-consumption',order.id);}for(const r of line.resourceReservations||[])reservations.materials[r.id]=Math.max(0,Number(reservations.materials[r.id]||0)-r.quantity*qty/line.quantity);p.stock=Number(p.stock)-qty;line.deliveredQuantity+=qty;reservations.quantities[line.id]=Math.max(0,Number(reservations.quantities[line.id]||0)-qty);
   db.posDeliveries||=[];db.posDeliveries.push({id:c.operationId,owner:c.owner,modulo:c.module,orderId:order.id,lineId:line.lineId,quantity:qty,createdAt:c.now,actor:c.actor});db.ventas||=[];const revenue=D.money(qty*line.unitPrice),knownCost=requirements.length>0&&requirements.every(r=>r.item.costoUnitario!=null&&r.item.costoUnitario!==''&&Number.isFinite(Number(r.item.costoUnitario))&&Number(r.item.costoUnitario)>=0),cost=knownCost?D.money(requirements.reduce((sum,r)=>sum+r.quantity*Number(r.item.costoUnitario),0)):null;db.ventas.push({id:c.operationId,owner:c.owner,modulo:c.module,menuOrderId:order.id,lineId:line.lineId,plato:line.name,cantidad:qty,total:revenue,totalVenta:revenue,...(knownCost?{costoTotal:cost,ganancia:D.money(revenue-cost)}:{costStatus:'unknown'}),fecha:new Date(c.now).toISOString(),ts:c.now,mesa:order.mesa||'',operador:c.actor,metodoPago:order.payment?.method||'Pendiente'});
   order.status=order.items.every(l=>l.deliveredQuantity===l.quantity)?'delivered':'partially_delivered';if(order.status==='delivered'){order.deliveredAt=c.now;db.comandasActivas=(db.comandasActivas||[]).filter(x=>x.menuOrderId!==order.id);db.comandasHistorial||=[];db.comandasHistorial.push({id:'CMD-'+order.id,menuOrderId:order.id,owner:c.owner,modulo:c.module,doneAt:c.now,items:clone(order.items)});}
  }
  else if(type==='cancel'){
   if(order.items.some(l=>l.deliveredQuantity>0)||Number(order.payment?.amount||0)-Number(order.payment?.refundedAmount||0)>0||order.payment?.status==='paid')fail('El pedido requiere devolución autorizada.');if(['cancelled','rejected'].includes(order.status))fail('Pedido ya cancelado.');for(const l of order.items){reservations.quantities[l.id]=Math.max(0,Number(reservations.quantities[l.id]||0)-l.quantity);for(const r of l.resourceReservations||[])reservations.materials[r.id]=Math.max(0,Number(reservations.materials[r.id]||0)-r.quantity);}if(order.customerHash)reservations.pending[order.customerHash]=Math.max(0,Number(reservations.pending[order.customerHash]||0)-1);order.status='rejected';order.rejectionReason=D.text(input.reason,300);db.comandasActivas=(db.comandasActivas||[]).filter(x=>x.menuOrderId!==order.id);
  }
  else fail('Operación desconocida.','invalid-argument');order.updatedAt=c.now;result={ok:true,orderId:order.id,status:order.status,payment:order.payment};
 }
 state.version=Number(state.version||0)+1;db.posModules[c.module]=state;db.posAudit||=[];db.posAudit.push({id:c.operationId,owner:c.owner,modulo:c.module,type,actor:c.actor,createdAt:c.now,orderId:order?.id||null,version:state.version});return {payload:db,result:{...result,version:state.version},order,reservations};
}
module.exports={apply,canonical,PosError};
