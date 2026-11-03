'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {guard,encode,decode}=require('../../scripts/phase1/emulator-smoke.cjs');
test('emulator guard rejects live projects, remote addresses and alternate ports',()=>{
 for(const [host,project]of [['127.0.0.1:18180','luro-control'],['firestore.googleapis.com','demo-luro-phase1'],['localhost:8080','demo-luro-phase1'],['127.0.0.1:18180','demo-other']])assert.throws(()=>guard(host,project));
 assert.doesNotThrow(()=>guard('127.0.0.1:18180','demo-luro-phase1'));
});
test('synthetic Firestore adapter roundtrips supported JSON and rejects unsupported values',()=>{
 const data={id:'fixture',none:null,qty:9,unitCost:1.25,active:true,lines:[{name:'Pechuga',quantity:9}],empty:[],object:{}};
 assert.deepEqual(decode(encode(data)),data);assert.throws(()=>encode(new Date()));assert.throws(()=>encode(Infinity));assert.throws(()=>encode(Number.MAX_SAFE_INTEGER+1));
});
