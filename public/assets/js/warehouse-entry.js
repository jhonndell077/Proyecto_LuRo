/* Entrada rápida vinculada al almacén canónico de LuRo. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let selection=[],signature='',context='',busy=false;
 const allowed=()=>!!sesionUser&&!esColaboradorSesion&&tienePermisoPagina('inventario')&&tieneAsignacionEntrada('manual');
 const scope=()=>JSON.stringify([ownerDatosActivo(),moduloActual]);
 function render(){
  const form=$('warehouse-entry-form');if(!form)return;
  const next=sesionUser?scope():'';
  if(next!==context){form.reset();context=next;signature='';$('warehouse-entry-status').textContent='';}
  const rows=sesionUser?(db.almacen||[]).filter(p=>LuroInventory.scoped(p,ownerDatosActivo(),moduloActual)):[];
  const key=JSON.stringify(rows.map(p=>[p.nombre,p.unidad,p.actual]));
  if(key!==signature){const previous=selection[Number($('warehouse-entry-product').value)];const select=$('warehouse-entry-product');select.replaceChildren(new Option('Selecciona un producto del almacén',''));
   selection=rows.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));
   selection.forEach((p,i)=>select.add(new Option(p.nombre+' · '+p.unidad+' · Existencia: '+Number(p.actual||0),String(i))));
   const index=selection.indexOf(previous);if(index>=0)select.value=String(index);signature=key;
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
  const before=Number(item.actual||0),after=before+quantity;
  if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(after)||after<=before){message.textContent='Introduce una cantidad válida mayor que cero.';return;}
  busy=true;const old=item.actual,entries=db.entradas,entry={id:crypto.randomUUID(),owner:ownerDatosActivo(),modulo:moduloActual,fecha:new Date().toLocaleString(),producto:item.nombre,cant:quantity,medida:item.unidad,costoTotal:quantity*Number(item.costoUnitario||0),distribuidor:item.distribuidor||'',operador:typeof operadorActual==='undefined'?'Admin':operadorActual,origen:'entrada-rapida',anterior:before,actual:after};
  try{item.actual=after;db.entradas=[...(entries||[]),entry];guardarDatos();}
  catch(error){item.actual=old;db.entradas=entries;message.textContent='No se pudo guardar la entrada. La existencia se conserva; vuelve a intentarlo.';busy=false;return;}
  $('warehouse-entry-form').reset();signature='';busy=false;
  renderAlmacen();render();if(typeof renderEntradas==='function')renderEntradas();
  message.textContent='Entrada guardada: '+quantity+' '+item.unidad+' de '+item.nombre+'. Existencia: '+after+' '+item.unidad+'.';
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const host=document.querySelector('#inventario .inventory-disclosure');if(!host)return;
  const section=document.createElement('section');section.id='warehouse-entry';section.className='warehouse-entry';
  section.innerHTML='<h3>📥 Formulario de entrada</h3><p id="warehouse-entry-module"></p><p>Selecciona un producto existente y suma la cantidad recibida a su almacén.</p><form id="warehouse-entry-form"><label for="warehouse-entry-product">Producto</label><select id="warehouse-entry-product" required></select><label for="warehouse-entry-quantity">Cantidad recibida (en la unidad del producto)</label><input id="warehouse-entry-quantity" type="number" min="0" step="any" placeholder="0.00" required><p>Se conservan las metas, el proveedor y el costo unitario del producto. Para registrar compras con otro costo o crear productos usa el formulario avanzado.</p><div class="warehouse-entry-actions"><button type="submit" class="btn btn-save">Guardar entrada</button><button type="reset" class="btn">Limpiar</button></div></form><p id="warehouse-entry-status" role="status" aria-live="polite"></p>';
  host.before(section);host.querySelector('summary').textContent='Entrada avanzada / Nuevo producto';
  $('warehouse-entry-form').addEventListener('submit',save);$('warehouse-entry-form').addEventListener('reset',()=>$('warehouse-entry-status').textContent='');
  const nav=document.createElement('button');nav.type='button';nav.className='btn btn-save';nav.textContent='Registrar entrada';nav.id='warehouse-entry-open';nav.onclick=()=>{$('inventory-tab-stock').click();section.scrollIntoView({behavior:'smooth',block:'start'});$('warehouse-entry-product').focus({preventScroll:true});};document.querySelector('.inventory-tabs').prepend(nav);
  const original=window.renderAlmacen;window.renderAlmacen=function(){const result=original.apply(this,arguments);render();return result;};
  const navigate=window.showPage;window.showPage=function(id){const result=navigate.apply(this,arguments);render();return result;};
  render();setInterval(render,1500);
 });
})();
