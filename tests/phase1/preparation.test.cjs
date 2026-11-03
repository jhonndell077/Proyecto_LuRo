'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FILES,createPackage,verifyPackage}=require('../../scripts/phase1/prepare-release.cjs');
function destination(){return path.join(fs.mkdtempSync(path.join(os.tmpdir(),'luro-preparation-test-')),'package');}
test('preparation includes only phase1 files and never marks tools as production ready',()=>{
 const target=destination(),manifest=createPackage(target);assert.equal(manifest.productionReady,false);assert.equal(manifest.deploymentTarget,'none-local-tools-only');assert.deepEqual(Object.keys(verifyPackage(target).files),FILES);assert.equal(fs.existsSync(path.join(target,'public')),false);assert.equal(fs.existsSync(path.join(target,'package.json')),false);assert.throws(()=>createPackage(target),/must not exist/);assert.throws(()=>createPackage(path.resolve(__dirname,'../..','forbidden-package')),/outside/);
});
test('changed content, unrelated files and altered release gates invalidate the package',()=>{
 const target=destination();createPackage(target);const filename=path.join(target,FILES[0]),before=fs.readFileSync(filename);fs.appendFileSync(filename,'corrupt');assert.throws(()=>verifyPackage(target),/Integrity/);fs.writeFileSync(filename,before);fs.writeFileSync(path.join(target,'unrelated.txt'),'fixture');assert.throws(()=>verifyPackage(target),/Unexpected/);
 const target2=destination();createPackage(target2);const file=path.join(target2,'preparation.json'),manifest=JSON.parse(fs.readFileSync(file));manifest.productionReady=true;fs.writeFileSync(file,JSON.stringify(manifest));assert.throws(()=>verifyPackage(target2),/Invalid/);
});
