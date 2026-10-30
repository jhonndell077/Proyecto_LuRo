'use strict';
let modelViewerPromise=null;
function ensureModelViewer(){
 if(customElements.get('model-viewer'))return Promise.resolve();
 if(modelViewerPromise)return modelViewerPromise;
 modelViewerPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.type='module';s.src='vendor/model-viewer-4.1.0.min.js';s.onload=()=>customElements.whenDefined('model-viewer').then(resolve);s.onerror=()=>{modelViewerPromise=null;s.remove();reject(new Error('viewer-load'));};document.head.appendChild(s);});return modelViewerPromise;
}

function validPhotoModel(model,id){
 return !!model && model.kind==='textured' && model.reviewed===true &&
 typeof model.src==='string' && model.src.startsWith('assets/models/photo/'+id+'-') &&
 /^assets\/models\/photo\/[a-z]+-[a-f0-9]{12}\.glb$/.test(model.src) &&
 /^[a-f0-9]{64}$/.test(model.sha256||'') && model.src.endsWith('-'+model.sha256.slice(0,12)+'.glb') &&
 Array.isArray(model.dimensionsM) && model.dimensionsM.length===3 && model.dimensionsM.every(x=>Number.isFinite(x)&&x>0&&x<2);
}
async function loadPhotoModel(id){
 try{const response=await fetch('assets/models/photo-manifest.json',{cache:'no-cache'});if(!response.ok)return null;const manifest=await response.json();const model=manifest.models?.[id];return manifest.version===1&&validPhotoModel(model,id)?model:null;}catch{return null;}
}

async function openBurger3D(){
 stopTableCamera();
 const model=await loadPhotoModel('hamburguesa');
 if(!model){
  $('burger-3d-content').innerHTML=`<div class="model-heading"><div><span class="eyebrow">VISTA 3D EN PREPARACIÓN</span><h2 id="burger-3d-title">Hamburguesa Clásica</h2></div><button class="icon-button close-dialog" aria-label="Cerrar modelo 3D">✕</button></div><div class="model-body"><p>Estamos preparando un modelo con la apariencia y texturas de este plato. Mientras tanto, puedes explorar las referencias desde cuatro ángulos.</p><img class="pending-photo-reference" src="assets/dish-views/hamburguesa.png" alt="Cuatro imágenes de referencia de la hamburguesa, generadas con IA"><p class="model-notice">Referencias visuales de ejemplo. El modelo fotográfico todavía no está disponible para girar o colocar en la mesa.</p><button class="views-button" data-dish-views="hamburguesa">Explorar las cuatro referencias ↗</button></div>`;
  showDialog($('burger-3d-dialog'));return;
 }
 const src=escapeHtml(model.src);
 const width=(Math.max(model.dimensionsM[0],model.dimensionsM[2])*100).toFixed(1);
 const height=(model.dimensionsM[1]*100).toFixed(1);
 $('burger-3d-content').innerHTML=`<div class="model-heading"><div><span class="eyebrow">PRUEBA 3D · ESCALA PROVISIONAL</span><h2 id="burger-3d-title">Hamburguesa Clásica</h2></div><button class="icon-button close-dialog" aria-label="Cerrar modelo 3D">✕</button></div><div class="model-body"><p>Gira el modelo con un dedo y acerca con dos. Para colocarlo sobre tu mesa, abre la vista AR en un teléfono compatible y sigue sus indicaciones.</p><div class="burger-viewer-wrap"><model-viewer id="burger-model" src="${src}" alt="Modelo tridimensional texturizado de una hamburguesa con cheddar, vegetales y plato blanco" poster="assets/dish-views/hamburguesa.png" camera-controls touch-action="pan-y" ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" ar-placement="floor" shadow-intensity="1.2" shadow-softness=".8" environment-image="neutral" exposure="1.1" camera-orbit="25deg 67deg .48m" min-camera-orbit="auto 5deg .20m" max-camera-orbit="auto 90deg .9m" interaction-prompt="auto" loading="eager"><button slot="ar-button" class="model-ar primary">▣ Colocar sobre mi mesa</button></model-viewer></div><p id="model-status" class="model-status" role="status">Cargando visor 3D…</p><div class="model-actions"><button class="secondary-button" id="model-reset">Restablecer vista</button><a class="secondary-button" href="${src}" download="hamburguesa-texturizada.glb">Descargar GLB</a></div><div class="model-dimensions"><span>Plato<br><strong>${width} cm</strong></span><span>Altura del conjunto<br><strong>≈ ${height} cm</strong></span><span>Escala<br><strong>Provisional</strong></span></div><p class="model-notice">Estas dimensiones son del modelo de prueba, no del restaurante. No representa una porción real confirmada. La colocación sobre superficies depende del teléfono y se debe comprobar en un dispositivo físico.</p><button class="views-button" data-dish-views="hamburguesa">◈ Comparar con referencias de cuatro ángulos ↗</button></div>`;
 showDialog($('burger-3d-dialog'));$('burger-3d-dialog').scrollTop=0;
 const mv=$('burger-model');
 mv.addEventListener('load',()=>{$('model-status').textContent=mv.canActivateAR?'Modelo listo. Pulsa «Colocar sobre mi mesa» para iniciar AR.':'Modelo listo para explorar en 3D. La colocación AR no está disponible en este navegador. Prueba el enlace en Safari del iPhone o Chrome de un Android compatible.';});
 mv.addEventListener('error',()=>{$('model-status').textContent='No se pudo cargar el modelo 3D. Revisa tu conexión y vuelve a abrir esta ventana.';});
 mv.addEventListener('ar-status',e=>{if(e.detail.status==='failed')$('model-status').textContent='No se pudo iniciar AR. Abre la app directamente en el navegador del teléfono y revisa los permisos de cámara.';});
 try{
 const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
 if(!gl){$('model-reset').disabled=true;mv.hidden=true;mv.insertAdjacentHTML('afterend','<img class="pending-photo-reference" src="assets/dish-views/hamburguesa.png" alt="Referencias del plato, no render del modelo">');$('model-status').textContent='Este navegador no permite gráficos 3D. Puedes descargar el GLB o abrir la app en un teléfono compatible.';return;}
 gl.getExtension('WEBGL_lose_context')?.loseContext();await ensureModelViewer();
 }catch{if($('model-status'))$('model-status').textContent='No se pudo cargar el visor. Puedes descargar el archivo GLB y reintentar.';}
}
const tableBefore3D=openTableView;openTableView=function(id){if(id==='hamburguesa')openBurger3D();else tableBefore3D(id);};
document.addEventListener('click',e=>{if(e.target.closest('#model-reset')&&!$('burger-model').hidden&&customElements.get('model-viewer')){$('burger-model').cameraOrbit='25deg 67deg .48m';$('burger-model').cameraTarget='auto auto auto';$('burger-model').fieldOfView='auto';}});
