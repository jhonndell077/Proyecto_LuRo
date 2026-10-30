'use strict';

// Datos locales de demostración. Los pagos y eventos reales de cocina requieren backend.
const STORAGE_KEY = 'tp-frontend-v1';
function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
const rawSaved = readLocal(STORAGE_KEY, {});
const saved = rawSaved && typeof rawSaved === 'object' ? rawSaved : {};
const validEntry = x => x && MENU.some(m => m.id === x.id) && Number.isFinite(x.unitPrice) && x.unitPrice > 0 && Number.isInteger(x.quantity) && x.quantity >= 1 && x.quantity <= 999 && typeof x.details === 'string';
let cart = Array.isArray(saved.cart) ? saved.cart.filter(validEntry) : [];
let favorites = new Set(Array.isArray(saved.favorites) ? saved.favorites.filter(id => MENU.some(m => m.id === id)) : []);
let orders = Array.isArray(saved.orders) ? saved.orders.filter(o => o && typeof o.id === 'string' && /^[A-Za-z0-9-]+$/.test(o.id) && Number.isFinite(Date.parse(o.date)) && Array.isArray(o.items) && o.items.every(validEntry) && Number.isFinite(o.total)) : [];
let profile = saved.profile && typeof saved.profile === 'object' ? saved.profile : {};
profile = {...profile, name: typeof profile.name === 'string' ? profile.name.slice(0, 80) : '', address: typeof profile.address === 'string' ? profile.address.slice(0, 250) : ''};
let feedback = Array.isArray(saved.feedback) ? saved.feedback : [];
let brandConfig = saved.brandConfig && typeof saved.brandConfig === 'object' ? saved.brandConfig : {};
let view = 'menu', category = 'todos', currentItem = null, quantity = 1, toastTimer, adding = false;
let recommendedIds = [];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({cart, favorites: [...favorites], orders, profile, feedback, brandConfig})); return true; }
  catch { toast('No se pudo guardar. Revisa el espacio disponible en este navegador.'); return false; }
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000);
}
function bounce(element) {
  if (reducedMotion() || !element) return;
  element.classList.remove('bounce'); void element.offsetWidth; element.classList.add('bounce');
}
function refreshGreeting() {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? '¡Buenos días' : hour < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  const name = typeof profile.name === 'string' ? profile.name.trim().split(/\s+/)[0] : '';
  $('greeting').textContent = `${salutation}${name ? ', ' + name : ''}! ¿Qué se te antoja?`;
}
function renderCategories() {
  $('categories').innerHTML = CATEGORIES.map(([id, symbol, label]) => `<button class="category ${category === id ? 'active' : ''}" data-category="${id}" aria-pressed="${category === id}"><span>${symbol}</span>${label}</button>`).join('');
}
function renderMenu() {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const query = normalize($('search').value.trim());
  const filtered = MENU.filter(item => (category === 'todos' || item.category === category) && (view !== 'favorites' || favorites.has(item.id)) && normalize(`${item.name} ${item.description}`).includes(query));
  $('result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'plato' : 'platos'} para disfrutar`;
  $('menu').innerHTML = filtered.length ? filtered.map(item => `
    <article class="card" data-item="${item.id}">
      <button class="card-open" data-order="${item.id}" aria-label="Ver y personalizar ${escapeHtml(item.name)}"></button>
      <div class="card-photo"><img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy"><span class="badge">${item.badge}</span>
        <button class="favorite ${favorites.has(item.id) ? 'selected' : ''}" data-favorite="${item.id}" aria-label="${favorites.has(item.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${escapeHtml(item.name)}" aria-pressed="${favorites.has(item.id)}">${icon('heart')}</button>
      </div>
      <div class="card-body"><div class="card-title"><h3>${escapeHtml(item.name)}</h3><span class="rating">★ ${item.rating}</span></div><p>${item.description}</p>
        <div class="card-bottom"><span class="price"><small>RD$</small> ${item.price.toLocaleString('es-DO')}</span><button class="order-button" data-order="${item.id}">Personalizar y pedir <span>↗</span></button></div>
      </div>
    </article>`).join('') : `<div class="empty"><strong>${view === 'favorites' && !favorites.size ? 'Tus favoritos, en un solo lugar.' : 'Sin platos por aquí.'}</strong>${view === 'favorites' && !favorites.size ? 'Toca el corazón de un plato para guardarlo aquí.' : 'Prueba con otra búsqueda o categoría.'}</div>`;
}
function setView(next) {
  if (!['menu', 'favorites', 'orders', 'profile'].includes(next)) return;
  view = next;
  document.querySelectorAll('[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const isMenu = view === 'menu' || view === 'favorites';
  $('hero').hidden = view !== 'menu'; $('menu').hidden = !isMenu; $('secondary').hidden = isMenu;
  document.querySelector('.search').hidden = !isMenu; document.querySelector('.category-row').hidden = !isMenu;
  $('section-title').textContent = {menu: '¿Qué se te antoja hoy? ✦', favorites: 'Tus favoritos ♡', orders: 'Tus pedidos', profile: 'Tu Club The Proyect'}[view];
  $('section-eyebrow').textContent = {menu: 'BUENA COMIDA, BUENOS MOMENTOS', favorites: 'GUARDADOS PARA DISFRUTAR', orders: 'CADA ANTOJO TIENE SU HISTORIA', profile: 'MÁS SABOR, MÁS CERCA'}[view];
  if (isMenu) renderMenu();
  if (view === 'orders') renderOrders();
  if (view === 'profile') renderProfile();
  refreshGreeting();
}
function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}
function closeDialog(dialog) { if (dialog.open) dialog.close(); }
function openDetail(id) {
  currentItem = MENU.find(item => item.id === id); if (!currentItem) return;
  quantity = 1;
  $('detail-content').innerHTML = `<div class="detail-photo nutrition-swipe" data-swipe-nutrition="${currentItem.id}" data-swipe-custom="true" tabindex="0" aria-label="Foto del plato. Desliza hacia la derecha o pulsa flecha derecha para ver nutrición"><p class="swipe-note">Desliza hacia la derecha para ver la información nutricional →</p><img src="${currentItem.image}" alt="${escapeHtml(currentItem.name)}"><button class="icon-button close-dialog" aria-label="Cerrar personalización">✕</button></div>
    <div class="detail-body"><div class="detail-title"><h2 id="detail-title">${escapeHtml(currentItem.name)}</h2><span id="unit-price" class="price"></span></div><p class="detail-description">${currentItem.description}</p><section class="dish-discover-tools"><h3>Conoce tu plato</h3><button class="views-button" data-dish-views="${currentItem.id}">◈ Explorar ángulos · IA ↗</button><button class="table-button" data-table-view="${currentItem.id}">▣ ${currentItem.id === "hamburguesa" ? "Ver en 3D y en mi mesa" : "Ver en mi mesa"} ↗</button></section>
    ${(currentItem.groups || []).map((g, gi) => `<fieldset><legend>${gi + 1}. ${g.name}${g.multiple ? ' · Opcional' : ''}</legend>${g.options.map((o, oi) => `<label class="option"><span><input type="${g.multiple ? 'checkbox' : 'radio'}" name="group-${gi}" value="${oi}" data-group="${gi}" ${!g.multiple && oi === (g.selected || 0) ? 'checked' : ''}>${o[0]}</span><small>${o[2] ? money(Math.round(currentItem.price * o[2])) : o[1] ? `+ ${money(o[1])}` : 'Incluido'}</small></label>`).join('')}</fieldset>`).join('')}
    <label for="notes" class="notes-label">Notas especiales para la cocina</label><textarea id="notes" maxlength="500" rows="2" placeholder="Ej. Poco picante, salsa aparte…"></textarea></div>
    <div class="detail-actions"><div class="quantity"><button data-quantity="-1" aria-label="Reducir cantidad">−</button><span id="detail-quantity">1</span><button data-quantity="1" aria-label="Aumentar cantidad">+</button></div><button class="primary" id="add-to-cart"><span>Agregar al carrito</span><strong id="detail-total"></strong></button></div>`;
  updateDetail(); showDialog($('detail-dialog'));
  $('detail-dialog').scrollTop = 0;
}
function selection() {
  let extra = 0, multiplier = 1; const details = [];
  $('detail-content').querySelectorAll('input:checked').forEach(input => {
    const group = currentItem.groups[Number(input.dataset.group)], option = group.options[Number(input.value)];
    extra += option[1]; if (option[2]) multiplier = option[2]; details.push(`${group.name}: ${option[0]}`);
  });
  return {unitPrice: Math.round(currentItem.price * multiplier) + extra, details};
}
function defaultEntry(item) {
  let extra = 0, multiplier = 1; const details = [];
  (item.groups || []).filter(g => !g.multiple).forEach(g => {
    const option = g.options[g.selected || 0]; extra += option[1]; if (option[2]) multiplier = option[2]; details.push(`${g.name}: ${option[0]}`);
  });
  return {id: item.id, unitPrice: Math.round(item.price * multiplier) + extra, quantity: 1, details: details.join(' · ')};
}
function updateDetail() {
  const s = selection(); $('unit-price').textContent = money(s.unitPrice); $('detail-total').textContent = money(s.unitPrice * quantity); $('detail-quantity').textContent = quantity;
  $('detail-content').querySelector('[data-quantity="-1"]').disabled = quantity <= 1;
  $('detail-content').querySelector('[data-quantity="1"]').disabled = quantity >= 99;
}
function putInCart(entry) {
  const existing = cart.find(x => x.id === entry.id && x.details === entry.details && x.unitPrice === entry.unitPrice);
  if (existing) existing.quantity = Math.min(999, existing.quantity + entry.quantity); else cart.push(entry);
  persist(); updateBadge();
}
async function flyToCart(source) {
  if (!source || reducedMotion() || !source.animate) { bounce($('nav-cart')); return; }
  const from = source.getBoundingClientRect(), to = $('nav-cart').getBoundingClientRect();
  if (!from.width || !from.height) return;
  const clone = document.createElement('img'); clone.src = source.currentSrc || source.src; clone.alt = ''; clone.className = 'fly-dish'; clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`});
  (source.closest('dialog[open]') || document.body).appendChild(clone);
  const dx = to.left + to.width / 2 - from.left - from.width / 2, dy = to.top + to.height / 2 - from.top - from.height / 2;
  try { await clone.animate([{transform: 'translate(0,0) scale(1)', opacity: 1}, {transform: `translate(${dx * .4}px,${dy * .4 - 70}px) scale(.5)`, opacity: .9, offset: .5}, {transform: `translate(${dx}px,${dy}px) scale(.06)`, opacity: .2}], {duration: 620, easing: 'cubic-bezier(.3,.05,.6,1)'}).finished; }
  finally { clone.remove(); bounce($('nav-cart')); }
}
async function addToCart() {
  if (adding || !currentItem) return; adding = true; $('add-to-cart').disabled = true;
  try {
    const s = selection(), notes = $('notes').value.trim(); if (notes) s.details.push(`Nota: ${notes}`);
    putInCart({id: currentItem.id, unitPrice: s.unitPrice, quantity, details: s.details.join(' · ')});
    await flyToCart($('detail-content').querySelector('.detail-photo img'));
    closeDialog($('detail-dialog')); toast('✓ Plato agregado a tu pedido');
  } finally { adding = false; if ($('add-to-cart')) $('add-to-cart').disabled = false; }
}
async function toggleFavorite(id, button) {
  if (!MENU.some(x => x.id === id)) return;
  const removing = favorites.has(id);
  if (removing) favorites.delete(id); else favorites.add(id);
  persist();
  button.classList.toggle('selected', !removing);
  button.setAttribute('aria-pressed', String(!removing));
  button.setAttribute('aria-label', `${removing ? 'Guardar en favoritos' : 'Quitar de favoritos'}: ${MENU.find(x => x.id === id).name}`);
  bounce(button);
  bounce(document.querySelector('[data-view="favorites"]'));
  if (view === 'favorites' && removing) renderMenu();
  toast(removing ? 'Plato quitado de favoritos' : '♡ Guardado en favoritos');
}
function updateBadge() {
  const count = cart.reduce((sum, x) => sum + x.quantity, 0);
  $('cart-count').hidden = !count; $('cart-count').textContent = count;
  $('cart-button').setAttribute('aria-label', `Abrir carrito, ${count} productos`);
  $('nav-cart').setAttribute('aria-label', `Abrir carrito, ${count} productos`);
}
function openCart() { renderCart(); showDialog($('cart-dialog')); }
function renderCart() {
  $('cart-items').innerHTML = cart.length ? cart.map((entry, index) => {
    const item = MENU.find(x => x.id === entry.id);
    return `<article class="cart-item"><img src="${item.image}" alt="${escapeHtml(item.name)}"><div class="cart-item-main"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(entry.details || 'Preparación estándar')}</p><span class="price">${money(entry.unitPrice * entry.quantity)}</span></div><div><button class="remove" data-remove="${index}" aria-label="Eliminar ${escapeHtml(item.name)}">✕</button><div class="cart-controls"><div class="quantity"><button data-cart-index="${index}" data-delta="-1" aria-label="Reducir cantidad" ${entry.quantity <= 1 ? 'disabled' : ''}>−</button><span>${entry.quantity}</span><button data-cart-index="${index}" data-delta="1" aria-label="Aumentar cantidad" ${entry.quantity >= 999 ? 'disabled' : ''}>+</button></div></div></div></article>`;
  }).join('') : '<div class="empty"><strong>Tu próximo antojo te espera.</strong>Agrega algo rico del menú para empezar.</div>';
  const subtotal = cart.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0), delivery = cart.length ? 150 : 0;
  $('cart-summary').innerHTML = `<div class="summary-row"><span>Subtotal</span><span>${money(subtotal)}</span></div><div class="summary-row"><span>Costo de envío</span><span>${money(delivery)}</span></div><div class="summary-row total"><span>Total</span><span>${money(subtotal + delivery)}</span></div><button id="checkout" class="primary" ${cart.length ? '' : 'disabled'}>Continuar al pago de prueba <span>→</span></button><p class="demo-note">Demostración: no se cobra ni se envía a cocina.<br>Al completar el pago de prueba recibirás un recibo digital.</p>`;
}
function changeCartQuantity(index, delta) {
  if (!cart[index]) return;
  cart[index].quantity = Math.max(1, Math.min(999, cart[index].quantity + delta));
  persist(); updateBadge(); renderCart();
}
function utility(title, body, extraClass = '') {
  $('utility-dialog').className = extraClass;
  $('utility-content').innerHTML = `<div class="dialog-heading"><h2 id="utility-title">${title}</h2><button class="icon-button close-dialog" aria-label="Cerrar ventana">✕</button></div>${body}`;
  showDialog($('utility-dialog')); $('utility-dialog').scrollTop = 0;
}
function openPayment() {
  if (!cart.length) return;
  closeDialog($('cart-dialog'));
  const total = cart.reduce((sum, x) => sum + x.unitPrice * x.quantity, 150);
  utility('Completa tu pedido', `<form id="payment-form" class="utility-body"><span class="eyebrow">PAGO SIMULADO · SIN COBROS</span><p>Revisa tu pedido y genera un recibo de demostración. No ingreses datos de tarjetas.</p><div class="summary-row total"><span>Total con envío</span><span>${money(total)}</span></div><label for="payment-name">Nombre para el pedido</label><input id="payment-name" name="name" required maxlength="80" autocomplete="given-name" value="${escapeHtml(profile.name || '')}"><label for="payment-address">Dirección de entrega</label><input id="payment-address" name="address" required maxlength="250" autocomplete="street-address" value="${escapeHtml(profile.address || '')}"><label for="payment-method">Forma de pago</label><select id="payment-method" name="method"><option value="Efectivo · demostración">Efectivo al recibir · demostración</option><option value="Transferencia simulada">Transferencia simulada</option></select><button class="primary" type="submit">Crear pedido de prueba <span>→</span></button><button type="button" class="settings-link" id="back-to-cart">Volver al carrito</button></form>`);
}
function checkout() {
  if (!cart.length) return;
  const subtotal = cart.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0);
  const name = $('payment-name').value.trim(), address = $('payment-address').value.trim();
  if (!name || !address) return;
  const id = `TP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const order = {id, date: new Date().toISOString(), kitchenStartedAt: Date.now(), preparationMinutes: 25, items: cart.map(x => ({...x})), subtotal, delivery: 150, total: subtotal + 150, customer: {name, address}, payment: {status: 'simulated_paid', method: $('payment-method').value}};
  const previousCart = cart, previousProfile = profile;
  orders.unshift(order); cart = []; profile = {...profile, name, address};
  if (!persist()) {orders.shift(); cart = previousCart; profile = previousProfile; return;}
  updateBadge(); refreshGreeting(); setView('orders'); openReceipt(order.id); toast('✓ Pago simulado completado · recibo disponible');
}
function tracking(order, now = Date.now()) {
  if (!order.kitchenStartedAt || !Number.isFinite(order.preparationMinutes)) return null;
  const elapsed = Math.max(0, Math.floor((now - order.kitchenStartedAt) / 1000));
  const duration = Math.max(60, order.preparationMinutes * 60), remaining = Math.max(0, duration - elapsed);
  return {elapsed, remaining, progress: Math.min(100, elapsed / duration * 100), ready: remaining === 0};
}
function clockText(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function renderOrders() {
  $('secondary').innerHTML = orders.length ? orders.map(order => {
    const t = tracking(order);
    return `<article class="history-card"><div class="history-top"><div><span class="eyebrow">${order.payment ? 'PAGO SIMULADO' : 'PEDIDO DE PRUEBA'}</span><h3>${escapeHtml(order.id)}</h3><time datetime="${escapeHtml(order.date)}">${escapeHtml(new Date(order.date).toLocaleString('es-DO'))}</time></div><span class="order-state" data-status="${escapeHtml(order.id)}">${t ? t.ready ? 'Listo · demo' : 'En preparación · demo' : 'Guardado'}</span></div><p>${order.items.map(x => `${x.quantity} × ${escapeHtml(MENU.find(m => m.id === x.id).name)}`).join('<br>')}</p>
    ${t ? `<div class="tracking" data-tracking="${escapeHtml(order.id)}"><div class="tracking-grid"><div><small>Tiempo en cocina</small><strong data-elapsed>${clockText(t.elapsed)}</strong></div><div><small>Preparación estimada</small><strong>${order.preparationMinutes} min</strong></div><div><small>Restante estimado</small><strong data-remaining>${clockText(t.remaining)}</strong></div></div><div class="progress" role="progressbar" aria-label="Preparación simulada" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(t.progress)}"><span style="width:${t.progress}%"></span></div><p class="tracking-note">Seguimiento de demostración desde tu confirmación. No está conectado a una cocina real.</p></div>` : ''}
    <span class="price">${money(order.total)}</span><div class="order-actions"><button class="secondary-button" data-receipt="${escapeHtml(order.id)}">Ver recibo digital ↗</button><button class="secondary-button" data-feedback="${escapeHtml(order.id)}">Contar mi experiencia ♡</button></div></article>`;
  }).join('') : '<div class="empty"><strong>Aún no hay pedidos.</strong>Completa un pago de prueba para ver tu recibo y el seguimiento.</div>';
}
function updateTracking() {
  if (view !== 'orders') return;
  document.querySelectorAll('[data-tracking]').forEach(panel => {
    const order = orders.find(o => o.id === panel.dataset.tracking), t = order && tracking(order); if (!t) return;
    panel.querySelector('[data-elapsed]').textContent = clockText(t.elapsed);
    panel.querySelector('[data-remaining]').textContent = clockText(t.remaining);
    panel.querySelector('.progress span').style.width = `${t.progress}%`;
    panel.querySelector('.progress').setAttribute('aria-valuenow', Math.floor(t.progress));
    const status = document.querySelector(`[data-status="${order.id}"]`); if (status) status.textContent = t.ready ? 'Listo · demo' : 'En preparación · demo';
  });
}
function receiptMarkup(order) {
  const subtotal = order.subtotal ?? order.items.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0);
  return `<section class="receipt-sheet" aria-label="Recibo digital de ${escapeHtml(order.id)}"><div class="receipt-header"><span class="eyebrow">GOURMET & STREET FOOD</span><h3>The Proyect.</h3><p>RECIBO DIGITAL · DEMOSTRACIÓN</p><strong>${escapeHtml(order.id)}</strong><p>${escapeHtml(new Date(order.date).toLocaleString('es-DO'))}</p><span class="receipt-status">${order.payment ? 'PAGO SIMULADO COMPLETADO' : 'PEDIDO DE PRUEBA · SIN PAGO'}</span></div>${order.customer ? `<div class="receipt-line"><span>Cliente<small>${escapeHtml(order.customer.name)}<br>${escapeHtml(order.customer.address)}</small></span></div>` : ''}${order.items.map(x => `<div class="receipt-line"><span>${x.quantity} × ${escapeHtml(MENU.find(m => m.id === x.id).name)}<small>${escapeHtml(x.details || 'Preparación estándar')}<br>${money(x.unitPrice)} por unidad</small></span><strong>${money(x.unitPrice * x.quantity)}</strong></div>`).join('')}<div class="receipt-totals"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>Envío</span><strong>${money(order.delivery ?? order.total - subtotal)}</strong></div><div class="receipt-total"><span>Total</span><strong>${money(order.total)}</strong></div></div><div class="receipt-foot">${escapeHtml(order.payment?.method || 'Sin pago real')}<br>Recibo vinculado a la orden ${escapeHtml(order.id)}.<br>Documento de prueba. No es factura fiscal ni comprobante de cobro.<br>¡Gracias por compartir tu antojo con nosotros! ✦</div></section>`;
}
function openReceipt(id) {
  const order = orders.find(o => o.id === id); if (!order) return;
  utility('Tu recibo digital', `${receiptMarkup(order)}<div class="receipt-actions"><button class="secondary-button" id="print-receipt">Imprimir / PDF</button><button class="secondary-button" data-full-receipt="${escapeHtml(order.id)}">Abrir para captura ↗</button></div><p class="demo-note">Puedes hacer una captura de pantalla o guardar como PDF.<br>El recibo completo permanece en Pedidos en este navegador.</p>`, 'receipt-dialog');
}
function fullReceipt(id) {
  const order = orders.find(o => o.id === id); if (!order) return;
  const blob = new Blob([`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo ${escapeHtml(order.id)}</title><style>body{margin:0;background:#e8e3da;color:#252018;font:14px system-ui}.receipt-sheet{background:#fffaf0;max-width:440px;margin:0 auto;min-height:100vh;padding:24px;box-sizing:border-box}.receipt-header{text-align:center;border-bottom:1px dashed #bcb4a7;padding-bottom:20px}.receipt-header h3{font-size:28px}.eyebrow{font-size:10px;letter-spacing:2px}.receipt-header p,.receipt-foot{font-size:11px;line-height:1.8}.receipt-status{display:block;margin:12px 0;color:#365a37}.receipt-line{display:flex;justify-content:space-between;gap:15px;padding:14px 0;border-bottom:1px dashed #ccc;font-size:12px}.receipt-line small{display:block;line-height:1.8;color:#655d50;overflow-wrap:anywhere}.receipt-line strong{white-space:nowrap}.receipt-totals div{display:flex;justify-content:space-between;margin:15px 0}.receipt-total{font-size:22px}.receipt-foot{text-align:center;margin-top:25px}</style><body>${receiptMarkup(order)}</body></html>`], {type: 'text/html'});
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function renderProfile() {
  $('secondary').innerHTML = `<section class="club-card"><span class="eyebrow">CLUB THE PROYECT ✦</span><h3>${profile.clubJoined ? `¡Ya eres parte del Club${profile.name ? ', ' + escapeHtml(profile.name.split(' ')[0]) : ''}!` : 'Tu buen gusto merece más.'}</h3><p>${profile.clubJoined ? 'Tus preferencias del Club están guardadas en este dispositivo.' : 'Únete al Club y obtén beneficios. Empieza por guardar tus gustos para hacer de cada visita algo más tuyo.'}</p><div class="club-perks"><span>♡ Tus favoritos a mano</span><span>✦ Recomendaciones según tus gustos</span><span>◷ Tu historial de antojos</span></div><button id="join-club" class="primary">${profile.clubJoined ? 'Editar mis preferencias' : 'Únete al Club y obtén beneficios'} <span>↗</span></button><p class="demo-note">Registro local de demostración. No crea una cuenta ni activa promociones reales.</p></section><button id="brand-settings" class="settings-link">Configurar marca e integración LuRo · demo</button>`;
}
function openClub() {
  utility('Bienvenido al Club ✦', `<form id="club-form" class="utility-body"><p>Guarda tus preferencias y recibe recomendaciones dentro de esta demo.</p><label for="profile-name">Tu nombre</label><input id="profile-name" required maxlength="80" autocomplete="given-name" value="${escapeHtml(profile.name || '')}"><label for="profile-address">Dirección de entrega</label><input id="profile-address" maxlength="250" autocomplete="street-address" value="${escapeHtml(profile.address || '')}"><label for="profile-taste">Tu antojo favorito</label><select id="profile-taste">${CATEGORIES.map(([id, , label]) => `<option value="${id}" ${profile.taste === id ? 'selected' : ''}>${label}</option>`).join('')}</select><label class="inline-check"><input type="checkbox" required ${profile.clubJoined ? 'checked' : ''}>Acepto guardar estas preferencias en este navegador. No se enviarán a un servidor.</label><button class="primary" type="submit">Guardar preferencias <span>✓</span></button></form>`);
}
function openRecommendations() {
  utility('Tu próximo favorito', `<div class="utility-body"><span class="eyebrow">TE AYUDAMOS A ELEGIR ✦</span><p>Cuéntanos qué buscas y encuentra una opción de nuestro menú.</p><label for="recommend-category">¿Qué se te antoja?</label><select id="recommend-category">${CATEGORIES.map(([id, , label]) => `<option value="${id}" ${profile.taste === id ? 'selected' : ''}>${label}</option>`).join('')}</select><label for="recommend-budget">Presupuesto por plato</label><select id="recommend-budget"><option value="2000">Sin preferencia</option><option value="300">Hasta RD$ 300</option><option value="500">Hasta RD$ 500</option><option value="1000">Hasta RD$ 1,000</option></select><button id="find-recommendations" class="primary">Recomiéndame algo rico <span>→</span></button><div id="recommend-results" class="recommendation-list" aria-live="polite"></div><button class="settings-link" id="general-feedback">Cuéntanos tu experiencia</button></div>`);
  findRecommendations();
}
function findRecommendations() {
  const cat = $('recommend-category').value, budget = Number($('recommend-budget').value);
  const items = MENU.filter(x => (cat === 'todos' || x.category === cat) && x.price <= budget).sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 3);
  recommendedIds = items.map(x => x.id);
  $('recommend-results').innerHTML = items.length ? items.map(item => `<button class="recommendation" data-recommended="${item.id}"><img src="${item.image}" alt=""><span><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} · ★ ${item.rating}</small></span><span>↗</span></button>`).join('') : '<p>No encontramos un plato con esa combinación. Prueba con otro presupuesto o categoría.</p>';
}
function openFeedback(orderId = '') {
  const order = orders.find(o => o.id === orderId), itemIds = order ? [...new Set(order.items.map(x => x.id))] : MENU.map(x => x.id);
  utility('Tu opinión nos da sabor', `<form id="feedback-form" class="utility-body" data-feedback-order="${escapeHtml(order?.id || '')}"><p>${order ? `Sobre tu pedido ${escapeHtml(order.id)}.` : 'Queremos conocer tu experiencia con el menú.'} Tus respuestas se guardan en este dispositivo.</p><label for="feedback-found">¿Encontraste todo lo que buscabas?</label><select id="feedback-found" required><option value="">Selecciona una respuesta</option><option>Sí</option><option>En parte</option><option>No</option></select><label for="feedback-dish">¿Sobre qué plato quieres opinar?</label><select id="feedback-dish">${itemIds.map(id => `<option value="${id}">${escapeHtml(MENU.find(x => x.id === id).name)}</option>`).join('')}</select><label for="feedback-improve">¿Qué mejorarías de este plato?</label><textarea id="feedback-improve" maxlength="1000" placeholder="Sabor, porción, acompañantes…"></textarea><label for="feedback-rating">¿Cómo fue tu experiencia?</label><select id="feedback-rating" required><option value="">Selecciona una valoración</option><option value="5">★★★★★ Excelente</option><option value="4">★★★★ Muy buena</option><option value="3">★★★ Buena</option><option value="2">★★ Puede mejorar</option><option value="1">★ Necesito ayuda</option></select><label for="feedback-comment">Cuéntanos un poco más (opcional)</label><textarea id="feedback-comment" maxlength="1000"></textarea><button type="submit" class="primary">Guardar mi opinión <span>♡</span></button></form>`);
}
function safeImage(value) { return typeof value === 'string' && (/^https:\/\//i.test(value) || /^data:image\/(png|jpeg|webp);base64,/i.test(value)) ? value : ''; }
function instagramUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(url.hostname) && url.pathname !== '/' ? url.href : ''; } catch { return ''; }
}
function applyBrandConfig(config = {}, save = true) {
  if (!config || typeof config !== 'object') config = {};
  brandConfig = {instagram: instagramUrl(config.instagram || ''), logo: safeImage(config.logo || ''), heroImage: safeImage(config.heroImage || ''), featuredDish: MENU.some(x => x.id === config.featuredDish) ? config.featuredDish : 'hamburguesa'};
  const item = MENU.find(x => x.id === brandConfig.featuredDish);
  $('brand-logo').innerHTML = brandConfig.logo ? `<img class="brand-logo-img" src="${escapeHtml(brandConfig.logo)}" alt="Logo del restaurante">` : 'TP<span>✦</span>';
  $('instagram-link').href = brandConfig.instagram || '#';
  if (brandConfig.instagram) { $('instagram-link').target = '_blank'; $('instagram-link').rel = 'noopener noreferrer'; } else { $('instagram-link').removeAttribute('target'); }
  $('hero-image').src = brandConfig.heroImage || item.image;
  $('hero-image').alt = item.name;
  $('featured-dish').dataset.order = item.id;
  $('featured-dish').setAttribute('aria-label', `Ver ${item.name}`);
  if (save) persist();
  window.dispatchEvent(new CustomEvent('theproyect:brand-updated', {detail: {...brandConfig}}));
}
function openBrandSettings() {
  utility('Marca e integración LuRo', `<form id="brand-form" class="utility-body"><p class="config-warning">Configuración local de vista previa. El servicio LuRo aún no está conectado; hay un adaptador preparado para recibir su configuración.</p><label for="brand-instagram">Enlace del perfil de Instagram</label><input id="brand-instagram" type="url" placeholder="https://www.instagram.com/tu_restaurante/" value="${escapeHtml(brandConfig.instagram || '')}"><label for="brand-logo-file">Editar logo · PNG, JPG o WebP (máximo 1 MB)</label><input id="brand-logo-file" type="file" accept="image/png,image/jpeg,image/webp"><label for="brand-hero-file">Editar imagen destacada · PNG, JPG o WebP (máximo 1 MB)</label><input id="brand-hero-file" type="file" accept="image/png,image/jpeg,image/webp"><label for="brand-featured">Plato al hacer clic en la imagen destacada</label><select id="brand-featured">${MENU.map(x => `<option value="${x.id}" ${brandConfig.featuredDish === x.id ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}</select><button class="primary" type="submit">Guardar configuración local <span>✓</span></button><button id="reset-brand" class="settings-link" type="button">Restablecer logo e imagen</button></form>`);
}
async function imageFile(input, fallback) {
  const file = input.files[0]; if (!file) return fallback;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) throw new Error('Usa imágenes PNG, JPG o WebP de hasta 1 MB.');
  return new Promise((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo leer la imagen.')); reader.readAsDataURL(file);});
}
// Contrato de integración, sin credenciales ni llamadas a un servicio inexistente.
window.LuRoFrontend = Object.freeze({setBrandConfig: config => applyBrandConfig(config), getBrandConfig: () => ({...brandConfig})});
window.addEventListener('luro:brand-config', event => {if (event.detail && typeof event.detail === 'object') applyBrandConfig(event.detail);});

document.addEventListener('click', event => {
  const b = event.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.category) {
    category = b.dataset.category; renderCategories(); renderMenu();
    $('categories').querySelector(`[data-category="${category}"]`)?.scrollIntoView({behavior: reducedMotion() ? 'instant' : 'smooth', block: 'nearest', inline: 'center'});
  }
  if (b.dataset.view) { setView(b.dataset.view); if (view !== 'menu') $('menu-section').scrollIntoView({behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start'}); }
  if (b.dataset.order) openDetail(b.dataset.order);
  if (b.dataset.favorite) toggleFavorite(b.dataset.favorite, b);
  if (b.classList.contains('close-dialog')) closeDialog(b.closest('dialog'));
  if (b.dataset.quantity) {quantity = Math.max(1, Math.min(99, quantity + Number(b.dataset.quantity))); updateDetail();}
  if (b.id === 'add-to-cart') addToCart();
  if (b.id === 'cart-button' || b.id === 'nav-cart') openCart();
  if (b.dataset.remove !== undefined) {cart.splice(Number(b.dataset.remove), 1); persist(); updateBadge(); renderCart();}
  if (b.dataset.cartIndex !== undefined) changeCartQuantity(Number(b.dataset.cartIndex), Number(b.dataset.delta));
  if (b.id === 'checkout') openPayment();
  if (b.id === 'back-to-cart') {closeDialog($('utility-dialog')); openCart();}
  if (b.dataset.receipt) openReceipt(b.dataset.receipt);
  if (b.id === 'print-receipt') window.print();
  if (b.dataset.fullReceipt) fullReceipt(b.dataset.fullReceipt);
  if (b.id === 'join-club') openClub();
  if (b.id === 'recommend-button') openRecommendations();
  if (b.id === 'find-recommendations') findRecommendations();
  if (b.dataset.recommended) {closeDialog($('utility-dialog')); openDetail(b.dataset.recommended);}
  if (b.dataset.feedback) openFeedback(b.dataset.feedback);
  if (b.id === 'general-feedback') openFeedback();
  if (b.id === 'brand-settings') openBrandSettings();
  if (b.id === 'reset-brand') {applyBrandConfig({...brandConfig, logo: '', heroImage: ''}); toast('Logo e imagen restablecidos');}
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['payment-form', 'club-form', 'feedback-form', 'brand-form'].includes(form.id)) return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (form.id === 'payment-form') checkout();
  if (form.id === 'club-form') {
    if (!$('profile-name').value.trim()) {toast('Escribe tu nombre para guardar tus preferencias.'); return;}
    profile = {...profile, name: $('profile-name').value.trim(), address: $('profile-address').value.trim(), taste: $('profile-taste').value, clubJoined: true};
    if (persist()) {refreshGreeting(); closeDialog($('utility-dialog')); if (view === 'profile') renderProfile(); toast('✦ ¡Bienvenido al Club! Preferencias guardadas.');}
  }
  if (form.id === 'feedback-form') {
    feedback.push({id: crypto.randomUUID(), orderId: form.dataset.feedbackOrder, found: $('feedback-found').value, dish: $('feedback-dish').value, improve: $('feedback-improve').value.trim(), rating: Number($('feedback-rating').value), comment: $('feedback-comment').value.trim(), date: new Date().toISOString()});
    if (persist()) {closeDialog($('utility-dialog')); toast('♡ Gracias. Tu opinión se guardó en este dispositivo.');}
  }
  if (form.id === 'brand-form') {
    try {
      const instagram = $('brand-instagram').value.trim(); if (instagram && !instagramUrl(instagram)) throw new Error('Usa el enlace HTTPS de un perfil de Instagram.');
      const logo = await imageFile($('brand-logo-file'), brandConfig.logo), heroImage = await imageFile($('brand-hero-file'), brandConfig.heroImage);
      applyBrandConfig({instagram, logo, heroImage, featuredDish: $('brand-featured').value}); closeDialog($('utility-dialog')); toast('✓ Marca actualizada en este dispositivo');
    } catch (error) {toast(error.message);}
  }
});
$('instagram-link').addEventListener('click', event => {
  if (brandConfig.instagram) return;
  event.preventDefault(); utility('Instagram del restaurante', '<div class="utility-body"><p>Falta configurar el enlace oficial del restaurante. Puedes añadirlo en la configuración de marca.</p><button id="brand-settings" class="primary">Configurar enlace de Instagram ↗</button></div>');
});
$('search').addEventListener('input', renderMenu);
$('detail-content').addEventListener('change', event => {if (event.target.matches('input')) updateDetail();});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) closeDialog(dialog);});
});
document.addEventListener('visibilitychange', () => {if (!document.hidden) {updateTracking(); refreshGreeting();}});
window.addEventListener('storage', event => {if (event.key === STORAGE_KEY) toast('Hay cambios en otra pestaña. Recarga para ver la versión guardada.');});
setInterval(updateTracking, 1000);
applyBrandConfig(brandConfig, false); renderCategories(); renderMenu(); updateBadge(); refreshGreeting();
