'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const MAX=8*1024*1024;
function source(value){
 let u;try{u=new URL(String(value||'').trim());}catch{throw new Error('Enlace inválido.');}
 if(u.protocol!=='https:'||u.hostname!=='docs.google.com'||u.username||u.password||u.port)throw new Error('Usa un enlace HTTPS de Google Sheets.');
 const id=u.pathname.match(/^\/spreadsheets\/d\/([\w-]{10,150})(?:\/|$)/)?.[1];if(!id)throw new Error('Enlace inválido.');
 const gid=u.searchParams.get('gid')||new URLSearchParams(u.hash.slice(1)).get('gid')||'0';if(!/^\d{1,20}$/.test(gid))throw new Error('Hoja inválida.');
 return {csv:`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,html:`https://docs.google.com/spreadsheets/d/${id}/edit?gid=${gid}`};
}
function safeRedirect(value){const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='docs.google.com'||/^(?:doc-[a-z0-9-]+-sheets|[a-z0-9-]+\.sheets)\.googleusercontent\.com$/.test(u.hostname));}
async function read(address,fetcher=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  for(let count=0;count<5;count++){
   if(!safeRedirect(address))throw Error('Redirección de Google no permitida.');
   const response=await fetcher(address,{redirect:'manual',signal:controller.signal,headers:{Accept:'text/csv,text/html'}});
   if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirección vacía.');address=new URL(location,address).href;continue;}
   if(!response.ok){await response.body?.cancel();throw Error('Google devolvió '+response.status+'.');}
   if(Number(response.headers.get('content-length'))>MAX){await response.body?.cancel();throw Error('Máximo 8 MB.');}
   const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
   try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>MAX)throw Error('Máximo 8 MB.');text+=decoder.decode(r.value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel();}
  }
  throw Error('Demasiadas redirecciones.');
 }finally{clearTimeout(timer);}
}
async function readPublicSheet(url,fetcher){const addresses=source(url);try{const text=await read(addresses.csv,fetcher);if(!/^\s*</.test(text)&&!text.startsWith('PK')&&!text.includes('\0'))return {format:'csv',text};}catch{}const text=await read(addresses.html,fetcher);if(!/class=["'][^"']*\bwaffle\b/i.test(text))throw Error('Google no expone una tabla pública. Comprueba el vínculo compartido.');return {format:'html',text};}
module.exports=function({resolveSession,assertOwnerActive}){return {inventoryReadSheet:onCall({cors:true,timeoutSeconds:60,memory:'256MiB',maxInstances:3},async request=>{const session=await resolveSession(request,true);await assertOwnerActive(session.owner);if(session.collaborator)throw new HttpsError('permission-denied','Solo el administrador puede importar inventario.');try{return await readPublicSheet(request.data?.url);}catch(e){throw new HttpsError('failed-precondition',e.name==='AbortError'?'Google tardó demasiado. Intenta cargar el archivo.':e.message);}})};};
module.exports.source=source;module.exports.safeRedirect=safeRedirect;module.exports.readPublicSheet=readPublicSheet;
