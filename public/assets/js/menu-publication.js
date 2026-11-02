/* Publicación y comprobación del catálogo desde Disponibilidad. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let busy=false,remote=null,checkedScope='',message='',request=0;
 const scope=()=>String(window.obtenerOwnerSesionActual?.()||'').trim().toLowerCase()+'|'+moduloActual;
 const allowed=()=>!!sesionUser&&!esColaboradorSesion&&tienePermisoPagina('disponibilidad');
 const dishes=()=>db.platos.filter(p=>String(p.owner||'').trim().toLowerCase()===scope().split('|')[0]&&p.modulo===moduloActual);
 function render(){
  if(!$('menu-publication'))return;$('menu-publication').hidden=!allowed();if(!allowed())return;
  if(checkedScope!==scope()){remote=null;message='';checkedScope=scope();}
  $('menu-publication-status').textContent=message||'Comprueba qué platos están publicados en The Proyect.';
  const duplicates=new Set();for(const p of dishes()){if(p.menuId&&dishes().filter(x=>x.menuId===p.menuId).length>1)duplicates.add(p.menuId);}
  $('menu-publication-rows').innerHTML=dishes().map(p=>{const i=db.platos.indexOf(p),price=Number(p.precio),found=remote?.items.find(x=>p.menuId?x.id===p.menuId:x.name===String(p.nombre).trim());let state=p.menu?.hidden===true?'Oculto en The Proyect':!Number.isFinite(price)||price<0?'Precio inválido':duplicates.has(p.menuId)?'Identificador duplicado: revisa la ficha':!remote?'Pendiente de comprobar':!found?'No publicado / cambios pendientes':found.price!==price&&!found.offer?'Precio pendiente de sincronizar':Number(found.stock)!==Number(p.stock)?'Disponible para pedidos: '+found.stock+' (las reservas reducen el saldo público)':'Publicado · '+found.stock+' porciones';return '<article class="menu-admin-order"><strong>'+E(p.nombre)+'</strong><p>'+E(state)+'</p><button type="button" class="btn btn-blue" data-publish-dish="'+i+'" '+(busy?'disabled':'')+'>'+(p.menu?.hidden===true?'Mostrar y sincronizar':'Sincronizar plato')+'</button></article>';}).join('')||'<p>No hay platos en este módulo.</p>';
  $('menu-publication-sync').disabled=busy;$('menu-publication-check').disabled=busy;
  const link=$('menu-publication-link');link.href='menu/?'+new URLSearchParams({owner:scope().split('|')[0],module:moduloActual});
 }
 async function catalog(){const [owner,module]=scope().split('|');const response=await fetch('https://us-central1-luro-control.cloudfunctions.net/menuGetCatalog',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({data:{owner,module}}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok||data.error)throw Error(data.error?.message||'No se pudo consultar el catálogo.');return data.result||data.data;}
 async function check(publish,index){if(busy||!allowed())return;const current=scope(),id=++request;busy=true;message=publish?'Sincronizando con The Proyect…':'Consultando catálogo publicado…';render();try{
  if(publish){const chosen=index==null?null:db.platos[index];if(index!=null&&(!chosen||!dishes().includes(chosen)))throw Error('El plato cambió de módulo. Vuelve a abrir Disponibilidad.');
   if(chosen){if(!Number.isFinite(Number(chosen.precio))||Number(chosen.precio)<0)throw Error('Corrige el precio del plato antes de publicarlo.');chosen.menu={...chosen.menu,hidden:false};}
   guardarDatos();if(!await window.subirBaseActualAlCloud?.({silent:true}))throw Error('Los cambios siguen pendientes. Revisa la conexión cloud; no se ha confirmado la publicación.');
  }
  const data=await catalog();if(current!==scope()||id!==request||!allowed())return;remote=data;
  const missing=dishes().filter(p=>p.menu?.hidden!==true&&!data.items.some(x=>p.menuId?x.id===p.menuId:x.name===String(p.nombre).trim()));
  message=missing.length?'Faltan por publicar: '+missing.map(p=>p.nombre).join(', ')+'. Revisa su precio y ficha.':'Catálogo comprobado · '+data.items.length+' platos publicados · '+new Date().toLocaleTimeString('es-DO');
 }catch(error){if(current===scope())message=error.message;}finally{busy=false;render();}}
 document.addEventListener('DOMContentLoaded',()=>{const host=$('disponibilidad');if(!host)return;const panel=document.createElement('section');panel.id='menu-publication';panel.className='card';panel.innerHTML='<h3>Publicación en The Proyect</h3><p id="menu-publication-status" role="status" aria-live="polite"></p><button type="button" class="btn btn-save" id="menu-publication-sync">Sincronizar disponibilidad</button> <button type="button" class="btn" id="menu-publication-check">Comprobar publicación</button><p><a id="menu-publication-link" target="_blank" rel="noopener">Abrir The Proyect conectado a este almacén</a></p><div id="menu-publication-rows"></div>';host.prepend(panel);
  $('menu-publication-sync').onclick=()=>check(true);$('menu-publication-check').onclick=()=>check(false);panel.addEventListener('click',e=>{const button=e.target.closest('[data-publish-dish]');if(button)check(true,Number(button.dataset.publishDish));});
  const original=window.renderDispoTable;window.renderDispoTable=function(){const result=original.apply(this,arguments);render();return result;};
  if(typeof window.showPage==='function'){const navigate=window.showPage;window.showPage=function(id){const result=navigate.apply(this,arguments);if(id==='disponibilidad'&&$('disponibilidad').classList.contains('active'))check(false);return result;};}
  window.LuroMenuPublication={check,render};render();setInterval(render,1500);
 });
})();
