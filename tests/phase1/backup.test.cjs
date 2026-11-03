'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createBackup, verifyBackup, restoreBackup} = require('../../scripts/phase1/backup.cjs');
function fixture(t, documents = {'negocios/demo': {name: 'Demo', nested: {b: 2, a: 1}}, 'negocios/demo/pedidos/one': {quantity: 9}}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luro-backup-test-'));
  // Cleanup deliberately limited to this newly created test directory.
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const source = path.join(root, 'source.json');
  fs.writeFileSync(source, JSON.stringify({format: 'luro-local-documents-v1', documents}, null, 2));
  return {root, source, backup: path.join(root, 'backup')};
}
test('backup verifies exact bytes and restores documents without altering source', t => {
  const f = fixture(t); const original = fs.readFileSync(f.source);
  const manifest = createBackup(f.source, f.backup);
  assert.equal(manifest.origin, 'local-only'); assert.equal(manifest.documentCount, 2);
  assert.equal(manifest.collections['negocios/demo/pedidos'], 1);
  assert.deepEqual(verifyBackup(f.backup).data, JSON.parse(original));
  const target = path.join(f.root, 'restored.json'); restoreBackup(f.backup, target);
  assert.deepEqual(fs.readFileSync(target), original); assert.deepEqual(fs.readFileSync(f.source), original);
  assert.throws(() => restoreBackup(f.backup, target), /EEXIST/);
  assert.throws(() => createBackup(f.source, f.backup), /EEXIST/);
  assert.deepEqual(fs.readFileSync(target), original);
});
test('corrupt bytes prevent verification and restoration', t => {
  const f = fixture(t); createBackup(f.source, f.backup);
  fs.appendFileSync(path.join(f.backup, 'documents.json'), ' ');
  assert.throws(() => verifyBackup(f.backup), /integrity/);
  const target = path.join(f.root, 'restored.json');
  assert.throws(() => restoreBackup(f.backup, target), /integrity/);
  assert.equal(fs.existsSync(target), false);
});
test('manifest schema, counts and per-document hash alterations are rejected', t => {
  const f = fixture(t); createBackup(f.source, f.backup);
  const filename = path.join(f.backup, 'manifest.json'); const original = JSON.parse(fs.readFileSync(filename));
  for (const mutate of [m => m.extra = true, m => m.documentCount++, m => m.documentHashes['negocios/demo'] = '0'.repeat(64), m => m.file = '../source.json', m => m.origin = 'production']) {
    const changed = structuredClone(original); mutate(changed); fs.writeFileSync(filename, JSON.stringify(changed));
    assert.throws(() => verifyBackup(f.backup));
  }
});
test('unsafe document paths and malformed documents are rejected before directory creation', t => {
  const f = fixture(t);
  for (const id of ['../doc', 'a//b/c', 'a/b/c', '/a/b', 'a/b/', 'a/..', 'a/\\bad', 'a/__bad__']) {
    fs.writeFileSync(f.source, JSON.stringify({format: 'luro-local-documents-v1', documents: {[id]: {}}}));
    assert.throws(() => createBackup(f.source, f.backup), /document path/);
    assert.equal(fs.existsSync(f.backup), false);
  }
  fs.writeFileSync(f.source, JSON.stringify({format: 'luro-local-documents-v1', documents: {'a/b': []}}));
  assert.throws(() => createBackup(f.source, f.backup), /document object/);
});
test('unexpected backup files are rejected', t => {
  const f = fixture(t); createBackup(f.source, f.backup);
  fs.writeFileSync(path.join(f.backup, 'extra.json'), '{}');
  assert.throws(() => verifyBackup(f.backup), /Unexpected backup files/);
});
