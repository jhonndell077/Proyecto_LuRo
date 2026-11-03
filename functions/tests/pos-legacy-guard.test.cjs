'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {protectManaged}=require('../pos-legacy-guard');
test('legacy snapshots cannot disable managed mode or replace its stock, orders or payments',()=>{
 const current={posModules:{COCINA:{managed:true,version:2}},almacen:[{modulo:'COCINA',actual:9}],posPayments:[{id:'payment'}],mesaCuentas:{}};
 const incoming=structuredClone(current);incoming.posModules={};incoming.posPayments=[];protectManaged(incoming,current);assert.deepEqual(incoming.posModules,current.posModules);assert.deepEqual(incoming.posPayments,current.posPayments);
 const changed=structuredClone(current);changed.almacen[0].actual=99;assert.throws(()=>protectManaged(changed,current),/motor POS/);
 const tables=structuredClone(current);tables.mesaCuentas={fake:{}};assert.throws(()=>protectManaged(tables,current),/cuentas/);
});
test('unmanaged module data remains usable and clients cannot forge activation',()=>{
 const current={almacen:[{modulo:'BAR',actual:1}]},incoming={almacen:[{modulo:'BAR',actual:2}],posModules:{BAR:{managed:true}},posPayments:[{id:'fake'}]};protectManaged(incoming,current);assert.equal(incoming.almacen[0].actual,2);assert.equal(incoming.posModules,undefined);assert.equal(incoming.posPayments,undefined);
});
test('unmanaged rows may change alongside unchanged managed rows',()=>{
 const current={posModules:{COCINA:{managed:true}},almacen:[{modulo:'COCINA',actual:9},{modulo:'BAR',actual:1}]};const incoming=structuredClone(current);incoming.almacen[1].actual=3;assert.doesNotThrow(()=>protectManaged(incoming,current));
});
test('server and browser use the same packaged stock domain',()=>{const fs=require('node:fs'),path=require('node:path');assert.equal(fs.readFileSync(path.resolve(__dirname,'../stock-domain.js'),'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(path.resolve(__dirname,'../../public/assets/js/stock-domain.js'),'utf8').replace(/\r\n/g,'\n'));});
