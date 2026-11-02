/* Campana común: avisos persistentes de almacén y avisos existentes de pedidos/tareas. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),qty=x=>Number(x||0).toLocaleString('es-DO',{maximumFractionDigits:4});
 let tab='stock',busy=false,pending=false,viewKey='';
 const allowed=()=>!!sesionUser&&tienePermisoPagina('inventario');
 const scope=()=>({owner:ownerDatosActivo(),module:moduloActual});
 const period=()=>{const s=scope();try{return localStorage.getItem('luroInventoryPeriod:'+s.owner+'|'+s.module)==='viernes_domingo'?'viernes_domingo':'lunes_jueves';}catch{return 'lunes_jueves';}};
 function refresh(){
  if(busy||!$('inventory-notification-dialog'))return;busy=true;
  try{
   if(!sesionUser){viewKey='';if($('inventory-notification-dialog').open)$('inventory-notification-dialog').close();$('inventory-notification-history').replaceChildren();$('inventory-notification-current').replaceChildren();$('inventory-notification-count').hidden=true;return;}
   const s=scope(),selected=period(),list=allowed()?LuroInventoryNotices.events(db,s.owner,s.module,selected):[],unread=list.filter(n=>!n.readAt).length;
   const badge=$('inventory-notification-count');badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread;$('luro-alert-toggle').setAttribute('aria-label','Notificaciones: '+unread+' de almacén sin leer');
   $('inventory-notification-scope').textContent='Almacén · '+s.module+' · '+(selected==='lunes_jueves'?'lunes a jueves':'viernes a domingo');
   const needs=allowed()?(db.almacen||[]).filter(p=>LuroInventory.scoped(p,s.owner,s.module)&&Number(p.actual)<LuroInventory.target(p,selected)):[];
   const nextKey=JSON.stringify([s.owner,s.module,selected,tab,allowed(),list,needs.map(p=>[p.nombre,p.unidad,p.actual,LuroInventory.target(p,selected)]),$('menu-floating-notice')?.hidden]);if(nextKey===viewKey)return;viewKey=nextKey;
   $('inventory-notification-current').innerHTML=needs.map(p=>'<article class="inventory-notice-card inventory-notice-short"><strong>'+E(p.nombre)+'</strong><p>Necesita reponer '+qty(Math.max(0,LuroInventory.target(p,selected)-Number(p.actual||0)))+' '+E(p.unidad)+'. Existencia: '+qty(p.actual)+'. Meta: '+qty(LuroInventory.target(p,selected))+'.</p><button type="button" class="btn" data-notice-product="'+E(p.nombre)+'">Ver en Almacén</button></article>').join('')||'<p>'+(allowed()?'No hay reposiciones pendientes.':'Tu sesión no tiene permiso para consultar Almacén.')+'</p>';
   $('inventory-notification-history').innerHTML=list.map(n=>'<article class="inventory-notice-card '+(!n.readAt?'inventory-notice-unread':'')+'"><strong>'+E(n.producto)+'</strong><p>'+(n.type==='movement'?'Movimiento: '+qty(n.previous)+' → '+qty(n.quantity)+' '+E(n.unidad)+'.':'Aviso de reposición. Existencia: '+qty(n.quantity)+' '+E(n.unidad)+'. Meta: '+qty(n.target)+'.')+'</p><small>'+E(new Date(n.createdAt).toLocaleString('es-DO'))+' · '+(n.readAt?'Leída':'Sin leer')+'</small></article>').join('')||'<p>No hay movimientos registrados todavía.</p>';
   $('inventory-notification-read').disabled=!unread;
   $('inventory-notification-stock').hidden=tab!=='stock';$('inventory-notification-other').hidden=tab!=='other';
   $('inventory-notification-stock-tab').setAttribute('aria-pressed',String(tab==='stock'));$('inventory-notification-other-tab').setAttribute('aria-pressed',String(tab==='other'));
   const other=$('menu-floating-notice');$('inventory-notification-other-empty').hidden=!!other&&!other.hidden;
  }finally{busy=false;}
 }
 function sync(){if(!sesionUser)return refresh();try{if(LuroInventoryNotices.observe(db)||pending||window.__inventoryNoticesPending){pending=true;guardarDatos();pending=false;$('inventory-notification-save-error').textContent='';}refresh();}catch{$('inventory-notification-save-error').textContent='No se pudieron guardar los avisos. Revisa el almacenamiento y la sincronización.';}}
 function mount(){
  const bell=$('luro-alert-toggle');if(!bell)return;
  const dialog=document.createElement('dialog');dialog.id='inventory-notification-dialog';dialog.className='luro-work-dialog';dialog.innerHTML='<div class="luro-work-head"><h2>Notificaciones</h2><button id="inventory-notification-close" type="button" aria-label="Cerrar notificaciones">×</button></div><div class="inventory-notification-tabs"><button id="inventory-notification-stock-tab" type="button" aria-pressed="true">Almacén</button><button id="inventory-notification-other-tab" type="button" aria-pressed="false">Pedidos y tareas</button></div><p id="inventory-notification-save-error" role="status"></p><section id="inventory-notification-stock"><p id="inventory-notification-scope"></p><button id="inventory-notification-read" type="button" class="btn">Marcar todas como leídas</button><h3>Reposiciones pendientes</h3><div id="inventory-notification-current"></div><h3>Historial reciente</h3><p>Se conservan los últimos 200 avisos por módulo. Leer un aviso no elimina una reposición pendiente.</p><div id="inventory-notification-history"></div></section><section id="inventory-notification-other" hidden><p id="inventory-notification-other-empty">No hay avisos de pedidos o tareas.</p></section>';document.body.append(dialog);
  const other=$('menu-floating-notice');if(other)$('inventory-notification-other').append(other);
  const badge=document.createElement('span');badge.id='inventory-notification-count';badge.hidden=true;badge.setAttribute('aria-hidden','true');bell.append(badge);
  bell.onclick=()=>{if(!sesionUser)return;sync();if(!dialog.open){dialog.showModal();document.body.classList.add('luro-alerts-open');bell.setAttribute('aria-expanded','true');}};
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-menu-nav]'))dialog.close();const p=e.target.closest('[data-notice-product]');if(p&&allowed()){dialog.close();showPage('inventario');$('buscarProductoAlmacen').value=p.dataset.noticeProduct;renderAlmacen();}});
  $('inventory-notification-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{document.body.classList.remove('luro-alerts-open');bell.setAttribute('aria-expanded','false');});
  $('inventory-notification-stock-tab').onclick=()=>{tab='stock';refresh();};$('inventory-notification-other-tab').onclick=()=>{tab='other';refresh();};
  $('inventory-notification-read').onclick=()=>{if(!allowed())return;const s=scope();const before=structuredClone(db.inventoryNotifications);try{LuroInventoryNotices.readAll(db,s.owner,s.module,period());guardarDatos();$('inventory-notification-save-error').textContent='';}catch{db.inventoryNotifications=before;$('inventory-notification-save-error').textContent='No se pudo guardar la lectura de los avisos.';}refresh();};
  window.LuroInventoryNotificationPanel={refresh,sync};window.addEventListener('luro-inventory-notices',refresh);setInterval(sync,1500);refresh();
 }
 document.addEventListener('DOMContentLoaded',mount);
})();
