/* LuRo owns the storefront. Uses the existing login and cloud sync. */
(() => {
  'use strict';
  const site = 'https://the-proyect-menu-mobile.jhonndell077.chatgpt.site/';
  const el = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let list = [], busy = false, polling = false, previousScope = '', seen = new Set();
  const owner = () => String(window.obtenerOwnerSesionActual?.() || '').trim().toLowerCase();
  const moduleName = () => typeof moduloActual === 'string' ? moduloActual : '';
  const authorized = () => typeof sesionUser !== 'undefined' && !!sesionUser && typeof esColaboradorSesion !== 'undefined' && !esColaboradorSesion && !!owner();
  const operator = () => typeof sesionUser !== 'undefined' && !!sesionUser && !!owner() && (authorized() || typeof permisosSesion !== 'undefined' && permisosSesion.some(x => ['salida','comandas'].includes(x)));
  const status = (message, error = false) => { if(el('menu-admin-status')){el('menu-admin-status').textContent=message;el('menu-admin-status').style.color=error?'#c0392b':'#20754b';} };
  function url(external = false) {
    const u = new URL(external ? site : 'menu/index.html', location.href);
    u.searchParams.set('owner',owner());u.searchParams.set('module',moduleName());return u;
  }
  function mount() {
    if(el('luro-menu-admin'))return;
    const host=el('configuracion'); if(!host)return;
    const card=document.createElement('section');card.id='luro-menu-admin';card.className='card';
    card.innerHTML=`<h2>Administración de la app del menú</h2><p>LuRo controla el catálogo, las ofertas y los pedidos. Los pedidos requieren aceptación de caja; el cobro se registra desde Mesas.</p>
      <p id="menu-admin-status" role="status" aria-live="polite"></p>
      <form id="menu-settings-form" class="menu-admin-grid">
      <label><input type="checkbox" id="menu-enabled"> Habilitar menú y recepción de pedidos para el módulo activo</label>
      <label>Nombre del restaurante<input id="menu-business" maxlength="160" required></label>
      <label>Logo (URL HTTPS)<input type="url" id="menu-logo"></label>
      <label>Portada (URL HTTPS)<input type="url" id="menu-hero"></label>
      <label>Instagram oficial<input type="url" id="menu-instagram"></label>
      <button class="btn btn-save" type="submit">Guardar y sincronizar con la app</button></form>
      <p><a id="menu-live-link" target="_blank" rel="noopener">Abrir menú conectado a LURO</a> · <a id="menu-local-link" target="_blank" rel="noopener">Abrir sitio externo</a></p>
      <h3>Presentación, ofertas y nutrición de los platos</h3><p>El precio y la existencia se administran en Disponibilidad. Los nutrientes se registran por porción preparada; un dato vacío se muestra como pendiente.</p>
      <label>Plato<select id="menu-dish-select"><option value="">Seleccionar</option></select></label>
      <form id="menu-dish-form" class="menu-admin-grid" hidden>
      <label>Categoría<input id="menu-category" maxlength="60"></label><label>Fotografía (URL HTTPS)<input id="menu-image" type="url"></label>
      <label>Descripción<textarea id="menu-description" maxlength="700"></textarea></label><label><input id="menu-hidden" type="checkbox"> Ocultar en la app</label>
      <label>Descuento (%)<input id="menu-offer" type="number" min="0" max="100" step="0.01"></label><label>Oferta válida hasta<input id="menu-offer-until" type="datetime-local"></label>
      <label>Porción preparada<input id="menu-portion" placeholder="Ej. 250 g · 1 plato" maxlength="100"></label>
      ${[['energiaKcal','Energía (kcal)'],['proteinasG','Proteínas (g)'],['carbohidratosG','Carbohidratos (g)'],['grasasG','Grasas (g)'],['fibraG','Fibra (g)'],['sodioMg','Sodio (mg)']].map(([k,label])=>`<label>${label}<input id="menu-n-${k}" type="number" min="0" step="0.01"></label>`).join('')}
      <label>Alérgenos declarados<textarea id="menu-allergens" maxlength="400"></textarea></label><button class="btn btn-save" type="submit">Guardar ficha del plato</button></form>
      <h3>Acceso privado del cliente</h3><p>Selecciona un cliente de Clientes y puntos. El enlace privado permite consultar sus puntos e historial durante 30 días; entrégaselo únicamente a ese cliente.</p><select id="menu-customer-select"></select><button id="menu-customer-link" class="btn btn-blue" type="button">Generar enlace privado</button><input id="menu-customer-url" readonly aria-label="Enlace privado del cliente" hidden>
      <h3>Pedidos de la app <button id="menu-refresh" class="btn btn-blue" type="button">Actualizar</button></h3><div id="menu-orders-list">Conecta tu sesión cloud para consultar pedidos.</div>`;
    host.prepend(card);
    const style=document.createElement('style');style.textContent='.menu-admin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.menu-admin-grid label{display:flex;flex-direction:column;gap:5px}.menu-admin-grid input,.menu-admin-grid textarea,#menu-customer-url{width:100%;padding:9px;box-sizing:border-box}.menu-admin-order{border:1px solid #bbcbd9;padding:12px;margin:10px 0;border-radius:10px}.menu-admin-order button{margin:5px}.menu-admin-grid[hidden]{display:none}';document.head.append(style);
    el('menu-settings-form').addEventListener('submit',saveSettings);
    el('menu-dish-select').addEventListener('change',loadDish);
    el('menu-dish-form').addEventListener('submit',saveDish);
    el('menu-customer-link').addEventListener('click',customerLink);
    el('menu-refresh').addEventListener('click',()=>refresh(true));
    el('menu-orders-list').addEventListener('click',async e=>{const b=e.target.closest('button[data-order]');if(b)await transition(b.dataset.order,b.dataset.next);});
    const ops=document.createElement('section');ops.id='menu-operations';ops.className='card';ops.innerHTML='<h3>Pedidos de la app</h3><p id="menu-orders-status" role="status" aria-live="polite"></p>';ops.append(el('menu-refresh'),el('menu-orders-list'));(el('salida')||host).prepend(ops);
    const output=el('salida');if(output){const banner=document.createElement('div');banner.id='menu-cashier-banner';banner.className='card';banner.hidden=true;banner.innerHTML='<strong id="menu-pending-count"></strong> <button class="btn btn-blue" type="button">Revisar pedidos del menú</button>';banner.querySelector('button').onclick=()=>{showPage('salida');ops.scrollIntoView({behavior:'smooth'});};output.prepend(banner);}
  }
  function loadSettings() {
    const m=moduleName(),config=db.menuIntegration?.[m]||{};
    el('menu-enabled').checked=config.enabled===true;el('menu-business').value=config.business||obtenerNombreNegocioActual?.()||'';
    el('menu-logo').value=config.logo||'';el('menu-hero').value=config.heroImage||'';el('menu-instagram').value=config.instagram||'';
    el('menu-live-link').href=url().href;el('menu-local-link').href=url(true).href;
    el('menu-dish-select').innerHTML='<option value="">Seleccionar plato</option>'+(db.platos||[]).map((p,i)=>p.owner?.toLowerCase()===owner()&&p.modulo===m?`<option value="${i}">${esc(p.nombre)}</option>`:'').join('');
    el('menu-customer-select').innerHTML=(db.clientesFidelizacion||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
  }
  async function upload() {
    guardarDatos();
    if(typeof window.subirBaseActualAlCloud!=='function')throw Error('La conexión cloud no está disponible.');
    if(!await window.subirBaseActualAlCloud({silent:true}))throw Error('No se subieron los cambios; revisa el estado de sincronización.');
  }
  const secureImage=x=>!x||/^https:\/\//i.test(x);
  async function saveSettings(e){e.preventDefault();if(!authorized())return;
    try{const logo=el('menu-logo').value.trim(),heroImage=el('menu-hero').value.trim(),instagram=el('menu-instagram').value.trim();if(!secureImage(logo)||!secureImage(heroImage)||instagram&&!/^https:\/\/(www\.)?instagram\.com\//i.test(instagram))throw Error('Usa imágenes HTTPS y un enlace oficial de Instagram.');
      db.menuIntegration ||= {};db.menuIntegration[moduleName()]={enabled:el('menu-enabled').checked,business:el('menu-business').value.trim(),logo,heroImage,instagram};await upload();status('Configuración sincronizada. La app consulta la disponibilidad de este módulo.');loadSettings();
    }catch(e){status(e.message,true);}}
  function chosen(){const raw=el('menu-dish-select').value;if(raw==='')return null;const p=db.platos[Number(raw)];return p&&p.owner?.toLowerCase()===owner()&&p.modulo===moduleName()?p:null;}
  function loadDish(){const p=chosen();el('menu-dish-form').hidden=!p;if(!p)return;const m=p.menu||{},n=m.nutrition||{};el('menu-category').value=m.category||'';el('menu-image').value=m.image||'';el('menu-description').value=m.description||'';el('menu-hidden').checked=m.hidden===true;el('menu-offer').value=m.offerPercent||0;el('menu-offer-until').value=m.offerUntil?new Date(Date.parse(m.offerUntil)-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';el('menu-portion').value=n.portion||'';el('menu-allergens').value=m.allergens||'';for(const k of ['energiaKcal','proteinasG','carbohidratosG','grasasG','fibraG','sodioMg'])el('menu-n-'+k).value=n[k]??'';}
  async function saveDish(e){e.preventDefault();if(!authorized())return;const p=chosen();if(!p)return;try{const image=el('menu-image').value.trim();if(!secureImage(image))throw Error('La foto debe usar HTTPS.');const discount=Number(el('menu-offer').value);const end=el('menu-offer-until').value;if(discount>0&&(!end||Date.parse(end)<=Date.now()))throw Error('Indica una fecha futura para la oferta.');const nutrition={portion:el('menu-portion').value.trim()};for(const k of ['energiaKcal','proteinasG','carbohidratosG','grasasG','fibraG','sodioMg'])nutrition[k]=el('menu-n-'+k).value===''?null:Number(el('menu-n-'+k).value);
    p.menu={category:el('menu-category').value.trim(),image,description:el('menu-description').value.trim(),hidden:el('menu-hidden').checked,offerPercent:discount,offerUntil:end?new Date(end).toISOString():'',allergens:el('menu-allergens').value.trim(),nutrition};await upload();status('Ficha, oferta y nutrición sincronizadas.');}catch(e){status(e.message,true);}}
  async function customerLink(){if(!authorized())return;try{const r=await window.luroMenuAdminCall('menuCreateCustomerLink',{module:moduleName(),customerId:el('menu-customer-select').value});const u=url();u.hash='access='+r.accessToken;el('menu-customer-url').hidden=false;el('menu-customer-url').value=u.href;el('menu-customer-url').select();status('Enlace privado creado. Entrégalo únicamente al cliente seleccionado.');}catch(e){status(e.message,true);}}
  const labels={pending:'Esperando aceptación de caja',accepted:'Aceptado · pendiente de cocina',preparing:'En preparación',ready:'Listo',delivered:'Entregado',rejected:'Rechazado'};
  function renderOrders(){const pending=list.filter(o=>o.status==='pending').length;const banner=el('menu-cashier-banner');if(banner){banner.hidden=!pending;el('menu-pending-count').textContent=`${pending} pedido(s) de la app esperan aceptación de caja.`;}
    el('menu-orders-list').innerHTML=list.map(o=>`<article class="menu-admin-order"><strong>${esc(o.id)} · ${esc(labels[o.status])}</strong><p>${esc(o.customer?.name)} ${o.mesa?'· '+esc(o.mesa):''} · RD$${Number(o.total).toFixed(2)} · ${o.payment?.status==='paid'?'Cobrado en LuRo':'Pendiente de cobro'}</p><p>${o.items.map(i=>`${i.quantity} × ${esc(i.name)}${i.notes?' — '+esc(i.notes):''}`).join('<br>')}</p>${o.notes?'<p>'+esc(o.notes)+'</p>':''}${o.status==='pending'?`<button class="btn btn-save" data-order="${o.id}" data-next="accepted">Aceptar y enviar a cocina</button><button class="btn btn-danger" data-order="${o.id}" data-next="rejected">Rechazar</button>`:''}${[['accepted','preparing','Cocina acepta · comenzar'],['preparing','ready','Marcar listo'],['ready','delivered','Marcar entregado']].filter(([from])=>from===o.status).map(([,to,label])=>`<button class="btn btn-blue" data-order="${o.id}" data-next="${to}">${label}</button>`).join('')}</article>`).join('')||'No hay pedidos en este módulo.';
  }
  async function refresh(manual=false){if(!operator()||polling||busy)return;polling=true;try{const r=await window.luroMenuAdminCall('menuListOrders',{module:moduleName()});list=r.orders||[];el('menu-orders-status').textContent='Conectado a LURO · '+moduleName()+' · actualizado '+new Date().toLocaleTimeString('es-DO');const added=list.filter(o=>o.status==='pending'&&!seen.has(o.id));seen=new Set(list.map(o=>o.id));renderOrders();if(added.length)status(`${added.length} pedido(s) nuevo(s): caja debe aceptarlos para enviar a cocina.`);else if(manual)status('Pedidos actualizados.');}catch(e){el('menu-orders-status').textContent='No se pudieron actualizar los pedidos: '+e.message;if(manual)status(e.message,true);}finally{polling=false;}}
  async function transition(id,next){if(!operator()||busy)return;busy=true;try{if(!await window.subirBaseActualAlCloud?.({silent:true}))throw Error('Sincroniza los cambios locales antes de aceptar o actualizar el pedido.');let reason='';if(next==='rejected'){reason=prompt('Motivo del rechazo:')||'';if(!reason.trim())return;}await window.luroMenuAdminCall('menuUpdateOrder',{module:moduleName(),id,status:next,reason});if(['accepted','ready'].includes(next))await window.descargarBaseDesdeCloud({silent:true,reload:false,force:true});status('Pedido actualizado. El cliente verá el estado en la app.');}catch(e){status(e.message,true);}finally{busy=false;await refresh();}}
  document.addEventListener('DOMContentLoaded',()=>{
    mount();
    const navigate=window.showPage;
    window.showPage=function(id){const result=navigate?.(id);if(['salida','comandas'].includes(id)&&el(id)&&el('menu-operations'))el(id).prepend(el('menu-operations'));return result;};
    // The existing kitchen completion control updates the same canonical web order.
    const finish=window.finalizarComanda;
    window.finalizarComanda=async function(id){const c=(db.comandasActivas||[]).find(x=>x.id===id);if(!c?.menuOrderId)return finish?.(id);let o=list.find(x=>x.id===c.menuOrderId);if(!o){await refresh(true);o=list.find(x=>x.id===c.menuOrderId);}if(o?.status==='accepted'){await transition(o.id,'preparing');o=list.find(x=>x.id===c.menuOrderId);}if(o?.status==='preparing')await transition(o.id,'ready');};
    setInterval(()=>{if(!el('luro-menu-admin'))return;el('luro-menu-admin').hidden=!authorized();if(el('menu-operations'))el('menu-operations').hidden=!operator();const scope=owner()+'|'+moduleName();if(operator()&&scope!==previousScope){previousScope=scope;seen=new Set();loadSettings();refresh();}},1500);
    setInterval(()=>refresh(),12000);
  });
})();
