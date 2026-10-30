 'use strict';
(()=>{
 const note=document.createElement('p');note.className='offline-status';note.setAttribute('role','status');document.querySelector('.header').after(note);
 let ready=false,error='',registration;
 function status(){note.textContent=ready?(!navigator.onLine?'Sin conexión · no se pueden enviar pedidos ni consultar estados.':'Interfaz guardada. Los pedidos y estados requieren conexión.'):error||(!navigator.onLine?'Sin conexión · conecta internet una vez para guardar el menú.':'Preparando acceso sin conexión…');}
 function retryButton(){const button=document.createElement('button');button.textContent='Reintentar';button.type='button';button.onclick=()=>{error='';status();start();};note.append(' ',button);}
 function fail(message){error=message;status();retryButton();}
 function check(){const worker=registration?.active;if(worker)worker.postMessage({type:'OFFLINE_STATUS'});}
 window.addEventListener('online',()=>{status();check();registration?.active?.postMessage({type:'OFFLINE_RETRY_IMAGES'});});window.addEventListener('offline',status);status();
 if(!('serviceWorker'in navigator)){fail('Abre esta página directamente en Safari para preparar el acceso sin conexión.');return;}
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type==='OFFLINE_READY'){ready=true;error='';status();}
  if(event.data?.type==='OFFLINE_ERROR'){
   console.warn('Offline preparation failed',event.data);
   fail(event.data.code==='QuotaExceededError'?'Safari no pudo reservar espacio para el menú.':event.data.detail==='session_required'?'Vuelve a abrir la página con tu sesión iniciada para guardar el menú.':'No se completó la descarga del menú. Reintenta con internet.');
  }
 });
 navigator.serviceWorker.addEventListener('controllerchange',check);
 async function start(){try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});check();
  function watch(worker){if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='activated')check();if(worker.state==='redundant'&&!ready&&!error)fail('No se completó la descarga del menú. Reintenta con internet.');});}
  watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration.installing));
  navigator.serviceWorker.ready.then(check);
 }catch(error){console.warn('Offline registration failed',error);fail('No se pudo activar el acceso sin conexión. Abre la página directamente en Safari y reintenta.');}}
 start();
 document.addEventListener('click',e=>{if(!navigator.onLine&&e.target.closest('#checkout')){e.preventDefault();e.stopImmediatePropagation();if(typeof toast==='function')toast('Sin conexión: puedes consultar el menú. Conéctate para continuar con el pedido.');}},true);
})();
