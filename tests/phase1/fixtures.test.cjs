'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFixture, validateFixture } = require('./fixtures.cjs');
test('synthetic fixture is deterministic, isolated and JSON-restorable', () => {
  const first = buildFixture();
  assert.deepEqual(first, buildFixture());
  assert.equal(validateFixture(JSON.parse(JSON.stringify(first))), true);
  assert.equal(Object.keys(first).length, 10);
});
test('rejects owner alias divergence and cross-business references', () => {
  const fixture = buildFixture();
  fixture['datos_del_propietario/fixture_alpha']['base de datos'].tenant.negocioId = 'fixture-business-beta';
  assert.throws(() => validateFixture(fixture), /aliases/);
  const cross = buildFixture();
  cross['negocios/fixture-business-alpha'].owner = 'fixture_beta';
  assert.throws(() => validateFixture(cross), /cross-reference/);
});
test('rejects wrong menu scope and cross-business product IDs', () => {
  const fixture = buildFixture(), path = Object.keys(fixture).find(p => p.startsWith('menu_orders/'));
  fixture[path].items[0].id = 'fixture-dish-beta';
  assert.throws(() => validateFixture(fixture), /cross-business product/);
  const wrongScope = buildFixture();
  wrongScope[path.replace(/menu_orders\/[^/]+/, 'menu_orders/incorrect')] = wrongScope[path];
  delete wrongScope[path];
  assert.throws(() => validateFixture(wrongScope));
});
test('rejects overbooking, reservation drift and wrong monetary totals', () => {
  const fixture = buildFixture(), path = Object.keys(fixture).find(p => p.startsWith('menu_orders/'));
  fixture[path].items[0].quantity = 10;
  assert.throws(() => validateFixture(fixture), /Over-reserved/);
  const drift = buildFixture(), reserve = Object.keys(drift).find(p => p.startsWith('menu_reservations/'));
  drift[reserve].quantities['fixture-dish-alpha'] = 8;
  assert.throws(() => validateFixture(drift), /Reservation quantities/);
  const total = buildFixture(); total[path].total = 0;
  assert.throws(() => validateFixture(total));
});
test('rejects secrets and broken historical relations', () => {
  const fixture = buildFixture(); fixture['owners/fixture_alpha'].password = 'test-only';
  assert.throws(() => validateFixture(fixture), /Sensitive field/);
  const history = buildFixture(), payload = history['datos_del_propietario/fixture_alpha'];
  payload.db.facturasResumen[0].ventaId = 'sale-beta';
  payload['base de datos'] = structuredClone(payload.db);
  assert.throws(() => validateFixture(history), /Invoice sale/);
});
test('uses real stock, entry, sale and web order field contracts', () => {
  const fixture = buildFixture(), payload = fixture['datos_del_propietario/fixture_alpha'];
  assert.equal(payload.db.almacen[0].actual, 160);
  assert.equal(payload.db.produccion_stock[0].unidad, 'Litros');
  assert.equal(payload.db.entradas[0].cant, 160);
  assert.equal(payload.db.entradas[0].costoTotal, 1600);
  assert.equal(payload.db.ventas[0].totalVenta, 100);
  for (const [path, order] of Object.entries(fixture).filter(([p]) => p.startsWith('menu_orders/'))) {
    assert.match(order.id, /^WEB-[a-f0-9]{28}$/);
    assert.ok(path.endsWith(`/${order.id}`));
  }
  delete payload.db.almacen[0].actual;
  payload.db.almacen[0].cantidad = 160;
  payload['base de datos'] = structuredClone(payload.db);
  assert.throws(() => validateFixture(fixture), /actual stock/);
});
