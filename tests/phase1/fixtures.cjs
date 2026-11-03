'use strict';
// Synthetic document map, never a production export. No credentials or real PII.
// Contract: buildFixture() -> { 'collection/document': data }; callers may wrap
// this map as { format: 'luro-local-documents-v1', documents: buildFixture() }.
// validateFixture(map) returns true or throws AssertionError; it performs no I/O.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const NOW = 1793577600000;
function buildFixture() {
  const documents = {};
  for (const suffix of ['alpha', 'beta']) {
    const owner = `fixture_${suffix}`, module = 'COCINA', businessId = `fixture-business-${suffix}`;
    const scope = hash(`${owner}\0${module}`), dishId = `fixture-dish-${suffix}`;
    const customerHash = hash(`synthetic-customer-${suffix}`);
    const orderId = `WEB-${hash(`${customerHash}:fixture-request-${suffix}`).slice(0, 28)}`;
    const common = { owner, modulo: module };
    const db = {
      tenant: { negocioId: businessId, nombre: `Restaurante sintético ${suffix}`, owner, createdAt: NOW },
      usuarios: [{ user: owner, role: 'admin', owner, activo: true }],
      platos: [{ ...common, id: dishId, menuId: dishId, nombre: 'Pechuga de 8 Oz', precio: 725, stock: 9,
        receta: [{ nombre: 'Pechuga cruda', cantidad: 8, unidad: 'Oz' }], menu: { hidden: false } }],
      almacen: [{ ...common, id: `raw-${suffix}`, nombre: 'Pechuga cruda', actual: 160, ideal: 160, unidad: 'Oz', costoUnitario: 10 }],
      produccion_stock: [{ ...common, id: `prep-${suffix}`, nombre: 'Salsa preparada', actual: 4, ideal: 4, unidad: 'Litros', costoUnitario: 25 }],
      historial_prod: [{ ...common, id: `batch-${suffix}`, producto: 'Salsa preparada', cantidad: '4 Litros', costoOp: 100,
        fecha: '2/11/2026, 00:00:00', tipo: 'carga-realizada', insumos: [],
        lote: { nombre: 'Salsa preparada', cantidad: 4, unidad: 'Litros', costo: 100 }, reversible: true }],
      entradas: [{ ...common, id: `entry-${suffix}`, producto: 'Pechuga cruda', cant: 160, medida: 'Oz', costoTotal: 1600, fecha: '2/11/2026, 00:00:00' }],
      ventas: [{ ...common, id: `sale-${suffix}`, plato: 'Plato histórico sintético', cantidad: 1, totalVenta: 100, fecha: '2/11/2026, 00:00:00' }],
      facturasResumen: [{ ...common, id: `invoice-${suffix}`, ventaId: `sale-${suffix}`, total: 100, fecha: NOW }],
      comandasActivas: [], comandasHistorial: [{ ...common, id: `ticket-${suffix}`, ventaId: `sale-${suffix}`, estado: 'finalizada' }],
      clientesFidelizacion: [{ ...common, id: `customer-${suffix}`, nombre: `Cliente sintético ${suffix}`, puntos: 0 }],
      decomisos: [], distribuidores: [], catalogoDistribuidores: [],
      menuIntegration: { [module]: { enabled: true, business: `Restaurante sintético ${suffix}`, heroPhrase: 'Menú de prueba local' } }
    };
    documents[`negocios/${businessId}`] = { id: businessId, owner, nombre: db.tenant.nombre, synthetic: true };
    documents[`owners/${owner}`] = { username: owner, owner, negocioId: businessId, activo: true, synthetic: true };
    documents[`datos_del_propietario/${owner}`] = { db, 'base de datos': structuredClone(db), synthetic: true };
    documents[`menu_orders/${scope}/orders/${orderId}`] = {
      id: orderId, owner, module, customerHash, customer: { name: `Cliente sintético ${suffix}` },
      items: [{ id: dishId, name: 'Pechuga de 8 Oz', quantity: 9, unitPrice: 725, notes: '' }],
      subtotal: 6525, delivery: 0, total: 6525, status: 'pending',
      payment: { status: 'pending', method: 'Caja' }, createdAt: NOW, updatedAt: NOW
    };
    documents[`menu_reservations/${scope}`] = { quantities: { [dishId]: 9 }, pending: { [customerHash]: 1 }, minute: Math.floor(NOW / 60000), count: 1 };
  }
  return documents;
}
function validateFixture(documents) {
  assert.ok(documents && typeof documents === 'object' && !Array.isArray(documents), 'Document map required');
  const entries = Object.entries(documents);
  assert.ok(entries.length > 0, 'Empty fixture');
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!/^(pass|password|token|customerToken|privateKey|secret|email|phone|cedula)$/i.test(key), `Sensitive field: ${key}`);
      inspect(child);
    }
  };
  inspect(documents);
  const ownerEntries = entries.filter(([path]) => /^datos_del_propietario\/[^/]+$/.test(path));
  assert.ok(ownerEntries.length >= 2, 'At least two isolated businesses required');
  const scopes = new Set(), orderPaths = new Set();
  for (const [path, payload] of ownerEntries) {
    const owner = path.split('/')[1], db = payload.db;
    assert.deepEqual(db, payload['base de datos'], 'Legacy aliases differ');
    assert.equal(db.tenant.owner, owner, 'Tenant owner mismatch');
    const business = documents[`negocios/${db.tenant.negocioId}`], identity = documents[`owners/${owner}`];
    assert.equal(business?.owner, owner, 'Business cross-reference');
    assert.equal(identity?.negocioId, db.tenant.negocioId, 'Identity business mismatch');
    assert.equal(identity?.owner, owner, 'Identity owner mismatch');
    for (const rows of Object.values(db).filter(Array.isArray)) {
      for (const row of rows) assert.equal(row.owner, owner, 'Cross-business array row');
    }
    for (const item of [...db.almacen, ...db.produccion_stock]) {
      assert.ok(Number.isFinite(item.actual) && item.actual >= 0, 'Invalid actual stock');
      assert.ok(Number.isFinite(item.costoUnitario) && item.costoUnitario >= 0, 'Invalid costoUnitario');
      assert.ok(['Oz', 'Litros'].includes(item.unidad), 'Unknown fixture unit');
      assert.ok(!Object.hasOwn(item, 'cantidad'), 'Stock uses actual, not cantidad');
    }
    for (const entry of db.entradas) {
      assert.ok(Number.isFinite(entry.cant) && entry.cant > 0, 'Invalid entry cant');
      assert.ok(typeof entry.medida === 'string' && entry.medida.length > 0, 'Missing entry medida');
      assert.ok(Number.isFinite(entry.costoTotal) && entry.costoTotal >= 0, 'Invalid entry costoTotal');
    }
    for (const [module, settings] of Object.entries(db.menuIntegration)) {
      assert.equal(settings.enabled, true);
      const scope = hash(`${owner}\0${module}`); scopes.add(scope);
      const reservation = documents[`menu_reservations/${scope}`];
      assert.ok(reservation, 'Missing reservation scope');
      const expected = {}, pending = {};
      for (const [orderPath, order] of entries.filter(([p]) => p.startsWith(`menu_orders/${scope}/orders/`))) {
        orderPaths.add(orderPath);
        assert.equal(order.id, orderPath.split('/')[3], 'Order ID mismatch');
        assert.match(order.id, /^WEB-[a-f0-9]{28}$/, 'Invalid current order ID');
        assert.equal(order.owner, owner, 'Cross-business order'); assert.equal(order.module, module, 'Order module mismatch');
        assert.equal(order.status, 'pending', 'Baseline must remain pending');
        assert.equal(order.payment.status, 'pending');
        let total = 0; const ids = new Set();
        for (const line of order.items) {
          assert.ok(!ids.has(line.id), 'Duplicate line'); ids.add(line.id);
          const product = db.platos.find(p => p.menuId === line.id && p.modulo === module);
          assert.ok(product, 'Unknown or cross-business product');
          assert.ok(Number.isInteger(line.quantity) && line.quantity > 0, 'Invalid quantity');
          assert.equal(line.unitPrice, product.precio, 'Price mismatch');
          expected[line.id] = (expected[line.id] || 0) + line.quantity;
          assert.ok(expected[line.id] <= product.stock, 'Over-reserved stock');
          total += line.quantity * line.unitPrice;
        }
        assert.equal(order.subtotal, total); assert.equal(order.total, total + order.delivery);
        pending[order.customerHash] = (pending[order.customerHash] || 0) + 1;
      }
      assert.deepEqual(reservation.quantities, expected, 'Reservation quantities mismatch');
      assert.deepEqual(reservation.pending, pending, 'Pending counter mismatch');
    }
    for (const sale of db.ventas) assert.ok(Number.isFinite(sale.totalVenta) && sale.totalVenta >= 0, 'Invalid sale totalVenta');
    for (const invoice of db.facturasResumen) assert.ok(db.ventas.some(v => v.id === invoice.ventaId && v.totalVenta === invoice.total), 'Invoice sale mismatch');
    for (const ticket of db.comandasHistorial) assert.ok(db.ventas.some(v => v.id === ticket.ventaId), 'Ticket sale mismatch');
  }
  for (const [path] of entries) {
    if (path.startsWith('menu_orders/')) assert.ok(orderPaths.has(path), 'Unknown order scope');
    if (path.startsWith('menu_reservations/')) assert.ok(scopes.has(path.split('/')[1]), 'Unknown reservation scope');
  }
  return true;
}
module.exports = { buildFixture, validateFixture };
