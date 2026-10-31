/* LuRo owns the storefront. Uses the existing login and cloud sync. */
(() => {
  'use strict';
  const site = 'https://the-proyect-menu-mobile.jhonndell077.chatgpt.site/';
  const el = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selectedDish = null, dirty = false, savingDish = false;
  let tasks = [], taskBusy=false;
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
      <label>Frase de inicio<input id="menu-hero-phrase" maxlength="200" placeholder="Pendiente por incluir"></label><label>Nombre del restaurante<input id="menu-business" maxlength="160" required></label>
      <label>Logo (URL HTTPS)<input type="url" id="menu-logo"></label>
      <label>Portada (URL HTTPS)<input type="url" id="menu-hero"></label>
      <label>Instagram oficial<input type="url" id="menu-instagram"></label>
      <button class="btn btn-save" type="submit">Guardar y sincronizar con la app</button></form>
      <p><a id="menu-live-link" target="_blank" rel="noopener">Abrir menú conectado a LURO</a> · <a id="menu-local-link" target="_blank" rel="noopener">Abrir sitio externo</a></p>
      <h3>Editor visual del menú</h3><p>El precio y la existencia se administran en Disponibilidad. Los nutrientes se registran por porción preparada; un dato vacío se muestra como pendiente.</p>
      <label>Buscar un plato<input id="menu-dish-search" type="search" placeholder="Nombre o categoría"></label>
      <div id="menu-visual-catalog" class="menu-visual-catalog" aria-label="Platos del módulo"></div>
      <div class="menu-editor-layout"><div>
      <label>Plato<select id="menu-dish-select"><option value="">Seleccionar</option></select></label>
      <form id="menu-dish-form" class="menu-admin-grid" hidden>
      <label>Categoría<input id="menu-category" maxlength="60"></label><label>Fotografía (URL HTTPS)<input id="menu-image" type="url"></label>
      <label>Descripción<textarea id="menu-description" maxlength="700"></textarea></label><label><input id="menu-hidden" type="checkbox"> Ocultar en la app</label>
      <label>Descuento (%)<input id="menu-offer" type="number" min="0" max="100" step="0.01"></label><label>Oferta válida hasta<input id="menu-offer-until" type="datetime-local"></label>
      <label>Porción preparada<input id="menu-portion" placeholder="Ej. 250 g · 1 plato" maxlength="100"></label>
      ${[['energiaKcal','Energía (kcal)'],['proteinasG','Proteínas (g)'],['carbohidratosG','Carbohidratos (g)'],['grasasG','Grasas (g)'],['fibraG','Fibra (g)'],['sodioMg','Sodio (mg)']].map(([k,label])=>`<label>${label}<input id="menu-n-${k}" type="number" min="0" step="0.01"></label>`).join('')}
      <label>Alérgenos declarados<textarea id="menu-allergens" maxlength="400"></textarea></label><div class="menu-editor-actions"><p id="menu-draft-status" role="status" aria-live="polite">Selecciona un plato para editar.</p><button class="btn btn-save" type="submit">Guardar ficha del plato</button><button class="btn" id="menu-discard-draft" type="button">Descartar cambios</button></div></form>
      </div><aside id="menu-preview-panel" hidden><h3>Así se verá en el menú</h3><p>Vista previa de esta ficha · formato teléfono</p><iframe id="menu-dish-preview" title="Vista previa del plato en teléfono" sandbox="" referrerpolicy="no-referrer"></iframe><p>El precio y stock corresponden a Disponibilidad; las reservas pueden reducir el stock público.</p></aside></div>
      <h3>Acceso privado del cliente</h3><p>Selecciona un cliente de Clientes y puntos. El enlace privado permite consultar sus puntos e historial durante 30 días; entrégaselo únicamente a ese cliente.</p><select id="menu-customer-select"></select><button id="menu-customer-link" class="btn btn-blue" type="button">Generar enlace privado</button><input id="menu-customer-url" readonly aria-label="Enlace privado del cliente" hidden>
      <h3>Pedidos de la app <button id="menu-refresh" class="btn btn-blue" type="button">Actualizar</button></h3><div id="menu-orders-list">Conecta tu sesión cloud para consultar pedidos.</div>`;
    host.prepend(card);
    const tasksPage=el('tareas-pendientes');
    if(tasksPage){tasksPage.innerHTML='<h2>Tareas Pendientes</h2><p>Solicitudes de la app y contenido por completar del módulo activo.</p><p id="menu-task-status" role="status"></p><div id="menu-task-list"></div>';tasksPage.addEventListener('click',async e=>{const b=e.target.closest('[data-resolve-task]');if(!b||taskBusy)return;taskBusy=true;b.disabled=true;b.setAttribute('aria-busy','true');try{await window.luroMenuAdminCall('menuResolveTask',{module:moduleName(),id:b.dataset.resolveTask,customerId:el('customer-'+b.dataset.resolveTask)?.value});await refreshTasks();}catch(err){el('menu-task-status').textContent=err.message;}finally{taskBusy=false;b.disabled=false;b.removeAttribute('aria-busy');}});}
    const notice=document.createElement('aside');notice.id='menu-floating-notice';notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.style.cssText='position:fixed;bottom:20px;right:20px;z-index:9998;max-width:320px;background:#102c45;color:white;padding:16px;border-radius:12px;box-shadow:0 4px 20px #0005';document.body.append(notice);
    notice.addEventListener('click',e=>{const b=e.target.closest('[data-menu-nav]');if(b)showPage(b.dataset.menuNav);});
    const style=document.createElement('style');style.textContent='.menu-admin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.menu-admin-grid label{display:flex;flex-direction:column;gap:5px}.menu-admin-grid input,.menu-admin-grid textarea,#menu-customer-url{width:100%;padding:9px;box-sizing:border-box}.menu-admin-order{border:1px solid #bbcbd9;padding:12px;margin:10px 0;border-radius:10px}.menu-admin-order button{margin:5px}.menu-admin-grid[hidden]{display:none}';document.head.append(style);
    el('menu-settings-form').addEventListener('submit',saveSettings);
    el('menu-dish-select').addEventListener('change',()=>{
      if(dirty&&!confirm('Hay cambios sin sincronizar. ¿Descartarlos y cambiar de plato?')){el('menu-dish-select').value=String(db.platos.indexOf(selectedDish));return;}
      selectedDish=null;loadDish();
    });
    el('menu-dish-search').addEventListener('input',renderCatalog);
    el('menu-visual-catalog').addEventListener('click',e=>{const b=e.target.closest('[data-edit-dish]');if(!b||savingDish)return;el('menu-dish-select').value=b.dataset.editDish;el('menu-dish-select').dispatchEvent(new Event('change'));el('menu-dish-form').scrollIntoView({behavior:'smooth',block:'start'});});
    el('menu-dish-form').addEventListener('input',()=>{dirty=true;draftStatus('Cambios pendientes · guarda para sincronizar.');renderPreview();});
    el('menu-discard-draft').addEventListener('click',()=>{if(!dirty||confirm('¿Descartar los cambios de este plato?')){dirty=false;loadDish();}});
    window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    el('menu-dish-form').addEventListener('submit',saveDish);
    el('menu-customer-link').addEventListener('click',customerLink);
    el('menu-refresh').addEventListener('click',()=>refresh(true));
    el('menu-orders-list').addEventListener('click',async e=>{const b=e.target.closest('button[data-order]');if(b)await transition(b.dataset.order,b.dataset.next);});
    const ops=document.createElement('section');ops.id='menu-operations';ops.className='card';ops.innerHTML='<h3>Pedidos de la app</h3><p id="menu-orders-status" role="status" aria-live="polite"></p>';ops.append(el('menu-refresh'),el('menu-orders-list'));(el('salida')||host).prepend(ops);
    const output=el('salida');if(output){const banner=document.createElement('div');banner.id='menu-cashier-banner';banner.className='card';banner.hidden=true;banner.innerHTML='<strong id="menu-pending-count"></strong> <button class="btn btn-blue" type="button">Revisar pedidos del menú</button>';banner.querySelector('button').onclick=()=>{showPage('salida');ops.scrollIntoView({behavior:'smooth'});};output.prepend(banner);}
  }
  function loadSettings() {
    const m=moduleName(),config=db.menuIntegration?.[m]||{};
    el('menu-hero-phrase').value=config.heroPhrase||'';el('menu-enabled').checked=config.enabled===true;el('menu-business').value=config.business||obtenerNombreNegocioActual?.()||'';
    el('menu-logo').value=config.logo||'';el('menu-hero').value=config.heroImage||'';el('menu-instagram').value=config.instagram||'';
    el('menu-live-link').href=url().href;el('menu-local-link').href=url(true).href;
    const selectedIndex=selectedDish?db.platos.indexOf(selectedDish):-1;
    el('menu-dish-select').innerHTML='<option value="">Seleccionar plato</option>'+(db.platos||[]).map((p,i)=>p.owner?.toLowerCase()===owner()&&p.modulo===m?`<option value="${i}">${esc(p.nombre)}</option>`:'').join('');
    if(selectedIndex>=0)el('menu-dish-select').value=String(selectedIndex);
    renderCatalog();
    el('menu-customer-select').innerHTML=(db.clientesFidelizacion||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
  }
  async function upload() {
    guardarDatos();
    if(typeof window.subirBaseActualAlCloud!=='function')throw Error('La conexión cloud no está disponible.');
    if(!await window.subirBaseActualAlCloud({silent:true}))throw Error('No se subieron los cambios; revisa el estado de sincronización.');
  }
  const secureImage=x=>!x||/^https:\/\//i.test(x);
  async function saveSettings(e){e.preventDefault();if(!authorized())return;const button=e.target.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');
    try{const logo=el('menu-logo').value.trim(),heroImage=el('menu-hero').value.trim(),instagram=el('menu-instagram').value.trim();if(!secureImage(logo)||!secureImage(heroImage)||instagram&&!/^https:\/\/(www\.)?instagram\.com\//i.test(instagram))throw Error('Usa imágenes HTTPS y un enlace oficial de Instagram.');
      db.menuIntegration ||= {};db.menuIntegration[moduleName()]={...db.menuIntegration[moduleName()],heroPhrase:el('menu-hero-phrase').value.trim(),enabled:el('menu-enabled').checked,business:el('menu-business').value.trim(),logo,heroImage,instagram};await upload();status('Configuración sincronizada. La app consulta la disponibilidad de este módulo.');loadSettings();
    }catch(e){status(e.message,true);}finally{button.disabled=false;button.removeAttribute('aria-busy');}}
  function chosen(){if(selectedDish)return db.platos.includes(selectedDish)&&selectedDish.owner?.toLowerCase()===owner()&&selectedDish.modulo===moduleName()?selectedDish:null;const raw=el('menu-dish-select').value;if(raw==='')return null;const p=db.platos[Number(raw)];return p&&p.owner?.toLowerCase()===owner()&&p.modulo===moduleName()?p:null;}
  function loadDish(){const p=chosen();selectedDish=p;dirty=false;el('menu-dish-form').hidden=!p;el('menu-preview-panel').hidden=!p;if(!p)return;const m=p.menu||{},n=m.nutrition||{};el('menu-category').value=m.category||'';el('menu-image').value=m.image||'';el('menu-description').value=m.description||'';el('menu-hidden').checked=m.hidden===true;el('menu-offer').value=m.offerPercent||0;el('menu-offer-until').value=Number.isFinite(Date.parse(m.offerUntil))?new Date(Date.parse(m.offerUntil)-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';el('menu-portion').value=n.portion||'';el('menu-allergens').value=m.allergens||'';for(const k of ['energiaKcal','proteinasG','carbohidratosG','grasasG','fibraG','sodioMg'])el('menu-n-'+k).value=n[k]??'';draftStatus('Ficha cargada · vista previa local.');renderPreview();renderCatalog();}
  async function saveDish(e){e.preventDefault();if(!authorized()||savingDish)return;const p=chosen();if(!p)return;try{const image=el('menu-image').value.trim();if(!secureImage(image))throw Error('La foto debe usar HTTPS.');const discount=Number(el('menu-offer').value);if(!Number.isFinite(discount)||discount<0||discount>100)throw Error('El descuento debe estar entre 0 y 100.');const end=el('menu-offer-until').value;if(discount>0&&(!end||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.now()))throw Error('Indica una fecha futura para la oferta.');const nutrition={portion:el('menu-portion').value.trim()};for(const k of ['energiaKcal','proteinasG','carbohidratosG','grasasG','fibraG','sodioMg'])nutrition[k]=el('menu-n-'+k).value===''?null:Number(el('menu-n-'+k).value);
    savingDish=true;el('menu-dish-form').querySelector('[type="submit"]').setAttribute('aria-busy','true');el('menu-dish-form').querySelectorAll('input,textarea,button').forEach(x=>x.disabled=true);el('menu-dish-select').disabled=true;draftStatus('Sincronizando ficha…');
    p.menu={...p.menu,category:el('menu-category').value.trim(),image,description:el('menu-description').value.trim(),hidden:el('menu-hidden').checked,offerPercent:discount,offerUntil:end?new Date(end).toISOString():'',allergens:el('menu-allergens').value.trim(),nutrition};await upload();dirty=false;draftStatus('Sincronizado con la app · '+new Date().toLocaleTimeString('es-DO'));renderCatalog();renderPreview();status('Ficha, oferta y nutrición sincronizadas.');}catch(e){dirty=true;draftStatus('No sincronizado: '+e.message);status(e.message,true);}finally{el('menu-dish-form').querySelector('[type="submit"]').removeAttribute('aria-busy');savingDish=false;el('menu-dish-form').querySelectorAll('input,textarea,button').forEach(x=>x.disabled=false);el('menu-dish-select').disabled=false;}}
  const priceText=n=>'RD$'+(Number.isFinite(Number(n))?Number(n):0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
  const previewPlaceholder='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#111b29"/><text x="300" y="210" fill="#91bde5" text-anchor="middle" font-size="26">Fotografía pendiente</text></svg>');
  const imageUrl=value=>secureImage(value)&&value?value:previewPlaceholder;
  function draftStatus(message){el('menu-draft-status').textContent=message;}
  function cardMarkup(p,meta,editing=false,index=0){
    const discount=Number(meta.offerPercent)||0,active=discount>0&&discount<=100&&Date.parse(meta.offerUntil)>Date.now();
    const price=active?Math.round(Number(p.precio)*(1-discount/100)*100)/100:p.precio;
    const stock=Math.max(0,Math.floor(Number(p.stock)||0));
    const badge=meta.hidden?'Oculto en el menú':!stock?'Agotado':active?'Oferta '+discount+'%':stock<=3?'Quedan pocas porciones':'Disponible';
    return `<article class="card"><div class="card-photo"><img src="${esc(imageUrl(meta.image))}" alt="${esc(p.nombre)}" loading="lazy"><span class="badge">${esc(badge)}</span></div><div class="card-body"><small>${esc(meta.category||'Platos')}</small><h3>${esc(p.nombre)}</h3><p>${esc(meta.description||'')}</p><div class="card-bottom"><span class="price">${active?'<del>'+priceText(p.precio)+'</del> ':''}${priceText(price)}</span>${editing?`<button type="button" class="order-button" data-edit-dish="${index}" ${savingDish?'disabled':''}>Editar plato</button>`:'<button type="button" class="order-button" disabled>Pedir</button>'}</div></div></article>`;
  }
  function renderCatalog(){
    const q=(el('menu-dish-search').value||'').toLocaleLowerCase('es').trim();
    el('menu-visual-catalog').innerHTML=(db.platos||[]).map((p,i)=>p.owner?.toLowerCase()===owner()&&p.modulo===moduleName()&&`${p.nombre} ${p.menu?.category||''}`.toLocaleLowerCase('es').includes(q)?cardMarkup(p,p.menu||{},true,i):'').join('')||'<p>No hay platos para mostrar. Registra tus platos en LURO o cambia la búsqueda.</p>';
    el('menu-visual-catalog').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.src=previewPlaceholder;},{once:true}));
  }
  function renderPreview(){
    const p=chosen();if(!p)return;
    const meta={category:el('menu-category').value,image:el('menu-image').value.trim(),description:el('menu-description').value,hidden:el('menu-hidden').checked,offerPercent:Number(el('menu-offer').value),offerUntil:el('menu-offer-until').value};
    const styles=['styles.css','luro-connection.css'].map(file=>`<link rel="stylesheet" href="${esc(new URL('menu/'+file,location.href).href)}">`).join('');
    const nutrients=[['energiaKcal','Energía','kcal'],['proteinasG','Proteínas','g'],['carbohidratosG','Carbohidratos','g'],['grasasG','Grasas','g'],['fibraG','Fibra','g'],['sodioMg','Sodio','mg']];
    el('menu-dish-preview').srcdoc=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{margin:0;padding:16px;color:#f2f8ff;font-family:Arial,sans-serif}*{box-sizing:border-box}.card{width:100%;margin:16px 0}.card-photo{height:220px}.card-photo img{width:100%;height:100%;object-fit:cover}.card-body{padding:16px}.card h3{font-size:22px}.card p{font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere;min-height:0}.card-bottom{display:flex;justify-content:space-between}.price{font-size:22px}table{width:100%;font-size:14px}td,th{text-align:left;padding:8px 0;border-bottom:1px solid #294052}p{line-height:1.5}h1{font-size:19px}small{color:#a7bdcf}h2{font-size:18px}</style></head><body><small>VISTA PREVIA · ${esc(moduleName())}</small><h1>${esc(el('menu-business').value||'Menú del restaurante')}</h1>${meta.hidden?'<p>Este plato está oculto y no aparecerá en el catálogo público.</p>':''}${cardMarkup(p,meta)}<h2>Información del plato</h2><p>Porción: ${esc(el('menu-portion').value||'Pendiente de registrar')}</p><table>${nutrients.map(([k,label,unit])=>`<tr><th>${label}</th><td>${el('menu-n-'+k).value===''?'Pendiente':esc(el('menu-n-'+k).value)+' '+unit}</td></tr>`).join('')}</table><h2>Alérgenos declarados</h2><p>${esc(el('menu-allergens').value||'Pendientes de confirmar con cocina.')}</p><small>Vista previa local. Los botones de pedido están desactivados.</small></body></html>`;
  }
  async function customerLink(){if(!authorized())return;const b=el('menu-customer-link');if(b.disabled)return;b.disabled=true;b.setAttribute('aria-busy','true');try{const r=await window.luroMenuAdminCall('menuCreateCustomerLink',{module:moduleName(),customerId:el('menu-customer-select').value});const u=url();u.hash='access='+r.accessToken;el('menu-customer-url').hidden=false;el('menu-customer-url').value=u.href;el('menu-customer-url').select();status('Enlace privado creado. Entrégalo únicamente al cliente seleccionado.');}catch(e){status(e.message,true);}finally{b.disabled=false;b.removeAttribute('aria-busy');}}
  function notifications(){
    const notice=el('menu-floating-notice');if(!notice)return;
    const pending=list.filter(o=>o.status==='pending').length,waiting=authorized()?tasks.filter(t=>t.status==='pending').length:0;
    notice.hidden=!operator()||!(pending||waiting);
    notice.innerHTML=(pending?`<p>${pending} pedido(s) esperan en caja.</p><button class="btn" data-menu-nav="salida">Revisar pedidos</button>`:'')+(waiting?`<p>${waiting} tarea(s) pendientes.</p><button class="btn" data-menu-nav="tareas-pendientes">Abrir tareas</button>`:'');
  }
  async function refreshTasks(){
    if(!authorized())return;
    const taskScope=owner()+'|'+moduleName(),r=await window.luroMenuAdminCall('menuListTasks',{module:moduleName()});if(!authorized()||taskScope!==owner()+'|'+moduleName())return;tasks=r.tasks||[];
    if(el('menu-task-list'))el('menu-task-list').innerHTML=tasks.filter(t=>t.status==='pending').map(t=>`<article class="menu-admin-order"><h3>${esc(t.title)}</h3>${t.member?`<p>${esc(t.member.name)} · Cédula: ${esc(t.member.cedula)} · Teléfono: ${esc(t.member.phone)}</p><p>Verifica la identidad y selecciona su registro de Clientes y puntos.</p><select id="customer-${esc(t.id)}"><option value="">Seleccionar cliente verificado</option>${(db.clientesFidelizacion||[]).filter(c=>!c.owner||c.owner.toLowerCase()===owner()).map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}</select>`:'<p>Completa y sincroniza la frase de inicio en Configuración.</p>'}<button class="btn" data-resolve-task="${esc(t.id)}">Completar tarea</button></article>`).join('')||'<p>No hay tareas pendientes.</p>';
    notifications();
  }
  const labels={pending:'Esperando aceptación de caja',accepted:'Aceptado · pendiente de cocina',preparing:'En preparación',ready:'Listo',delivered:'Entregado',rejected:'Rechazado'};
  function renderOrders(){const pending=list.filter(o=>o.status==='pending').length;const banner=el('menu-cashier-banner');if(banner){banner.hidden=!pending;el('menu-pending-count').textContent=`${pending} pedido(s) de la app esperan aceptación de caja.`;}
    notifications();el('menu-orders-list').innerHTML=list.map(o=>`<article class="menu-admin-order"><strong>${esc(o.id)} · ${esc(labels[o.status])}</strong><p>${esc(o.customer?.name)} ${o.mesa?'· '+esc(o.mesa):''} · RD$${Number(o.total).toFixed(2)} · ${o.payment?.status==='paid'?'Cobrado en LuRo':'Pendiente de cobro'}</p><p>${o.items.map(i=>`${i.quantity} × ${esc(i.name)}${i.notes?' — '+esc(i.notes):''}`).join('<br>')}</p>${o.notes?'<p>'+esc(o.notes)+'</p>':''}${o.status==='pending'?`<button class="btn btn-save" data-order="${o.id}" data-next="accepted">Aceptar y enviar a cocina</button><button class="btn btn-danger" data-order="${o.id}" data-next="rejected">Rechazar</button>`:''}${[['accepted','preparing','Cocina acepta · comenzar'],['preparing','ready','Marcar listo'],['ready','delivered','Marcar entregado']].filter(([from])=>from===o.status).map(([,to,label])=>`<button class="btn btn-blue" data-order="${o.id}" data-next="${to}">${label}</button>`).join('')}</article>`).join('')||'No hay pedidos en este módulo.';
  }
  async function refresh(manual=false){if(!operator()||polling||busy)return;polling=true;const requestScope=owner()+'|'+moduleName();el('menu-refresh').setAttribute('aria-busy','true');try{const r=await window.luroMenuAdminCall('menuListOrders',{module:moduleName()});if(!operator()||requestScope!==owner()+'|'+moduleName())return;list=r.orders||[];el('menu-orders-status').textContent='Conectado a LURO · '+moduleName()+' · actualizado '+new Date().toLocaleTimeString('es-DO');const added=list.filter(o=>o.status==='pending'&&!seen.has(o.id));seen=new Set(list.map(o=>o.id));renderOrders();if(authorized())await refreshTasks();if(added.length)status(`${added.length} pedido(s) nuevo(s): caja debe aceptarlos para enviar a cocina.`);else if(manual)status('Pedidos actualizados.');}catch(e){el('menu-orders-status').textContent='No se pudieron actualizar los pedidos: '+e.message;if(manual)status(e.message,true);}finally{polling=false;el('menu-refresh').removeAttribute('aria-busy');}}
  async function transition(id,next){if(!operator()||busy)return;busy=true;el('menu-orders-list').querySelectorAll('button').forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');});try{if(!await window.subirBaseActualAlCloud?.({silent:true}))throw Error('Sincroniza los cambios locales antes de aceptar o actualizar el pedido.');let reason='';if(next==='rejected'){reason=prompt('Motivo del rechazo:')||'';if(!reason.trim())return;}await window.luroMenuAdminCall('menuUpdateOrder',{module:moduleName(),id,status:next,reason});if(['accepted','ready'].includes(next))await window.descargarBaseDesdeCloud({silent:true,reload:false,force:true});status('Pedido actualizado. El cliente verá el estado en la app.');}catch(e){status(e.message,true);}finally{busy=false;renderOrders();await refresh();}}
  document.addEventListener('DOMContentLoaded',()=>{
    mount();
    const navigate=window.showPage;
    window.showPage=function(id){const result=navigate?.(id);if(id==='tareas-pendientes'&&authorized())refreshTasks().catch(e=>{el('menu-task-status').textContent=e.message;});if(id==='configuracion'&&authorized()&&!dirty){loadSettings();if(selectedDish&&!chosen()){selectedDish=null;el('menu-dish-form').hidden=true;el('menu-preview-panel').hidden=true;}}if(['salida','comandas'].includes(id)&&el(id)&&el('menu-operations'))el(id).prepend(el('menu-operations'));return result;};
    // The existing kitchen completion control updates the same canonical web order.
    const finish=window.finalizarComanda;
    window.finalizarComanda=async function(id){const c=(db.comandasActivas||[]).find(x=>x.id===id);if(!c?.menuOrderId)return finish?.(id);let o=list.find(x=>x.id===c.menuOrderId);if(!o){await refresh(true);o=list.find(x=>x.id===c.menuOrderId);}if(o?.status==='accepted'){await transition(o.id,'preparing');o=list.find(x=>x.id===c.menuOrderId);}if(o?.status==='preparing')await transition(o.id,'ready');};
    setInterval(()=>{if(!el('luro-menu-admin'))return;el('luro-menu-admin').hidden=!authorized();if(!operator()){list=[];tasks=[];if(el('menu-task-list'))el('menu-task-list').replaceChildren();notifications();}const taskNav=document.querySelector('[data-tasks-nav]');if(taskNav)taskNav.hidden=!authorized();if(el('menu-operations'))el('menu-operations').hidden=!operator();const scope=owner()+'|'+moduleName();if(operator()&&scope!==previousScope){previousScope=scope;selectedDish=null;dirty=false;el('menu-dish-form').hidden=true;el('menu-preview-panel').hidden=true;el('menu-dish-search').value='';seen=new Set();list=[];tasks=[];if(el('menu-task-list'))el('menu-task-list').replaceChildren();notifications();loadSettings();refresh();}},1500);
    setInterval(()=>refresh(),12000);
  });
})();
