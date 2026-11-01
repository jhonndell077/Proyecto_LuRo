/* Producción integrada con las existencias y el historial canónicos de LURO. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),S=()=>LuroStock;
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const units=['g','Kg','Lb','Oz','mL','Litros','Unidad'];
 let mode='produce',recipeId='',holdId='',scheduleId='',context='',formContext='',transferIndex=-1,transferName='',mounted=false;
 const scope=()=>({owner:ownerDatosActivo(),module:moduloActual});
 const match=x=>{const c=scope();return S().scoped(x,c.owner,c.module);};
 function allRecipes(){
  const saved=scoped('productionRecipes'),names=new Set(saved.map(r=>(r.name||'').toLowerCase()));
  return [...saved.filter(r=>!r.deleted),...scoped('produccion_stock').filter(p=>p.receta?.length&&!names.has((p.nombre||'').toLowerCase())).map(p=>({id:'stock:'+p.nombre,owner:p.owner,modulo:p.modulo,name:p.nombre,quantity:Number(p.recetaRendimiento)||0,unit:p.recetaUnidad||p.unidad,recipe:p.receta,instructions:p.instrucciones||'',virtual:true}))];
 }
 const editable=()=>!!sesionUser&&!esModoBasicoColaborador()&&tienePermisoPagina('produccion-interna');
 const scoped=key=>(db[key]||[]).filter(match);
 const notify=message=>{$('production-status').textContent=message;};
 const id=()=>crypto.randomUUID();
 function arrays(){for(const k of ['productionRecipes','productionHolds','productionSchedule'])if(!Array.isArray(db[k]))db[k]=[];}
 function sources(){return [...(db.almacen||[]).filter(match).map(x=>({...x,origin:'almacen'})),...(db.produccion_stock||[]).filter(match).map(x=>({...x,origin:'produccion'}))];}
 function addRow(ing={}){
  const selectedUnit=ing.unidad==='Lt'?'Litros':ing.unidad==='Unid'?'Unidad':ing.unidad||'g';
  const row=document.createElement('div');row.className='ingrediente-row production-ingredient';
  row.innerHTML=`<label>Insumo<select class="prod-insumo-nom"><option value="">Seleccionar insumo</option>${sources().map(x=>`<option value="${E(x.nombre)}" data-origin="${x.origin}" ${x.nombre===ing.nombre&&(!ing.origen||x.origin===ing.origen)?'selected':''}>${E(x.nombre)} · ${x.origin==='almacen'?'Almacén':'Producción'} · ${Number(x.actual)||0} ${E(x.unidad)}</option>`).join('')}</select></label><label>Cantidad neta<input type="number" min="0.0001" step="any" class="prod-insumo-cant" value="${E(ing.cantidad||'')}"></label><label>Unidad<select class="prod-insumo-unid">${units.map(u=>`<option ${u===selectedUnit?'selected':''}>${u}</option>`).join('')}</select></label><label>Merma (%)<input class="prod-insumo-waste" type="number" min="0" max="99.99" step="0.01" value="${Number(ing.merma)||0}"></label><label><span data-real-waste-label>Merma real (${E(selectedUnit)})</span><input class="prod-insumo-real-waste" type="number" min="0" step="any" value="${Number(ing.mermaReal)||0}" placeholder="Opcional"></label><label>Procedimiento<input class="prod-insumo-step" maxlength="100" value="${E(ing.procedimiento||'Preparación')}"></label><div class="production-actions"><button type="button" class="btn" data-move-up aria-label="Subir insumo">↑</button><button type="button" class="btn" data-move-down aria-label="Bajar insumo">↓</button></div><button type="button" class="btn btn-danger" data-remove-ingredient>Quitar</button><small class="prod-restante"></small>`;
  row.querySelector('[data-move-up]').onclick=()=>{if(row.previousElementSibling)row.parentElement.insertBefore(row,row.previousElementSibling);};row.querySelector('[data-move-down]').onclick=()=>{if(row.nextElementSibling)row.nextElementSibling.after(row);};
  row.querySelector('[data-remove-ingredient]').onclick=()=>{row.remove();preview();};
  row.addEventListener('input',preview);row.addEventListener('change',()=>{row.querySelector('[data-real-waste-label]').textContent='Merma real ('+row.querySelector('.prod-insumo-unid').value+')';preview();});$('contenedor-insumos-produccion').append(row);preview();
 }
 function readForm(){
  if($('production-form-dialog').open&&formContext!==scope().owner+'|'+scope().module)throw Error('La sesión o el módulo cambió. Abre nuevamente la producción.');
  const factor=Number($('production-multiplier').value);
  if(!Number.isFinite(factor)||factor<=0)throw Error('El multiplicador debe ser mayor que cero.');
  return {name:$('prod_nombre').value.trim(),quantity:Number($('prod_cantidad').value)*factor,unit:$('prod_unidad').value,ideal:Number($('prod_ideal').value),direct:mode==='direct',cost:Number($('production-direct-cost').value),instructions:$('production-instructions').value,recipe:[...$('contenedor-insumos-produccion').querySelectorAll('.ingrediente-row')].map(row=>({nombre:row.querySelector('.prod-insumo-nom').value,cantidad:Number(row.querySelector('.prod-insumo-cant').value)*factor,unidad:row.querySelector('.prod-insumo-unid').value,merma:Number(row.querySelector('.prod-insumo-waste')?.value||0),mermaReal:Number(row.querySelector('.prod-insumo-real-waste')?.value||0)*factor,procedimiento:row.querySelector('.prod-insumo-step')?.value||'Preparación',origen:row.querySelector('.prod-insumo-nom').selectedOptions[0]?.dataset.origin||'almacen'}))};
 }
 function preview(){
  if(!mounted)return;
  try{
   const c=scope(),input=readForm(),p=S().plan(db,input,c.owner,c.module);
   $('production-preview').textContent=`Resultado: ${p.quantity.toFixed(2)} ${p.unit} · Costo: RD$${p.cost.toFixed(2)} · Costo por unidad: RD$${(p.cost/p.quantity).toFixed(2)}`;
   $('production-preview').dataset.state='ready';
  }catch(e){$('production-preview').textContent=e.message;$('production-preview').dataset.state='pending';}
 }
 function reset(){
  recipeId='';holdId='';scheduleId='';$('prod_nombre').value='';$('prod_cantidad').value='';$('prod_unidad').value='g';$('prod_ideal').value=10;$('production-multiplier').value=1;$('production-instructions').value='';$('production-direct-cost').value=0;$('contenedor-insumos-produccion').replaceChildren();
 }
 function load(input){
  $('prod_nombre').value=input.name||'';$('prod_cantidad').value=input.quantity||'';$('prod_unidad').value=input.unit==='Lt'?'Litros':input.unit||'g';$('prod_ideal').value=input.ideal||10;$('production-multiplier').value=1;$('production-instructions').value=input.instructions||'';$('production-direct-cost').value=input.cost||0;
  $('contenedor-insumos-produccion').replaceChildren();(input.recipe||[]).forEach(addRow);preview();
 }
 function open(next='produce',input){
  if(!editable())return notify('Tu sesión tiene acceso de solo lectura a producción.');
  arrays();reset();mode=next;formContext=scope().owner+'|'+scope().module;
  $('production-form-title').textContent=next==='recipe'?'Nueva receta de producción':next==='direct'?'Cargar producción realizada':'Realizar producción';
  $('production-ingredients-panel').hidden=next==='direct';$('production-direct-fields').hidden=next!=='direct';
  $('production-complete').hidden=next==='recipe';$('production-save-recipe').hidden=next==='direct';$('production-hold').hidden=next!=='produce';
  if(input)load(input);else if(next!=='direct')addRow();
  $('production-form-dialog').showModal();preview();
 }
 function finish(){
  if(holdId)db.productionHolds=(db.productionHolds||[]).filter(x=>!(match(x)&&x.id===holdId));
  if(scheduleId){const plan=(db.productionSchedule||[]).find(x=>match(x)&&x.id===scheduleId);if(plan){plan.status='completed';plan.completedAt=Date.now();}}
  $('production-form-dialog').close();reset();notify('Producción registrada y existencias actualizadas.');
 }
 function saveRecipe(){
  if(!editable())return;
  try{
   arrays();const input=readForm(),c=scope();
   if(!input.name||!Number.isFinite(input.quantity)||input.quantity<=0)throw Error('Indica el nombre y rendimiento de la receta.');
   S().requirements(db,input.recipe,c.owner,c.module); // Permite guardar una receta aun sin stock.
   const existing=db.productionRecipes.find(x=>match(x)&&x.id===recipeId);
   input.recipe=input.recipe.map(i=>({...i,mermaReal:0}));
   const record={...input,deleted:false,id:existing?.id||recipeId||id(),owner:c.owner,modulo:c.module,updatedAt:Date.now(),operator:operadorActual||'Admin'};
   if(existing)Object.assign(existing,record);else db.productionRecipes.push(record);
   recipeId=record.id;guardarDatos();render();notify('Receta guardada en LURO.');$('production-form-dialog').close();
  }catch(e){$('production-preview').textContent=e.message;}
 }
 function hold(){
  if(!editable())return;
  try{arrays();const input=readForm(),c=scope();if(!input.name)throw Error('Pon un nombre a la producción en espera.');
   const record={id:holdId||id(),owner:c.owner,modulo:c.module,input,recipeId,scheduleId,updatedAt:Date.now()};
   const existing=db.productionHolds.find(x=>match(x)&&x.id===holdId);if(existing)Object.assign(existing,record);else db.productionHolds.push(record);
   guardarDatos();$('production-form-dialog').close();reset();render();notify('Producción en espera. No se han descontado insumos.');
  }catch(e){$('production-preview').textContent=e.message;}
 }
 function render(){
  if(!mounted)return;
  arrays();const c=scope();const nextContext=c.owner+'|'+c.module;
  if(context&&nextContext!==context){for(const d of document.querySelectorAll('dialog[id^=production-]'))d.close();$('production-sheet-content').replaceChildren();reset();}context=nextContext;
  const q=$('production-recipe-search').value.trim().toLowerCase();
  const recipes=allRecipes();$('production-recipes-count').textContent=recipes.length+' recetas';
  $('production-recipe-list').innerHTML=recipes.filter(r=>(r.name||'').toLowerCase().includes(q)).map(r=>`<article class="production-recipe"><div><h3>${E(r.name)}</h3><p>Rendimiento: ${Number(r.quantity)||0} ${E(r.unit)} · ${(r.recipe||[]).length} insumos</p></div><div class="production-actions"><button type="button" class="btn" data-recipe-sheet="${E(r.id)}">Ver receta</button>${editable()?`<button type="button" class="btn btn-blue" data-produce-recipe="${E(r.id)}">Producir</button><button type="button" class="btn" data-edit-recipe="${E(r.id)}">Editar</button><button type="button" class="btn btn-danger" data-delete-recipe="${E(r.id)}">Eliminar</button>`:''}</div></article>`).join('')||'<p>No hay recetas para esta búsqueda. Puedes guardar las que ya existen en tu inventario de producción.</p>';
  const holds=scoped('productionHolds');$('production-holds').hidden=!holds.length;
  $('production-holds-list').innerHTML=holds.map(h=>`<article class="production-recipe"><strong>${E(h.input?.name)}</strong><p>${E(h.input?.quantity)} ${E(h.input?.unit)} · sin descontar insumos</p>${editable()?`<button class="btn" data-resume-hold="${E(h.id)}">Retomar</button><button class="btn btn-danger" data-delete-hold="${E(h.id)}">Cancelar</button>`:''}</article>`).join('');
  const pending=scoped('productionSchedule').filter(p=>p.status!=='completed');$('production-pending-count').textContent=pending.length;
  $('production-pending-list').innerHTML=pending.map(p=>`<article class="production-recipe"><strong>${E(p.name)}</strong><p>${E(p.date)} · ${Number(p.quantity)||0} ${E(p.unit)}</p>${editable()?`<button class="btn btn-save" data-start-schedule="${E(p.id)}">Realizar</button><button class="btn btn-danger" data-delete-schedule="${E(p.id)}">Cancelar</button>`:''}</article>`).join('')||'<p>No hay producción pendiente.</p>';
  $('production-schedule-recipe').innerHTML=recipes.map(r=>`<option value="${E(r.id)}">${E(r.name)}</option>`).join('');
  const hq=$('production-history-search').value.toLowerCase();
  const history=scoped('historial_prod').filter(h=>[h.producto,h.operador,h.fecha].join(' ').toLowerCase().includes(hq)).slice().reverse();
  $('production-history-list').innerHTML=history.map(h=>`<article class="production-recipe"><strong>${E(h.producto)}</strong><p>${E(h.cantidad)} · RD$${Number(h.costoOp||0).toFixed(2)}</p><small>${E(h.fecha)} · ${E(h.operador)} · ${E(h.tipo||'Producción')}</small>${h.reversedAt?'<p>Lote revertido · insumos devueltos</p>':''}${h.reversible&&editable()?`<button type="button" class="btn btn-danger" data-reverse-lot="${E(h.id)}">Revertir lote</button>`:''}${h.insumos?.length?`<details><summary>Insumos utilizados</summary>${h.insumos.map(i=>`<p>${E(i.nombre)} · ${Number(i.cantidad).toFixed(2)} ${E(i.unidad)}${i.merma?' · Merma: '+Number(i.merma).toFixed(2):''}${i.alertaMerma?' · Superó la merma prevista':''}</p>`).join('')}</details>`:''}</article>`).join('')||'<p>No hay producciones registradas.</p>';
  $('production-stock-count').textContent=scoped('produccion_stock').length+' productos preparados';
  document.querySelectorAll('[data-production-write]').forEach(b=>b.hidden=!editable());
 }
 function sheet(recipe){
  const target=$('production-sheet-content');target.innerHTML=`<h2>${E(recipe.name)}</h2><p>Rendimiento: ${Number(recipe.quantity)} ${E(recipe.unit)}</p>${(recipe.recipe||[]).map(i=>`<p><strong>${E(i.procedimiento||'Preparación')}</strong> · ${E(i.nombre)}: ${Number(i.cantidad)} ${E(i.unidad)}${i.merma?' · Merma '+Number(i.merma)+'%':''}</p>`).join('')}<h3>Procedimiento</h3><p class="production-instructions">${E(recipe.instructions||'Sin instrucciones registradas.')}</p>`;$('production-sheet-dialog').showModal();
 }
 function action(e){
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.reverseLot&&editable()){const record=scoped('historial_prod').find(x=>x.id===b.dataset.reverseLot);if(!record||!confirm('¿Revertir este lote y devolver los insumos?'))return;try{const c=scope();S().reverse(db,record,c.owner,c.module);guardarDatos();renderStockProduccion();render();notify('Lote revertido e insumos devueltos.');}catch(e){notify(e.message);}return;}
  const recipe=allRecipes().find(r=>r.id===(b.dataset.produceRecipe||b.dataset.editRecipe||b.dataset.recipeSheet||b.dataset.deleteRecipe));
  if(recipe){if(b.dataset.recipeSheet)return sheet(recipe);if(!editable())return;
   if(b.dataset.deleteRecipe){if(confirm('¿Eliminar esta receta? Los lotes ya producidos se conservan.')){const stored=db.productionRecipes.find(r=>match(r)&&r.id===recipe.id);if(stored)stored.deleted=true;else db.productionRecipes.push({...recipe,deleted:true});guardarDatos();render();}return;}
   open(b.dataset.editRecipe?'recipe':'produce',recipe);recipeId=recipe.id;return;
  }
  const h=scoped('productionHolds').find(x=>x.id===(b.dataset.resumeHold||b.dataset.deleteHold));
  if(h&&editable()){if(b.dataset.deleteHold){if(confirm('¿Cancelar esta producción en espera?')){db.productionHolds=db.productionHolds.filter(x=>x!==h);guardarDatos();render();}}else{open('produce',h.input);holdId=h.id;recipeId=h.recipeId||'';scheduleId=h.scheduleId||'';}return;}
  const p=scoped('productionSchedule').find(x=>x.id===(b.dataset.startSchedule||b.dataset.deleteSchedule));
  if(p&&editable()){if(b.dataset.deleteSchedule){if(confirm('¿Cancelar la producción programada?')){db.productionSchedule=db.productionSchedule.filter(x=>x!==p);guardarDatos();render();}}else{
    const r=allRecipes().find(x=>x.id===p.recipeId);if(!r)return notify('La receta programada ya no está disponible.');
    const factor=Number(p.quantity)/Number(r.quantity);open('produce',{...r,quantity:p.quantity,recipe:r.recipe.map(i=>({...i,cantidad:Number(i.cantidad)*factor}))});recipeId=r.id;scheduleId=p.id;$('production-pending-dialog').close();
   }}
 }
 function mount(){
  const host=$('produccion-interna');if(!host||mounted)return;
  // Se reutilizan los IDs y la función de carga existente, conectada a guardarDatos().
  const oldCard=host.querySelector('.card'),rows=$('contenedor-insumos-produccion'),builder=host.querySelector('.production-builder-row'),stockTable=$('tabla-stock-produccion').closest('table');
  const dialog=document.createElement('dialog');dialog.id='production-form-dialog';dialog.className='luro-work-dialog production-form-dialog';
  dialog.innerHTML='<div class="luro-work-head"><h2 id="production-form-title">Realizar producción</h2><button type="button" data-production-close aria-label="Cerrar producción">×</button></div><div id="production-builder-holder"></div><div class="production-extra-fields"><label>Multiplicar lote<input id="production-multiplier" type="number" min="0.01" step="any" value="1"></label><label>Existencia ideal<input id="prod_ideal" type="number" min="0" step="any" value="10"></label></div><div id="production-direct-fields" hidden><label>Costo total de la producción realizada (RD$)<input id="production-direct-cost" type="number" min="0" step="0.01" value="0"></label><p>Carga un lote ya realizado. Esta opción no descuenta insumos del almacén.</p></div><section id="production-ingredients-panel"><h3>Insumos y procedimientos</h3><div id="production-ingredients-holder"></div><button type="button" class="btn" id="production-add-ingredient">+ Insumo</button></section><label>Instrucciones y procedimientos<textarea id="production-instructions" rows="4" maxlength="12000"></textarea></label><p id="production-preview" role="status"></p><div class="production-actions"><button type="button" class="btn btn-save" id="production-complete">Finalizar y cargar producción</button><button type="button" class="btn btn-blue" id="production-save-recipe">Guardar receta</button><button type="button" class="btn" id="production-hold">Dejar en espera</button></div>';
  document.body.append(dialog);builder.querySelector('button').remove();$('production-builder-holder').append(builder);$('production-ingredients-holder').append(rows);
  builder.querySelectorAll('input,select').forEach(el=>{if(el.tagName==='INPUT'){el.min='0';el.step='any';}const caption=el.id==='prod_nombre'?'Nombre de producción':el.id==='prod_cantidad'?'Rendimiento del lote':'Unidad del rendimiento';el.setAttribute('aria-label',caption);const label=document.createElement('label');label.textContent=caption;el.before(label);label.append(el);});
  const oldUnit=$('prod_unidad');oldUnit.innerHTML=units.map(u=>`<option>${u}</option>`).join('');
  host.innerHTML='<section class="card production-overview"><div><h2>Producción</h2><p>Transforma insumos de Almacén en productos preparados para tu módulo.</p></div><div class="production-actions"><button type="button" class="btn" id="production-pending">Producción pendiente · <span id="production-pending-count">0</span></button><button type="button" class="btn" id="production-recipe-book">Recetario completo</button><button type="button" class="btn" data-production-write id="production-new-recipe">Nueva receta</button><button type="button" class="btn btn-blue" data-production-write id="production-direct">Cargar producción realizada</button><button type="button" class="btn btn-save" data-production-write id="production-new">Realizar producción</button></div><p id="production-status" role="status"></p></section><section class="card" id="production-holds" hidden><h3>Producciones en espera</h3><div id="production-holds-list"></div></section><div class="production-workspace-grid"><section class="card"><div class="luro-work-head"><h3>Recetas de producción</h3><small id="production-recipes-count"></small></div><input type="search" id="production-recipe-search" placeholder="Buscar receta" aria-label="Buscar receta"><div id="production-recipe-list"></div></section><section class="card"><h3>Historial de producción</h3><input type="search" id="production-history-search" placeholder="Buscar producción, fecha u operador" aria-label="Buscar historial de producción"><div id="production-history-list"></div></section></div><section class="card"><div class="luro-work-head"><h3>Inventario de producción actual</h3><small id="production-stock-count"></small></div><div id="production-stock-holder"></div></section>';
  $('production-stock-holder').append(stockTable);
  const pending=document.createElement('dialog');pending.id='production-pending-dialog';pending.className='luro-work-dialog';pending.innerHTML='<div class="luro-work-head"><h2>Producción pendiente</h2><button type="button" data-production-close aria-label="Cerrar pendientes">×</button></div><form id="production-schedule-form" class="production-extra-fields"><label>Receta<select id="production-schedule-recipe" required></select></label><label>Cantidad a producir<input id="production-schedule-quantity" type="number" min="0.0001" step="any" required></label><label>Fecha prevista<input id="production-schedule-date" type="date" required></label><button class="btn btn-blue" data-production-write>Programar</button></form><div id="production-pending-list"></div>';document.body.append(pending);
  const sheetDialog=document.createElement('dialog');sheetDialog.id='production-sheet-dialog';sheetDialog.className='luro-work-dialog';sheetDialog.innerHTML='<div class="luro-work-head"><strong>Recetario de producción</strong><button id="production-print" type="button">Imprimir</button><button type="button" data-production-close aria-label="Cerrar recetario">×</button></div><div id="production-sheet-content"></div>';document.body.append(sheetDialog);$('production-print').onclick=()=>window.print();
  $('production-new').onclick=()=>open();$('production-direct').onclick=()=>open('direct');$('production-new-recipe').onclick=()=>open('recipe');$('production-pending').onclick=()=>{render();pending.showModal();};
  $('production-recipe-book').onclick=()=>{$('production-sheet-content').innerHTML=allRecipes().map(r=>`<article class="production-recipe"><h2>${E(r.name)}</h2><p>${Number(r.quantity)} ${E(r.unit)}</p>${(r.recipe||[]).map(i=>`<p>${E(i.procedimiento||'Preparación')} · ${E(i.nombre)} · ${Number(i.cantidad)} ${E(i.unidad)}</p>`).join('')}<p class="production-instructions">${E(r.instructions||'')}</p></article>`).join('')||'<p>No hay recetas guardadas.</p>';sheetDialog.showModal();};
  $('production-add-ingredient').onclick=()=>addRow();$('production-complete').onclick=()=>procesarNuevaProduccion();$('production-save-recipe').onclick=saveRecipe;$('production-hold').onclick=hold;
  for(const d of [dialog,pending,sheetDialog]){d.querySelector('[data-production-close]').onclick=()=>d.close();d.addEventListener('click',action);}
  host.addEventListener('click',action);dialog.addEventListener('input',preview);dialog.addEventListener('change',preview);
  $('production-recipe-search').addEventListener('input',render);$('production-history-search').addEventListener('input',render);
  $('production-schedule-form').onsubmit=e=>{e.preventDefault();if(!editable())return;const r=allRecipes().find(x=>x.id===$('production-schedule-recipe').value),quantity=Number($('production-schedule-quantity').value),date=$('production-schedule-date').value;if(!r||!Number.isFinite(quantity)||quantity<=0||!date)return;if(!(Number(r.quantity)>0)){notify('Guarda primero el rendimiento original de esta receta.');return;}const c=scope();db.productionSchedule.push({id:id(),owner:c.owner,modulo:c.module,recipeId:r.id,name:r.name,quantity,unit:r.unit,date,status:'pending'});guardarDatos();render();};
  const transferDialog=document.createElement('dialog');transferDialog.id='production-transfer-dialog';transferDialog.className='luro-work-dialog';transferDialog.innerHTML='<div class="luro-work-head"><h2>Transferir producción</h2><button type="button" data-production-close aria-label="Cerrar transferencia">×</button></div><form id="production-transfer-form"><p id="production-transfer-name"></p><label>Módulo de destino<select id="production-transfer-module" required></select></label><label>Cantidad<input id="production-transfer-quantity" type="number" min="0.0001" step="any" required></label><p id="production-transfer-error" role="status"></p><button class="btn btn-blue">Transferir y registrar</button></form>';document.body.append(transferDialog);transferDialog.querySelector('[data-production-close]').onclick=()=>transferDialog.close();
  const legacyRenderStock=window.renderStockProduccion;window.renderStockProduccion=function(){const result=legacyRenderStock.apply(this,arguments);if(editable())for(const p of scoped('produccion_stock')){const index=db.produccion_stock.indexOf(p),actions=$('prod-tr-'+index)?.querySelector('.luro-action-buttons');if(!actions)continue;const b=document.createElement('button');b.type='button';b.className='btn btn-blue';b.textContent='Transferir';b.onclick=()=>{if(!editable())return;transferIndex=index;transferName=p.nombre;formContext=scope().owner+'|'+scope().module;$('production-transfer-name').textContent=p.nombre+' · Disponible: '+p.actual+' '+p.unidad;$('production-transfer-module').innerHTML=obtenerModulosDisponibles().filter(m=>m!=='ADMINISTRADOR'&&m!==moduloActual).map(m=>`<option value="${E(m)}">${E(m)}</option>`).join('');$('production-transfer-quantity').value='';$('production-transfer-quantity').max=p.actual;$('production-transfer-error').textContent='';transferDialog.showModal();};actions.append(b);}return result;};
  $('production-transfer-form').onsubmit=e=>{e.preventDefault();if(!editable())return;try{const c=scope(),target=$('production-transfer-module').value;if(formContext!==c.owner+'|'+c.module||!obtenerModulosDisponibles().includes(target))throw Error('El módulo o sesión cambió.');S().transfer(db,scoped('produccion_stock').find(p=>p.nombre===transferName),Number($('production-transfer-quantity').value),target,c.owner,c.module,operadorActual||'Admin',id());guardarDatos();transferDialog.close();renderStockProduccion();render();notify('Producción transferida y registrada.');}catch(e){$('production-transfer-error').textContent=e.message;}};
  window.LuroProduction={readForm,finish,render};window.agregarFilaIngredienteProduccion=()=>addRow();
  window.cargarEdicionProduccion=index=>{const p=db.produccion_stock[index];if(!p||!match(p))return;open('produce',{name:p.nombre,quantity:p.recetaRendimiento||'',unit:p.recetaUnidad||p.unidad,recipe:p.receta||[],instructions:p.instrucciones||'',ideal:p.ideal});};
  const navigate=window.showPage;window.showPage=function(page){const result=navigate.apply(this,arguments);if(page==='produccion-interna'){render();renderStockProduccion();}return result;};
  mounted=true;render();setInterval(()=>{const current=scope().owner+'|'+scope().module;if(current!==context||host.classList.contains('active')&&!dialog.open&&!pending.open)render();},1500);
 }
 document.addEventListener('DOMContentLoaded',mount);
})();
