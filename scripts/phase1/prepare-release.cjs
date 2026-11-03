'use strict';
// Local preparation only: no staging, commits, push, deploy, SDK or network calls.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const FILES=Object.freeze([
 'docs/fase1-respaldos-emuladores.md','docs/preparacion-despliegue.md',
 'scripts/phase1/backup.cjs','scripts/phase1/emulator-smoke.cjs','scripts/phase1/run-emulator.ps1','scripts/phase1/source-backup.cjs','scripts/phase1/prepare-release.cjs',
 'tests/phase1/backup.test.cjs','tests/phase1/firebase.emulators.json','tests/phase1/firestore.rules','tests/phase1/fixtures.cjs','tests/phase1/fixtures.test.cjs','tests/phase1/isolation.test.cjs','tests/phase1/preparation.test.cjs'
]);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function regular(file){let cursor=path.resolve(file);while(true){if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Symbolic links are not allowed');const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}if(!fs.lstatSync(file).isFile())throw Error('Expected regular file');return fs.readFileSync(file);}
function createPackage(directory){
 directory=path.resolve(directory);
 if(directory===ROOT||directory.startsWith(ROOT+path.sep))throw Error('Preparation package must be outside the repository');
 if(fs.existsSync(directory))throw Error('Destination must not exist');
 const revision=execFileSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const bytes=FILES.map(name=>[name,regular(path.join(ROOT,name))]);
 fs.mkdirSync(directory);
 const files={};for(const [name,data]of bytes){const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data,{flag:'wx'});files[name]={sha256:hash(data),bytes:data.length};}
 const manifest={format:'luro-phase1-preparation-v1',revision,createdAt:new Date().toISOString(),deploymentTarget:'none-local-tools-only',productionReady:false,blockers:['No verified production data backup/restore','POS 3.0 implementation phases not authorized or implemented','No deployment instruction in this preparation task'],files};
 fs.writeFileSync(path.join(directory,'preparation.json'),JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
}
function verifyPackage(directory){
 const manifest=JSON.parse(regular(path.join(directory,'preparation.json')).toString('utf8'));
 if(manifest.format!=='luro-phase1-preparation-v1'||manifest.productionReady!==false||manifest.deploymentTarget!=='none-local-tools-only'||JSON.stringify(Object.keys(manifest.files).sort())!==JSON.stringify([...FILES].sort()))throw Error('Invalid preparation manifest');
 for(const name of FILES){const data=regular(path.join(directory,name)),expected=manifest.files[name];if(expected.sha256!==hash(data)||expected.bytes!==data.length)throw Error('Integrity mismatch: '+name);}
 function inspect(folder,prefix=''){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const name=prefix+item.name;if(item.isSymbolicLink())throw Error('Symbolic links are not allowed');if(item.isDirectory())inspect(path.join(folder,item.name),name+'/');else if(name!=='preparation.json'&&!FILES.includes(name))throw Error('Unexpected package file: '+name);}}
 inspect(directory);return manifest;
}
if(require.main===module){try{const [action,directory,...rest]=process.argv.slice(2);if(!directory||rest.length||!['create','verify'].includes(action))throw Error('Usage: node prepare-release.cjs create|verify DIRECTORY');const result=action==='create'?createPackage(directory):verifyPackage(directory);console.log(JSON.stringify({verified:action==='verify',revision:result.revision,files:Object.keys(result.files).length,productionReady:result.productionReady,blockers:result.blockers},null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={FILES,createPackage,verifyPackage};
