/* Reglas de stock compartidas por disponibilidad y producción. Sin acceso a red. */
(function(root){
 'use strict';
 const key=x=>String(x||'').trim().toLowerCase();
 const units={g:['peso',1],Kg:['peso',1000],Lb:['peso',453.59],Oz:['peso',28.35],mL:['volumen',1],Litros:['volumen',1000],Lt:['volumen',1000],Unidad:['unidad',1],Unid:['unidad',1]};
 function convert(q,from,to){const a=units[from],b=units[to];if(!Number.isFinite(q)||!a||!b||a[0]!==b[0])throw Error('Unidades incompatibles: '+from+' / '+to);return q*a[1]/b[1];}
 function scoped(row,owner,module){return key(row?.owner)===key(owner)&&row?.modulo===module;}
 function source(db,name,owner,module,origin){
  const lists=origin==='almacen'?[db.almacen]:origin==='produccion'?[db.produccion_stock]:[db.produccion_stock,db.almacen];
  const matches=lists.flatMap(xs=>(xs||[]).filter(x=>scoped(x,owner,module)&&key(x.nombre)===key(name)));
  return matches.find(x=>Number(x.actual)>0)||matches[0];
 }
 function requirements(db,recipe,owner,module,multiplier=1,origin){
  if(!Array.isArray(recipe)||!recipe.length)throw Error('Registra los insumos de la receta antes de cargar existencias.');
  const map=new Map();
  for(const ing of recipe){
   const qty=Number(ing.cantidad),waste=Number(ing.merma||0),realWaste=Number(ing.mermaReal||0);
   if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(waste)||waste<0||waste>=100||!Number.isFinite(realWaste)||realWaste<0)throw Error('Cantidad o merma inválida en '+(ing.nombre||'insumo'));
   const item=source(db,ing.nombre,owner,module,ing.origen||origin);
   if(!item)throw Error('Insumo no disponible: '+ing.nombre);
   const net=convert(qty,ing.unidad,item.unidad)*multiplier,expected=net/(1-waste/100)-net,actual=realWaste>0?convert(realWaste,ing.unidad,item.unidad)*multiplier:expected;
   const need=net+actual;
   const entry=map.get(item)||{item,quantity:0,waste:0,expectedWaste:0};entry.quantity+=need;entry.waste+=actual;entry.expectedWaste+=expected;map.set(item,entry);
  }
  return [...map.values()];
 }
 function capacity(db,dish,owner,module){try{return Math.max(0,Math.floor(Math.min(...requirements(db,dish.receta,owner,module).map(r=>(Number.isFinite(Number(r.item.actual))?Math.max(0,Number(r.item.actual)):0)/r.quantity))+1e-9));}catch{return 0;}}
 function plan(db,input,owner,module){
  const quantity=Number(input.quantity),name=String(input.name||'').trim(),ideal=Number(input.ideal??10);
  if(!Number.isFinite(ideal)||ideal<0)throw Error('La existencia ideal debe ser un número mayor o igual a cero.');
  if(!name||!Number.isFinite(quantity)||quantity<=0||!units[input.unit])throw Error('Indica nombre, cantidad positiva y unidad de producción.');
  const requirementsList=input.direct?[]:requirements(db,input.recipe,owner,module,1,'almacen');
  for(const r of requirementsList)if(!Number.isFinite(Number(r.item.actual))||Number(r.item.actual)+1e-9<r.quantity)throw Error('Existencia insuficiente: '+r.item.nombre);
  const cost=input.direct?Number(input.cost):requirementsList.reduce((sum,r)=>sum+r.quantity*(Number(r.item.costoUnitario)||0),0);
  if(!Number.isFinite(cost)||cost<0)throw Error('El costo debe ser un número positivo o cero.');
  const existing=(db.produccion_stock||[]).find(x=>scoped(x,owner,module)&&key(x.nombre)===key(name));
  if(existing){convert(quantity,input.unit,existing.unidad);if(requirementsList.some(r=>r.item===existing))throw Error('La producción no puede consumirse a sí misma. Usa un nombre distinto para el nuevo producto.');}
  return {name,quantity,unit:input.unit,cost,requirements:requirementsList,existing,recipe:input.recipe||[],ideal,instructions:String(input.instructions||'')};
 }
 function commit(db,p,owner,module,operator,id){
  const amount=p.existing?convert(p.quantity,p.unit,p.existing.unidad):p.quantity;
  const old=Math.max(0,Number(p.existing?.actual)||0),oldValue=old*(Number(p.existing?.costoUnitario)||0);
  // Toda la validación sucede en plan(), antes de modificar la primera existencia.
  for(const r of p.requirements)r.item.actual=Math.max(0,Number(r.item.actual)-r.quantity);
  const target=p.existing||{owner,modulo:module,nombre:p.name,actual:0,unidad:p.unit};
  target.actual=old+amount;target.costoUnitario=(oldValue+p.cost)/target.actual;target.ideal=p.ideal;
  if(p.recipe.length){target.receta=p.recipe;target.recetaRendimiento=p.quantity;target.recetaUnidad=p.unit;target.instrucciones=p.instructions;}
  if(!p.existing){db.produccion_stock||=[];db.produccion_stock.push(target);}
  db.historial_prod||=[];const record={id,owner,modulo:module,fecha:new Date().toLocaleString('es-DO'),producto:p.name,cantidad:p.quantity+' '+p.unit,costoOp:p.cost,operador:operator,insumos:p.requirements.map(r=>({nombre:r.item.nombre,cantidad:r.quantity,unidad:r.item.unidad,merma:r.waste,mermaEsperada:r.expectedWaste,alertaMerma:r.waste>r.expectedWaste+1e-9,origen:(db.produccion_stock||[]).includes(r.item)?'produccion':'almacen'})),tipo:p.requirements.length?'produccion':'carga-realizada',lote:{nombre:target.nombre,cantidad:amount,unidad:target.unidad,costo:p.cost},reversible:true};db.historial_prod.push(record);return record;
 }
 function reverse(db,record,owner,module){
  if(!scoped(record,owner,module)||!record.reversible||record.reversedAt||!record.lote)throw Error('Este lote no se puede revertir.');
  const output=(db.produccion_stock||[]).find(x=>scoped(x,owner,module)&&key(x.nombre)===key(record.lote.nombre));
  if(!output||Number(output.actual)+1e-9<record.lote.cantidad)throw Error('El lote ya fue consumido o transferido. No se puede revertir.');
  const returns=(record.insumos||[]).map(i=>{
   const xs=i.origen==='produccion'?db.produccion_stock:db.almacen;
   const item=(xs||[]).find(x=>scoped(x,owner,module)&&key(x.nombre)===key(i.nombre));
   if(!item)throw Error('No se encuentra el insumo para devolverlo: '+i.nombre);
   return {item,quantity:convert(Number(i.cantidad),i.unidad,item.unidad)};
  });
  const value=Math.max(0,Number(output.actual)*(Number(output.costoUnitario)||0)-record.lote.costo);
  output.actual=Math.max(0,Number(output.actual)-record.lote.cantidad);output.costoUnitario=output.actual?value/output.actual:0;
  for(const r of returns)r.item.actual=Number(r.item.actual)+r.quantity;
  record.reversedAt=Date.now();record.reversible=false;return record;
 }
 function transfer(db,item,quantity,targetModule,owner,module,operator,id){
  quantity=Number(quantity);
  if(!scoped(item,owner,module)||!Number.isFinite(quantity)||quantity<=0||quantity>Number(item.actual)||!targetModule||targetModule===module||targetModule==='ADMINISTRADOR')throw Error('Indica un módulo diferente y una cantidad disponible.');
  const existing=(db.produccion_stock||[]).find(x=>scoped(x,owner,targetModule)&&key(x.nombre)===key(item.nombre));
  const converted=existing?convert(quantity,item.unidad,existing.unidad):quantity;
  const cost=quantity*(Number(item.costoUnitario)||0),old=Math.max(0,Number(existing?.actual)||0);
  const target=existing||{...item,modulo:targetModule,actual:0};
  const totalValue=old*(Number(existing?.costoUnitario)||0)+cost;
  item.actual=Number(item.actual)-quantity;target.actual=old+converted;target.costoUnitario=totalValue/target.actual;
  if(!existing)db.produccion_stock.push(target);
  const record={id,owner,modulo:module,fecha:new Date().toLocaleString('es-DO'),producto:item.nombre,cantidad:quantity+' '+item.unidad,costoOp:cost,operador:operator,tipo:'transferencia',destino:targetModule};db.historial_prod.push(record);return record;
 }
 const api={convert,scoped,source,requirements,capacity,plan,commit,reverse,transfer};root.LuroStock=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
