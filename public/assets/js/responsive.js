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
 function adaptDateRanges(){
  for(const input of document.querySelectorAll('.content-section input[type="date"]')){
   const group=input.parentElement;
   if(group.classList.contains('luro-date-range')||group.children.length!==2)continue;
   const fields=[...group.children];
   if(!fields.every(el=>el.matches('input[type="date"]')))continue;
   group.classList.add('luro-date-range');group.style.removeProperty('grid-template-columns');group.setAttribute('role','group');group.setAttribute('aria-label','Filtrar por fechas');
   fields.forEach((field,index)=>{
    const label=document.createElement('label');label.className='luro-date-label';
    const caption=document.createElement('span');caption.textContent=index===0?'Desde':'Hasta';label.append(caption);
    field.before(label);label.append(field);
   });
  }
 }
 document.addEventListener('DOMContentLoaded',()=>{
  adaptTables();adaptDateRanges();
  let pending=false;
  new MutationObserver(records=>{
   if(pending||!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('table,input[type="date"]')||n.querySelector('table,input[type="date"]')))))return;
   pending=true;requestAnimationFrame(()=>{pending=false;adaptTables();adaptDateRanges();});
  }).observe(document.body,{childList:true,subtree:true});
 });
})();
