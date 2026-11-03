/* Existing modules remain available; managed writes always use the shared POS engine. */
(() => {
 'use strict';
 const managed=()=>!!sesionUser&&db.posModules?.[moduloActual]?.managed===true;
 function route(){if(!managed())return false;window.LuroPosWorkspace?.open();const status=document.getElementById('pos3-status');if(status)status.textContent='Registra esta operación aquí para confirmar stock y cobros con el servidor.';return true;}
 window.addEventListener('luro-pos-state',event=>{if(event.detail?.managed&&typeof db==='object'){db.posModules||={};db.posModules[moduloActual]={...(db.posModules[moduloActual]||{}),managed:true,policy:event.detail.policy,version:event.detail.version};}});
 document.addEventListener('DOMContentLoaded',()=>{
  const mutations=['agregarAlmacen','entradaAutomaticaMasiva','borrarTodoElAlmacen','eliminarAlmacen','procesarNuevaProduccion','ejecutarDecomisoPlato','ejecutarDecomisoAlmacen','actStock','delPlato','eliminarProduccion','venderPlato','finalizarVenta','transferirAFactura'];
  for(const name of mutations){const original=window[name];if(typeof original!=='function')continue;window[name]=function(){if(route())return false;return original.apply(this,arguments);};}
  document.addEventListener('submit',event=>{if(!managed())return;const id=event.target.id;if(['warehouse-entry-form','inventory-edit-form','production-recipe-form','production-transfer-form'].includes(id)){event.preventDefault();event.stopImmediatePropagation();route();}},true);
  document.addEventListener('click',event=>{if(!managed())return;const control=event.target.closest('[data-inventory-delete],[data-production-action],#inventory-import-commit');if(control){event.preventDefault();event.stopImmediatePropagation();route();}},true);
  const navigate=window.showPage;window.showPage=function(id){if(id==='pos-operaciones'){window.LuroPosWorkspace?.open();return;}return navigate.apply(this,arguments);};
 });
 window.LuroPosCompatibility={managed,route};
})();
