'use strict';
// Compatibility boundary: snapshots must never replace server-owned POS domains.
const D=require('./menu-domain');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const arrays=['platos','almacen','produccion_stock','ventas','entradas','decomisos','historial_prod','facturasResumen','comandasActivas','comandasHistorial','inventoryRecounts'];
function protectManaged(incoming,current,options={}){
 const modules=Object.keys(current.posModules||{}).filter(m=>current.posModules[m]?.managed);
 const managed=row=>modules.includes(row?.modulo);
 for(const key of ['posModules','posPayments','posDeliveries','inventoryMovements','posAudit']){if(Object.hasOwn(current,key))incoming[key]=current[key];else delete incoming[key];}
 if(!modules.length)return incoming;
 for(const key of arrays){let previous=(current[key]||[]).filter(managed),next=(incoming[key]||[]).filter(managed);if(options.catalogAdmin&&['platos','almacen','produccion_stock'].includes(key)){const physical=row=>({id:key==='platos'?D.dishId(row):(row.id||row.nombre),modulo:row.modulo,actual:key==='platos'?row.stock:row.actual,unidad:row.unidad||'',costo:key==='platos'?row.costo:row.costoUnitario,consumptionPolicy:row.consumptionPolicy||'on-demand'});previous=previous.map(physical);next=next.map(physical);}if(canonical(previous)!==canonical(next))throw Error('Este módulo utiliza el motor POS. Actualiza la base y registra los cambios mediante sus operaciones.');}
 // Account maps predate module IDs; preserving them prevents old tabs changing managed accounts.
 for(const key of ['mesasEstado','mesaCuentas','mesaEstadoVenta','mesaClienteVenta','menuOrderReceipts']){if(canonical(incoming[key]||{})!==canonical(current[key]||{}))throw Error('Hay cuentas del motor POS. Actualiza antes de guardar cambios de mesas.');}
 return incoming;
}
module.exports={protectManaged,canonical};
