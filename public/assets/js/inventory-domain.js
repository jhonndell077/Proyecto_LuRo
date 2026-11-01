/* Inventario y reposición: reglas puras compartidas con la interfaz. */
(function(root){
 'use strict';
 const key=x=>String(x??'').trim().toLowerCase();
 const finite=(x,label)=>{const n=Number(x);if(!Number.isFinite(n)||n<0)throw Error(label+' debe ser un número no negativo.');return n;};
 const scoped=(p,owner,module)=>key(p?.owner)===key(owner)&&p.modulo===module;
 function target(p,period){return finite((period==='viernes_domingo'?p.stockViernesDomingo:p.stockLunesJueves)??p.ideal??0,'Meta');}
 function shopping(db,owner,module,period='lunes_jueves'){
  if(!['lunes_jueves','viernes_domingo'].includes(period))throw Error('Período inválido.');
  return (db.almacen||[]).filter(p=>scoped(p,owner,module)).map(p=>{
   const stock=target(p,period),actual=finite(p.actual??0,'Existencia'),missing=Math.max(0,stock-actual);
   const name=key(p.miseProducto||p.nombre);const prepared=(db.produccion_stock||[]).filter(x=>scoped(x,owner,module)&&key(x.nombre)===name).reduce((n,x)=>{try{return n+root.LuroStock.convert(finite(x.actual??0,'Producción'),x.unidad,p.unidad);}catch{return n;}},0);
   // Una misma producción no puede cubrir varios productos por alias.
   const ambiguous=(db.almacen||[]).filter(x=>scoped(x,owner,module)&&key(x.miseProducto||x.nombre)===name).length>1;
   const covered=missing>0&&!ambiguous&&prepared>=missing,quantity=covered?0:missing;
   return {item:p,nombre:p.nombre,unidad:p.unidad,distribuidor:p.distribuidor||'',categoria:p.categoria||'Sin categoría',stock,actual,missing,prepared,covered,quantity,cost:quantity*finite(p.costoUnitario??0,'Costo')};
  }).filter(r=>r.missing>0).sort((a,b)=>a.covered-b.covered||a.distribuidor.localeCompare(b.distribuidor)||a.nombre.localeCompare(b.nombre));
 }
 function update(db,item,values,owner,module,operator){
  if(!(db.almacen||[]).includes(item)||!scoped(item,owner,module))throw Error('Producto fuera de la cuenta o módulo actual.');
  const next={...item,codigo:String(values.codigo||'').trim(),categoria:String(values.categoria||'').trim(),distribuidor:String(values.distribuidor||'').trim(),miseProducto:String(values.miseProducto||'').trim(),stockLunesJueves:finite(values.stockLunesJueves,'Meta lunes-jueves'),stockViernesDomingo:finite(values.stockViernesDomingo,'Meta viernes-domingo'),costoUnitario:finite(values.costoUnitario,'Costo'),actual:finite(values.actual,'Existencia')};
  next.ideal=next.stockLunesJueves;
  if(next.codigo&&(db.almacen||[]).some(p=>p!==item&&scoped(p,owner,module)&&key(p.codigo)===key(next.codigo)))throw Error('El código ya pertenece a otro producto.');
  const before=finite(item.actual??0,'Existencia anterior');
  if(before!==next.actual){db.inventoryRecounts=[...(db.inventoryRecounts||[]),{owner,modulo:module,producto:item.nombre,unidad:item.unidad,anterior:before,actual:next.actual,diferencia:next.actual-before,operador:operator,fecha:new Date().toISOString(),tipo:'recuento'}];}
  Object.assign(item,next);return item;
 }
 const api={key,scoped,target,shopping,update};root.LuroInventory=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
