'use strict';
// Captures committed source only. Never exports Firestore or reads credential stores.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
function createSourceBackup(directory){
 const root=path.resolve(__dirname,'../..');
 directory=path.resolve(directory);
 if(fs.existsSync(directory))throw Error('Backup directory must not exist');
 const revision=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const status=execFileSync('git',['-C',root,'status','--porcelain'],{encoding:'utf8'});
 fs.mkdirSync(directory,{recursive:false});const bundle=path.resolve(directory,'source.bundle');
 execFileSync('git',['-C',root,'bundle','create',bundle,'HEAD'],{stdio:'pipe'});
 execFileSync('git',['-C',root,'bundle','verify',bundle],{stdio:'pipe'});
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(bundle)).digest('hex');
 const manifest={format:'luro-source-backup-v1',revision,sha256,createdAt:new Date().toISOString(),scope:'committed HEAD and its history; no cloud data; uncommitted work excluded',workingTreeStatus:status};
 fs.writeFileSync(path.resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
}
function verifySourceBackup(directory){
 const bundle=path.resolve(directory,'source.bundle'),manifest=JSON.parse(fs.readFileSync(path.resolve(directory,'manifest.json'),'utf8'));
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(bundle)).digest('hex');
 if(manifest.format!=='luro-source-backup-v1'||manifest.sha256!==sha256)throw Error('Source backup integrity mismatch');
 const heads=execFileSync('git',['bundle','list-heads',bundle],{encoding:'utf8'});
 if(!heads.split(/\r?\n/).some(line=>line===manifest.revision+' HEAD'))throw Error('Backup revision mismatch');
 execFileSync('git',['-C',path.resolve(__dirname,'../..'),'bundle','verify',bundle],{stdio:'pipe'});
 return manifest;
}
if(require.main===module){try{const args=process.argv.slice(2);let result;if(args.length===1)result=createSourceBackup(args[0]);else if(args.length===2&&args[0]==='verify')result=verifySourceBackup(args[1]);else throw Error('Usage: node source-backup.cjs NEW_DIRECTORY | verify DIRECTORY');console.log(JSON.stringify({revision:result.revision,sha256:result.sha256,scope:result.scope}));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={createSourceBackup,verifySourceBackup};
