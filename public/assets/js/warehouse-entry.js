/* Entrada rápida vinculada al almacén canónico de LuRo. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let selection=[],signature='',context='',busy=false;
 const allowed=()=>!!sesionUser&&!esColaboradorSesion&&tienePermisoPagina('inventario')&&tieneAsignacionEntrada('manual');
 const scope=()=>JSON.stringify([ownerDatosActivo(),moduloActual]);
 function updateUnits(){
  const value=$('warehouse-entry-product').value,item=value===''?null:selection[Number(value)],select=$('warehouse-entry-unit');
  const previous=select.value;select.replaceChildren(new Option('Selecciona unidad de entrada',''));
  if(!item)return;
  const units=[...new Set([item.unidad,'Lb','Oz','g','Kg','mL','Litros','Unidad'])];
  units.forEach(unit=>{try{if(unit!==item.unidad)LuroStock.convert(1,unit,item.unidad);select.add(new Option(unit,unit));}catch{}});
  select.value=[...select.options].some(o=>o.value===previous)&&previous?previous:item.unidad;
 }
 function render(){
  const form=$('warehouse-entry-form');if(!form)return;
  const next=sesionUser?scope():'';
  if(next!==context){form.reset();context=next;signature='';$('warehouse-entry-status').textContent='';}
  const rows=sesionUser?(db.almacen||[]).filter(p=>LuroInventory.scoped(p,ownerDatosActivo(),moduloActual)):[];
  const key=JSON.stringify(rows.map(p=>[p.nombre,p.unidad,p.actual]));
  if(key!==signature){const previous=$('warehouse-entry-product').value===''?null:selection[Number($('warehouse-entry-product').value)];const select=$('warehouse-entry-product');select.replaceChildren(new Option('Selecciona un producto del almacén',''));
   selection=rows.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));
   selection.forEach((p,i)=>select.add(new Option(p.nombre+' · '+p.unidad+' · Existencia: '+Number(p.actual||0),String(i))));
   const index=selection.indexOf(previous);if(index>=0)select.value=String(index);signature=key;updateUnits();
  }
  $('warehouse-entry-module').textContent=sesionUser?'Almacén vinculado: '+moduloActual:'Inicia sesión para registrar entradas';
  form.querySelectorAll('input,select,button[type="submit"]').forEach(el=>el.disabled=!allowed());
 }
 function save(event){
  event.preventDefault();if(busy)return;
  const message=$('warehouse-entry-status');
  if(!allowed()||context!==scope()){render();message.textContent='No tienes permiso para registrar entradas en este almacén.';return;}
  const value=$('warehouse-entry-product').value,item=value===''?null:selection[Number(value)],quantity=Number($('warehouse-entry-quantity').value);
  if(!item||!db.almacen.includes(item)||!LuroInventory.scoped(item,ownerDatosActivo(),moduloActual)){render();message.textContent='Selecciona un producto vigente del almacén.';return;}
  const unit=$('warehouse-entry-unit').value;let converted;
  try{if(!unit)throw Error('missing unit');converted=unit===item.unidad?quantity:LuroStock.convert(quantity,unit,item.unidad);}
  catch{message.textContent='Selecciona una unidad compatible con '+item.unidad+'.';return;}
  const before=Number(item.actual||0),after=before+converted;
  if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(after)||after<=before){message.textContent='Introduce una cantidad válida mayor que cero.';return;}
  busy=true;const old=item.actual,entries=db.entradas,entry={id:crypto.randomUUID(),owner:ownerDatosActivo(),modulo:moduloActual,fecha:new Date().toLocaleString(),producto:item.nombre,cant:quantity,medida:unit,cantidadAlmacen:converted,unidadAlmacen:item.unidad,costoTotal:converted*Number(item.costoUnitario||0),distribuidor:item.distribuidor||'',operador:typeof operadorActual==='undefined'?'Admin':operadorActual,origen:'entrada-rapida',anterior:before,actual:after};
  try{item.actual=after;db.entradas=[...(entries||[]),entry];guardarDatos();}
  catch(error){item.actual=old;db.entradas=entries;message.textContent='No se pudo guardar la entrada. La existencia se conserva; vuelve a intentarlo.';busy=false;return;}
  $('warehouse-entry-form').reset();signature='';busy=false;
  renderAlmacen();render();if(typeof renderEntradas==='function')renderEntradas();
  message.textContent='Entrada guardada: '+quantity+' '+unit+' de '+item.nombre+'. Existencia: '+after+' '+item.unidad+'.';
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const host=document.querySelector('#inventario .inventory-disclosure');if(!host)return;
  const section=document.createElement('section');section.id='warehouse-entry';section.className='warehouse-entry';
  section.innerHTML='<h3>📥 Formulario de entrada</h3><p id="warehouse-entry-module"></p><p>Selecciona un producto existente y suma la cantidad recibida a su almacén.</p><form id="warehouse-entry-form"><label for="warehouse-entry-product">Producto</label><select id="warehouse-entry-product" required></select><label for="warehouse-entry-quantity">Cantidad recibida</label><input id="warehouse-entry-quantity" type="number" min="0" step="any" placeholder="0.00" required><label for="warehouse-entry-unit">Unidad de medida de entrada</label><select id="warehouse-entry-unit" required></select><p>La cantidad se convierte automáticamente a la unidad del almacén. Se conservan las metas, el proveedor y el costo unitario del producto. Para registrar compras con otro costo o crear productos usa el formulario avanzado.</p><div class="warehouse-entry-actions"><button type="submit" class="btn btn-save">Guardar entrada</button><button type="reset" class="btn">Limpiar</button></div></form><p id="warehouse-entry-status" role="status" aria-live="polite"></p>';
  $('warehouse-entry-surface').append(section);host.querySelector('summary').textContent='Entrada avanzada / Nuevo producto';$('warehouse-entry-surface').append(host);
  $('warehouse-entry-product').addEventListener('change',()=>{$('warehouse-entry-unit').replaceChildren();updateUnits();});$('warehouse-entry-form').addEventListener('submit',save);$('warehouse-entry-form').addEventListener('reset',()=>$('warehouse-entry-status').textContent='');
  const original=window.renderAlmacen;window.renderAlmacen=function(){const result=original.apply(this,arguments);render();return result;};
  const navigate=window.showPage;window.showPage=function(id){const result=navigate.apply(this,arguments);if(id==='entrada-mercancia'&&$('entrada-mercancia').classList.contains('active'))renderAlmacen();render();return result;};
  render();setInterval(render,1500);
 });
})();
