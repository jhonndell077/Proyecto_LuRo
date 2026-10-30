/* Contenedor visual para conservar columnas legibles sin ensanchar la página. */
(() => {
 'use strict';
 function adaptTables(root=document){
  const tables=[...(root.matches?.('.content-section table')?[root]:[]),...root.querySelectorAll('.content-section table')];
  for(const table of tables){
   if(table.parentElement?.classList.contains('luro-table-viewport'))continue;
   const viewport=document.createElement('div');viewport.className='luro-table-viewport';viewport.tabIndex=0;viewport.setAttribute('role','region');
   viewport.setAttribute('aria-label',((table.closest('.content-section')?.querySelector('h2')?.textContent||'Tabla').trim())+' · desliza para ver las columnas');
   table.before(viewport);viewport.append(table);
  }
 }
 document.addEventListener('DOMContentLoaded',()=>{
  adaptTables();
  let pending=false;
  new MutationObserver(records=>{
   if(pending||!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('table')||n.querySelector('table')))))return;
   pending=true;requestAnimationFrame(()=>{pending=false;adaptTables();});
  }).observe(document.body,{childList:true,subtree:true});
 });
})();
