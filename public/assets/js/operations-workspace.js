/* Controles comunes y seguimiento persistente de mesas. */
(() => {
 'use strict';
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let tables=[];
 function currentTables(){
  if(!sesionUser||typeof tienePermisoPagina==='function'&&!tienePermisoPagina('salida'))return [];
  const owner=ownerDatosActivo(),seen=new Set(),result=[];
  for(const name of Object.keys(carritoPorMesa||{})){
   const canonical=mesaCanonica(name);if(seen.has(canonical))continue;seen.add(canonical);
   const items=(carritoPorMesa[canonical]||[]).filter(item=>{
    const dish=db.platos?.[item.originalIndex];
    return dish&&LuroStock.scoped(dish,owner,moduloActual) || item.menuOrderId&&db.menuOrderReceipts?.[item.menuOrderId]?.module===moduloActual;
   });
   if(!items.some(i=>Number(i.cantidad)>0))continue;
   result.push({name:canonical,label:obtenerNombreMesa(canonical),quantity:items.reduce((n,i)=>n+Number(i.cantidad||0),0),total:items.reduce((n,i)=>n+Number(i.cantidad||0)*Number(i.precio||0),0)});
  }
  return result;
 }
 function refresh(){
  const frame=document.getElementById('luro-control-frame');if(!frame)return;
  tables=currentTables();const b=document.getElementById('luro-tables-toggle'),notice=document.getElementById('luro-active-tables-notice');
  b.hidden=!sesionUser||!tienePermisoPagina('salida');b.textContent='Mesas'+(tables.length?' · '+tables.length:'');
  b.setAttribute('aria-label','Mesas: '+tables.length+' activas');
  notice.hidden=!tables.length;notice.textContent=tables.length+' mesa(s) activas · revisar cuentas';
  document.getElementById('luro-tables-list').innerHTML=tables.map((t,i)=>`<button type="button" class="luro-active-table" data-table-index="${i}"><strong>${E(t.label)}</strong><span>${t.quantity} producto(s) · RD$${t.total.toFixed(2)}</span><small>Abrir cuenta</small></button>`).join('')||'<p>No hay mesas activas en este módulo.</p>';
 }
 function mount(){
  if(document.getElementById('luro-control-frame'))return;
  const frame=document.createElement('nav');frame.id='luro-control-frame';frame.setAttribute('aria-label','Controles de LURO');document.body.append(frame);
  for(const id of ['mobile-nav-toggle','luro-alert-toggle','luro-assistant-fab']){const control=document.getElementById(id);if(control)frame.append(control);}
  const button=document.createElement('button');button.type='button';button.id='luro-tables-toggle';button.textContent='Mesas';frame.append(button);
  const notice=document.createElement('button');notice.id='luro-active-tables-notice';notice.type='button';notice.hidden=true;notice.setAttribute('aria-live','polite');document.body.append(notice);
  const dialog=document.createElement('dialog');dialog.id='luro-tables-dialog';dialog.className='luro-work-dialog';dialog.innerHTML='<div class="luro-work-head"><h2>Mesas activas</h2><button type="button" data-close-tables aria-label="Cerrar mesas">×</button></div><p>Cuentas pendientes del módulo actual.</p><div id="luro-tables-list"></div>';document.body.append(dialog);
  const open=()=>{refresh();if(!button.hidden&&!dialog.open)dialog.showModal();};button.onclick=open;notice.onclick=open;
  dialog.querySelector('[data-close-tables]').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{const b=e.target.closest('[data-table-index]');if(!b)return;const table=tables[Number(b.dataset.tableIndex)];if(!table||!tienePermisoPagina('salida'))return;dialog.close();showPage('salida');seleccionarMesaSalida(table.name);});
  window.LuroOperations={refresh,currentTables};refresh();setInterval(refresh,1500);
 }
 // menu-admin monta el botón de alertas en DOMContentLoaded; esperar su montaje.
 document.addEventListener('DOMContentLoaded',mount);
})();
