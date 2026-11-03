'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {buildFixture,validateFixture}=require('../../tests/phase1/fixtures.cjs');
const {createBackup,verifyBackup,restoreBackup}=require('./backup.cjs');
const PROJECT='demo-luro-phase1',HOST='127.0.0.1:18180';
function guard(host,project){
 if(host!==HOST||![PROJECT,PROJECT+'-restore'].includes(project))throw Error('Only the fixed localhost emulator and demo projects are allowed');
}
function encode(value){
 if(value===null)return {nullValue:null};
 if(typeof value==='boolean')return {booleanValue:value};
 if(typeof value==='number'){if(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value))throw Error('Unsupported JSON number');return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};}
 if(typeof value==='string')return {stringValue:value};
 if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
 throw Error('Only plain JSON values are supported');
}
function decode(value){
 if('nullValue'in value)return null;
 if('booleanValue'in value)return value.booleanValue;
 if('integerValue'in value)return Number(value.integerValue);
 if('doubleValue'in value)return value.doubleValue;
 if('stringValue'in value)return value.stringValue;
 if('arrayValue'in value)return (value.arrayValue.values||[]).map(decode);
 if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));
 throw Error('Unsupported Firestore type in the synthetic JSON test');
}
async function request(project,suffix,method='GET',body,admin=true){
 guard(process.env.FIRESTORE_EMULATOR_HOST,project);
 // "owner" is the emulator's synthetic Admin credential, never a live token.
 const headers={'Content-Type':'application/json'};if(admin)headers.Authorization='Bearer owner';
 return fetch(`http://${HOST}/v1/projects/${project}/databases/(default)/documents${suffix}`,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
}
async function importNew(project,documents){
 const writes=Object.entries(documents).map(([name,value])=>({update:{name:`projects/${project}/databases/(default)/documents/${name}`,fields:encode(value).mapValue.fields},currentDocument:{exists:false}}));
 const response=await request(project,':commit','POST',{writes});if(!response.ok)throw Error(`Local import failed (${response.status}): ${await response.text()}`);
}
async function readMap(project,paths){
 const result={};for(const name of paths){const response=await request(project,'/'+name);if(!response.ok)throw Error(`Local read failed: ${response.status}`);result[name]=decode({mapValue:{fields:(await response.json()).fields}});}return result;
}
async function main(){
 guard(process.env.FIRESTORE_EMULATOR_HOST,process.env.GCLOUD_PROJECT);
 const documents=buildFixture();validateFixture(documents);
 await importNew(PROJECT,documents);
 const exported=await readMap(PROJECT,Object.keys(documents));assert.deepEqual(exported,documents);validateFixture(exported);
 const denied=await request(PROJECT,'/owners/fixture_alpha','GET',undefined,false);assert.equal(denied.status,403,'Anonymous read must be denied by the isolated rules');
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'luro-phase1-restore-'));
 const source=path.join(output,'synthetic.json');fs.writeFileSync(source,JSON.stringify({format:'luro-local-documents-v1',documents:exported},null,2),{flag:'wx'});
 const backup=path.join(output,'backup');createBackup(source,backup);verifyBackup(backup);
 const restored=path.join(output,'restored.json');restoreBackup(backup,restored);
 const restoredDocuments=JSON.parse(fs.readFileSync(restored,'utf8')).documents;
 await importNew(PROJECT+'-restore',restoredDocuments);
 assert.deepEqual(await readMap(PROJECT+'-restore',Object.keys(documents)),documents);
 console.log(JSON.stringify({result:'PASS',project:PROJECT,documents:Object.keys(documents).length,tenants:2,anonymousRead:'denied',backup:'verified',restoration:'verified in a second demo namespace',output}));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={guard,encode,decode};
