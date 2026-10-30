"use strict";
const { createHash } = require('node:crypto');
const text = (x, n = 160) => String(x ?? '').trim().slice(0, n);
const key = x => text(x).toLowerCase();
const hash = x => createHash('sha256').update(String(x)).digest('hex');
const money = x => Math.round(Number(x) * 100) / 100;
class MenuError extends Error {}
function fail(message) { throw new MenuError(message); }
function dishId(p) { return /^[A-Za-z0-9_-]{1,80}$/.test(p.menuId || '') ? p.menuId : `dish-${hash(`${key(p.owner)}\0${p.modulo}\0${p.nombre}`).slice(0, 24)}`; }
function safeImage(value) { const s = text(value, 2000); return /^https:\/\//i.test(s) ? s : ''; }
const nutrients = ['energiaKcal','proteinasG','carbohidratosG','grasasG','fibraG','sodioMg'];
function nutrition(p) {
  const n = p.menu?.nutrition || {};
  const values = Object.fromEntries(nutrients.map(k => [k, n[k] === '' || n[k] == null || !Number.isFinite(Number(n[k])) || Number(n[k]) < 0 ? null : Number(n[k])]));
  const complete = Object.values(values).every(v => Number.isFinite(v) && v >= 0);
  return {status: complete ? 'registered' : 'pending', portion: text(n.portion, 100), ...values};
}
function catalog(payload, owner, module, reserved = {}, now = Date.now()) {
  const settings = payload.menuIntegration?.[module];
  if (!settings?.enabled) fail('El menú de este negocio no está habilitado.');
  const items = (payload.platos || []).filter(p => key(p.owner) === key(owner) && p.modulo === module && p.menu?.hidden !== true).map(p => {
    const id = dishId(p), meta = p.menu || {};
    const basePrice = money(p.precio), stock = Math.max(0, Math.floor(Number(p.stock) || 0) - (Number(reserved[id]) || 0));
    const discount = Number(meta.offerPercent) || 0;
    const ends = Date.parse(meta.offerUntil || ''), offerActive = discount > 0 && discount <= 100 && Number.isFinite(ends) && ends > now;
    return {id, name: text(p.nombre), description: text(meta.description, 700), category: text(meta.category || 'Platos', 60), image: safeImage(meta.image), basePrice, price: offerActive ? money(basePrice * (1 - discount / 100)) : basePrice,
      offer: offerActive ? {percent: discount, until: new Date(ends).toISOString()} : null,
      stock, availability: stock === 0 ? 'sold_out' : stock <= 3 ? 'low_stock' : 'available', nutrition: nutrition(p), allergens: text(meta.allergens, 400)};
  }).filter(p => Number.isFinite(p.price) && p.price >= 0);
  return {business: text(settings.business || 'Nuestro menú'), currency: 'DOP', owner: key(owner), module, updatedAt: Number(payload.updatedAt) || now,
    brand: {logo: safeImage(settings.logo), heroImage: safeImage(settings.heroImage), instagram: /^https:\/\/(www\.)?instagram\.com\//i.test(settings.instagram || '') ? settings.instagram : ''}, items};
}
function quote(menu, lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 30) fail('Pedido inválido.');
  const ids = new Set();
  const items = lines.map(line => {
    if (ids.has(line.id)) fail('Combina las cantidades del mismo plato.'); ids.add(line.id);
    const p = menu.items.find(p => p.id === line.id), quantity = Number(line.quantity);
    if (!p || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantity > p.stock) fail('Un plato ya no tiene suficiente disponibilidad.');
    if (money(line.unitPrice) !== p.price) fail('Cambió el precio de un plato. Actualiza el carrito.');
    return {id: p.id, name: p.name, quantity, unitPrice: p.price, notes: text(line.notes, 400)};
  });
  return {items, subtotal: money(items.reduce((s, x) => s + x.unitPrice * x.quantity, 0)), delivery: 0, total: money(items.reduce((s, x) => s + x.unitPrice * x.quantity, 0))};
}
const transitions = {pending: ['accepted','rejected'], accepted: ['preparing'], preparing: ['ready'], ready: ['delivered']};
function canTransition(from, to) { return from === to || (transitions[from] || []).includes(to); }
function release(reserved, order) { for (const i of order.items) reserved[i.id] = Math.max(0, (Number(reserved[i.id]) || 0) - i.quantity); }
// Server-created mesas survive a stale whole-database upload until the client acknowledges them.
function preserveImports(incoming, current) {
  incoming.menuOrderReceipts ||= {};
  for (const [id, receipt] of Object.entries(current.menuOrderReceipts || {})) {
    if (incoming.menuOrderReceipts[id]) {
      if (receipt.paidAt) incoming.menuOrderReceipts[id].paidAt = receipt.paidAt;
      continue;
    }
    incoming.mesasEstado ||= {}; incoming.mesasEstado.carritoPorMesa ||= {}; incoming.mesasEstado.mesaMeta ||= {};
    if ((incoming.mesasEstado.carritoPorMesa[receipt.mesa] || []).length) fail('Llegó un pedido web. Descarga la base antes de guardar esta mesa.');
    incoming.mesasEstado.carritoPorMesa[receipt.mesa] = current.mesasEstado?.carritoPorMesa?.[receipt.mesa] || [];
    incoming.mesasEstado.mesaMeta[receipt.mesa] = current.mesasEstado?.mesaMeta?.[receipt.mesa] || {};
    incoming.mesaCuentas ||= {}; incoming.mesaCuentas[receipt.mesa] = current.mesaCuentas?.[receipt.mesa];
    incoming.comandasActivas ||= [];
    for (const c of current.comandasActivas || []) if (c.menuOrderId === id && !incoming.comandasActivas.some(x => x.id === c.id)) incoming.comandasActivas.push(c);
    incoming.menuOrderReceipts[id] = receipt;
  }
  return incoming;
}
module.exports = {text,key,hash,money,dishId,catalog,quote,canTransition,release,preserveImports,nutrients,MenuError};
