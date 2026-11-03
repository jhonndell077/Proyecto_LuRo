'use strict';

// Local JSON documents only. This module never connects to Firebase or a network.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FORMAT = 'luro-local-documents-v1';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) throw new Error('Unexpected schema keys');
}
function safePath(filename) {
  const absolute = path.resolve(filename);
  let cursor = absolute;
  while (true) {
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Symbolic links are not allowed'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return absolute;
}
function readFile(filename) {
  safePath(filename);
  if (!fs.lstatSync(filename).isFile()) throw new Error('Expected a regular file');
  return fs.readFileSync(filename);
}
function validate(data) {
  keys(data, ['format', 'documents']);
  if (data.format !== FORMAT || !data.documents || typeof data.documents !== 'object' || Array.isArray(data.documents)) throw new Error('Invalid local documents format');
  for (const [documentPath, document] of Object.entries(data.documents)) {
    const parts = documentPath.split('/');
    if (parts.length < 2 || parts.length % 2 || Buffer.byteLength(documentPath) > 6000 || parts.some(part => !part || part === '.' || part === '..' || /^__.*__$/.test(part) || /[\\\x00-\x1f\x7f]/.test(part) || Buffer.byteLength(part) > 1500)) throw new Error('Invalid document path');
    if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Expected document object');
    const inspect = value => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite JSON number');
      if (value && typeof value === 'object') Object.values(value).forEach(inspect);
    };
    inspect(document);
  }
  return data;
}
function parse(bytes) { return validate(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))); }
function summarize(data) {
  const documentHashes = Object.fromEntries(Object.keys(data.documents).sort().map(id => [id, hash(canonical(data.documents[id]))]));
  const collections = {};
  for (const id of Object.keys(data.documents)) {
    const collection = id.split('/').slice(0, -1).join('/');
    Object.defineProperty(collections, collection, {value: (Object.hasOwn(collections, collection) ? collections[collection] : 0) + 1, enumerable: true, configurable: true});
  }
  return {documentCount: Object.keys(documentHashes).length, collections, documentHashes};
}
function createBackup(source, directory) {
  const bytes = readFile(source);
  const data = parse(bytes);
  const target = safePath(directory);
  // Exclusive directory creation deliberately refuses existing or partial backups.
  fs.mkdirSync(target);
  const manifest = {format: 'luro-local-backup-v1', origin: 'local-only', sourceFormat: FORMAT, createdAt: new Date().toISOString(), file: 'documents.json', byteLength: bytes.length, sha256: hash(bytes), ...summarize(data)};
  fs.writeFileSync(path.join(target, 'documents.json'), bytes, {flag: 'wx'});
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  return manifest;
}
function verifyBackup(directory) {
  const target = safePath(directory);
  if (!fs.lstatSync(target).isDirectory()) throw new Error('Expected backup directory');
  if (fs.readdirSync(target).sort().join('|') !== 'documents.json|manifest.json') throw new Error('Unexpected backup files');
  const manifest = JSON.parse(readFile(path.join(target, 'manifest.json')).toString('utf8'));
  keys(manifest, ['format', 'origin', 'sourceFormat', 'createdAt', 'file', 'byteLength', 'sha256', 'documentCount', 'collections', 'documentHashes']);
  if (manifest.format !== 'luro-local-backup-v1' || manifest.origin !== 'local-only' || manifest.sourceFormat !== FORMAT || manifest.file !== 'documents.json' || typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt))) throw new Error('Invalid manifest');
  const bytes = readFile(path.join(target, 'documents.json'));
  if (manifest.byteLength !== bytes.length || manifest.sha256 !== hash(bytes)) throw new Error('Backup byte integrity mismatch');
  const data = parse(bytes);
  const summary = summarize(data);
  for (const key of Object.keys(summary)) if (canonical(manifest[key]) !== canonical(summary[key])) throw new Error('Backup document integrity mismatch');
  return {manifest, data};
}
function restoreBackup(directory, target) {
  const {manifest, data} = verifyBackup(directory);
  const destination = safePath(target);
  // wx is atomic with respect to existing destinations; no overwrite is possible.
  const bytes = readFile(path.join(path.resolve(directory), 'documents.json'));
  if (hash(bytes) !== manifest.sha256) throw new Error('Backup changed during verification');
  fs.writeFileSync(destination, bytes, {flag: 'wx'});
  return {target: destination, documentCount: Object.keys(data.documents).length};
}
module.exports = {createBackup, verifyBackup, restoreBackup};
if (require.main === module) {
  try {
    const [command, first, second, ...extra] = process.argv.slice(2);
    if (extra.length || !first || (command !== 'verify' && !second) || (command === 'verify' && second)) throw new Error('Usage: node backup.cjs create SOURCE.json NEW_DIRECTORY | verify DIRECTORY | restore DIRECTORY NEW_TARGET.json');
    let result;
    if (command === 'create') result = createBackup(first, second);
    else if (command === 'verify') result = {verified: true, ...verifyBackup(first).manifest};
    else if (command === 'restore') result = restoreBackup(first, second);
    else throw new Error('Unknown command');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
