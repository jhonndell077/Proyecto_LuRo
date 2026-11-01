/* Importación local de almacén: CSV y Excel Open XML, sin dependencias remotas. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), MAX=8*1024*1024;
 const key=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const fields={nombre:['nombre','producto','productos','descripcion','articulo','nombre del producto'],cantidad:['cantidad','existencia','stock','actual','cant entrada','almacen','total stok','total stock'],unidad:['unidad','medida','unidad de medida'],costo:['costo unitario','precio unitario','costo','precio'],ideal:['ideal','stock ideal','stock ideal (provisional)','meta'],distribuidor:['distribuidor','proveedor','distribidora','distribuidora']};
 let rows=[],rawRows=[],scope='',busy=false,headerIndex=0;
 const current=()=>sesionUser?.user+'|'+moduloActual;
 function allowed(){if(!sesionUser||!moduloActual)throw Error('Selecciona una cuenta y un módulo.');if(bloquearAccionAdministrativaColaborador()||!tieneAsignacionEntrada('manual'))throw Error('No tienes permiso para registrar entradas.');}
 function csv(text){
  text=text.replace(/^\uFEFF/,'');const lines=text.split(/\r?\n/);const first=lines.slice(0,100).find(line=>line.split(/[;,\t]/).some(h=>fields.nombre.includes(key(h.replace(/^"|"$/g,'')))))||lines.find(line=>line.trim())||'';const sep=[';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const out=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===sep||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==sep){out.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}else cell+=c;}
  if(quoted)throw Error('CSV con comillas sin cerrar.');if(cell||row.length){row.push(cell);out.push(row);}return out;
 }
 function xml(text){const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw Error('Excel contiene XML inválido.');return d;}
 async function excel(buffer){
  const b=new Uint8Array(buffer),v=new DataView(buffer),files=new Map();if(b.length<22)throw Error('Archivo XLSX inválido.');let end=b.length-22;
  while(end>=Math.max(0,b.length-65557)&&v.getUint32(end,true)!==0x06054b50)end--;
  if(end<0||v.getUint32(end,true)!==0x06054b50)throw Error('Archivo XLSX inválido. Usa Excel .xlsx o CSV.');
  const count=v.getUint16(end+10,true);let pos=v.getUint32(end+16,true),total=0;
  if(count>3000)throw Error('El archivo tiene demasiadas entradas.');
  for(let i=0;i<count;i++){
   if(v.getUint32(pos,true)!==0x02014b50)throw Error('Archivo Excel dañado.');
   const method=v.getUint16(pos+10,true),size=v.getUint32(pos+20,true),expanded=v.getUint32(pos+24,true),n=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true),name=new TextDecoder().decode(b.slice(pos+46,pos+46+n));
   total+=expanded;if(total>32*1024*1024)throw Error('El Excel descomprimido es demasiado grande.');
   files.set(name,{method,size,expanded,offset});pos+=46+n+extra+comment;
  }
  async function read(name){const f=files.get(name);if(!f)return '';const start=f.offset+30+v.getUint16(f.offset+26,true)+v.getUint16(f.offset+28,true);let data=b.slice(start,start+f.size);if(f.method===8){const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const reader=stream.getReader(),chunks=[];let length=0;while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>f.expanded||length>32*1024*1024){await reader.cancel();throw Error('Excel demasiado grande.');}chunks.push(r.value);}data=new Uint8Array(length);let p=0;for(const c of chunks){data.set(c,p);p+=c.length;}}else if(f.method!==0)throw Error('Compresión de Excel no compatible.');return new TextDecoder().decode(data);}
  const shared=files.has('xl/sharedStrings.xml')?[...xml(await read('xl/sharedStrings.xml')).getElementsByTagName('si')].map(n=>[...n.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
  const workbook=xml(await read('xl/workbook.xml')),sheet=workbook.getElementsByTagName('sheet')[0];if(!sheet)throw Error('El Excel no tiene hojas.');
  const rels=xml(await read('xl/_rels/workbook.xml.rels')),rel=[...rels.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===sheet.getAttribute('r:id'));
  const target=rel?.getAttribute('Target')||'worksheets/sheet1.xml',name=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
  const out=[];for(const r of xml(await read(name)).getElementsByTagName('row')){const rowNumber=Number(r.getAttribute('r'))||out.length+1;if(!Number.isInteger(rowNumber)||rowNumber<1||rowNumber>10100)throw Error('Demasiadas filas en el Excel.');while(out.length<rowNumber-1)out.push([]);const row=[];for(const c of r.getElementsByTagName('c')){const letters=(c.getAttribute('r')||'A').replace(/[0-9]/g,'');let index=0;for(const l of letters)index=index*26+l.charCodeAt(0)-64;if(index>1000)throw Error('Demasiadas columnas.');const value=c.getElementsByTagName('v')[0]?.textContent||'';row[index-1]=c.getAttribute('t')==='s'?shared[Number(value)]||'':c.getAttribute('t')==='inlineStr'?[...c.getElementsByTagName('t')].map(n=>n.textContent).join(''):value;}out.push(row);if(out.length>10001)throw Error('Máximo 10,000 productos por importación.');}return out;
 }
 function number(x,fallback=0){if(x===undefined||String(x).trim()==='')return fallback;let s=String(x).replace(/RD\$|\$|\s/gi,'');if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);if(!Number.isFinite(n)||n<0)throw Error('Número inválido: '+String(x));return n;}
 function units(x){const k=key(x||'Unidad');const map={lb:'Lb',libras:'Lb',libra:'Lb',oz:'Oz',onzas:'Oz',onza:'Oz',g:'g',gramos:'g',gramo:'g',ml:'mL',mililitros:'mL',litros:'Litros',litro:'Litros',l:'Litros',unidad:'Unidad',unidades:'Unidad',und:'Unidad'};if(!map[k])throw Error('Unidad no compatible: '+x);return map[k];}
 function detectHeader(data){
  let best=0,score=-1;
  data.slice(0,100).forEach((row,i)=>{const names=row.map(key);const points=Object.entries(fields).reduce((n,[f,aliases])=>n+(names.some(h=>aliases.includes(h))?(f==='nombre'?10:1):0),0);if(points>score){score=points;best=i;}});
  return best;
 }
 function updatePreview(){
  const host=$('inventory-import-preview');host.replaceChildren();
  try {const products=plan();const count=document.createElement('p');count.textContent=products.length+' productos · revisa cantidades, unidades y metas antes de importar.';host.append(count);
   for(const p of products.slice(0,8)){const line=document.createElement('p');line.textContent=p.nombre+' · '+p.actual+' '+p.unidad+' · meta '+p.ideal+' · costo RD$'+p.costoUnitario;host.append(line);}
   if(products.some(p=>p.nombre.endsWith(')'))){const note=document.createElement('p');note.textContent='Los nombres repetidos con unidades incompatibles se distinguen con la unidad entre paréntesis.';host.append(note);}
   $('inventory-import-commit').disabled=!products.length||busy;
  }catch(e){host.textContent=e.message;$('inventory-import-commit').disabled=true;}
 }
 function mapColumns(index){
  headerIndex=index;rows=rawRows.slice(index);const mapping=$('inventory-import-mapping');mapping.replaceChildren();
  for(const [f,aliases] of Object.entries(fields)){
   const label=document.createElement('label');label.textContent={nombre:'Producto',cantidad:'Cantidad existente',unidad:'Unidad',costo:'Costo unitario',ideal:'Stock ideal',distribuidor:'Proveedor'}[f];
   const select=document.createElement('select');select.id='import-column-'+f;select.add(new Option('Sin columna','-1'));
   Array.from({length:rows[0].length},(_,i)=>select.add(new Option(String(rows[0][i]||'Columna '+(i+1)),String(i))));
   // Match aliases in priority order, so ALMACEN wins over a derived TOTAL STOK.
   let column=-1;for(const alias of aliases){column=rows[0].findIndex(h=>key(h)===alias);if(column>=0)break;}select.value=String(column);
   select.addEventListener('change',updatePreview);label.append(select);mapping.append(label);
  }
  $('inventory-import-commit').hidden=false;$('inventory-import-status').textContent='Encabezados en fila '+(index+1)+'. El costo y la cantidad vacíos se registran como 0.';updatePreview();
 }
 function stage(data){
  if(data.length<2)throw Error('La hoja necesita encabezados y productos.');if(data.length>10100)throw Error('Máximo 10,000 productos.');
  rawRows=data;scope=current();const input=$('inventory-import-header');input.max=String(data.length-1);input.value=String(detectHeader(data)+1);input.parentElement.hidden=false;mapColumns(Number(input.value)-1);
 }
 function plan(){
  const indexes=Object.fromEntries(Object.keys(fields).map(f=>[f,Number($('import-column-'+f).value)]));
  if(indexes.nombre<0)throw Error('Selecciona la columna de producto.');const used=Object.values(indexes).filter(i=>i>=0);if(new Set(used).size!==used.length)throw Error('Cada campo debe usar una columna diferente.');
  const products=rows.slice(1).map((r,i)=>({r,i})).filter(({r})=>used.some(i=>String(r[i]??'').trim())).map(({r,i})=>{
   try{const get=f=>r[indexes[f]],nombre=String(get('nombre')||'').toLowerCase().trim();if(!nombre)throw Error('Falta el producto.');return {nombre,actual:number(get('cantidad')),unidad:units(get('unidad')),costoUnitario:number(get('costo')),ideal:number(get('ideal')),distribuidor:String(get('distribuidor')||'').trim()};}
   catch(e){throw Error('Fila '+(headerIndex+i+2)+': '+e.message);}
  });
  if(products.length>10000)throw Error('Máximo 10,000 productos.');
  const groups=new Map();for(const p of products){const k=key(p.nombre);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  for(const group of groups.values()){const distinct=[...new Set(group.map(p=>p.unidad))];if(distinct.some(a=>distinct.some(b=>!esUnidadCompatible(a,b))))for(const p of group)p.nombre+=' ('+p.unidad+')';}
  return products;
 }
 function commit(){allowed();if(scope!==current())throw Error('La cuenta o módulo cambió. Vuelve a cargar la hoja.');const products=plan(),owner=sesionUser.user,module=moduloActual,stock=structuredClone(db.almacen||[]),entries=[];
  for(const p of products){let item=stock.find(a=>a.owner===owner&&a.modulo===module&&key(a.nombre)===key(p.nombre));if(item){if(!esUnidadCompatible(p.unidad,item.unidad))throw Error('Unidad incompatible para '+p.nombre);const q=convertirUnidad(p.actual,p.unidad,item.unidad);if(!Number.isFinite(q)||q<0)throw Error('Cantidad inválida para '+p.nombre);const quantity=Number(item.actual)+q,value=Number(item.actual)*(Number(item.costoUnitario)||0)+p.actual*p.costoUnitario;item.actual=quantity;item.costoUnitario=quantity?value/quantity:0;item.ideal=convertirUnidad(p.ideal,p.unidad,item.unidad);if(p.distribuidor)item.distribuidor=p.distribuidor;}else stock.push({...p,owner,modulo:module});
   entries.push({owner,modulo:module,fecha:new Date().toLocaleString(),producto:p.nombre,cant:p.actual,medida:p.unidad,costoTotal:p.actual*p.costoUnitario,distribuidor:p.distribuidor,operador:typeof operadorActual==='undefined'?'Admin':operadorActual,origen:'importacion'});
  }
  if (stock.filter(p=>p.owner===owner&&p.modulo===module).some(p=>![p.actual,p.ideal,p.costoUnitario].every(v=>Number.isFinite(v)&&v>=0)) || entries.some(e=>!Number.isFinite(e.costoTotal))) throw Error('La importación produce cantidades o costos inválidos.');
  const oldStock=db.almacen,oldEntries=db.entradas;try{db.almacen=stock;db.entradas=[...(db.entradas||[]),...entries];guardarDatos();}catch(e){db.almacen=oldStock;db.entradas=oldEntries;throw e;}renderAlmacen();rows=[];rawRows=[];$('inventory-import-commit').hidden=true;$('inventory-import-status').textContent=products.length+' productos importados en '+module+'.';
 }
 async function load(action){if(busy)return;busy=true;$('inventory-import-commit').disabled=true;try{allowed();rows=[];rawRows=[];$('inventory-import-commit').hidden=true;const start=current();const data=await action();if(start!==current())throw Error('Cambió la sesión. Vuelve a cargar la hoja.');stage(data);}catch(e){$('inventory-import-status').textContent=e.message;}finally{busy=false;if(rows.length)updatePreview();}}
 function sheetUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='docs.google.com'||u.username||u.password||u.port)throw Error('Usa un enlace HTTPS de Google Sheets.');const id=u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)\//)?.[1];if(!id)throw Error('Enlace de Google Sheets inválido.');const gid=u.searchParams.get('gid')||new URLSearchParams(u.hash.slice(1)).get('gid')||'0';if(!/^\d+$/.test(gid))throw Error('Hoja inválida.');return 'https://docs.google.com/spreadsheets/d/'+id+'/export?format=csv&gid='+gid;}
 function htmlRows(text){
  const doc=new DOMParser().parseFromString(text,'text/html');
  const table=doc.querySelector('table.waffle');if(!table)throw Error('El enlace no expone una tabla pública. Descarga el Excel y cárgalo como archivo.');
  const data=[...table.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())).filter(row=>row.length>0);
  if(!data.some(row=>row.some(h=>fields.nombre.includes(key(h)))))throw Error('No se encontró la columna de productos en la hoja pública.');return data;
 }
 async function readResponse(response){
  if(!response.ok)throw Error('El servidor devolvió '+response.status);const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>MAX)throw Error('Máximo 8 MB.');text+=decoder.decode(r.value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel();}
 }
 async function readLink(value){
  const url=sheetUrl(value),options=()=>({credentials:'omit',signal:AbortSignal.timeout(20000)});let firstError;
  try{const text=await readResponse(await fetch(url,options()));if(/^\s*</.test(text)||text.startsWith('PK')||text.includes('\0'))throw Error('La exportación no es CSV.');const data=csv(text);if(data.length<2)throw Error('La exportación está vacía.');return data;}catch(e){firstError=e;}
  // Office files shared through Sheets expose a read-only table in the public editor.
  try{const editor=url.replace(/\/export\?.*$/,'/edit');return htmlRows(await readResponse(await fetch(editor,options())));}
  catch(e){throw Error('No se pudo leer la hoja pública. Verifica el vínculo o descarga el archivo .xlsx y cárgalo aquí. '+(e.name==='AbortError'||e.name==='TimeoutError'?'Se agotó el tiempo de espera.':firstError.message==='Máximo 8 MB.'?firstError.message:''));}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const host=$('inventario');if(!host)return;const button=document.createElement('button');button.type='button';button.className='btn btn-blue';button.id='inventory-import-open';button.textContent='Importar';host.querySelector('h2')?.after(button);
  const d=document.createElement('dialog');d.id='inventory-import-dialog';d.className='luro-work-dialog';d.innerHTML='<h2>Importar productos al almacén</h2><p>Excel .xlsx, CSV o enlace público de Google Sheets, incluido Excel compartido desde Drive. Se usa la primera hoja del Excel. Los productos sin costo se registran con costo 0. Las existencias se suman.</p><button type="button" id="inventory-import-template" class="btn">Descargar plantilla CSV</button><p><label>Archivo <input type="file" id="inventory-import-file"></label></p><p>Formatos importables: .xlsx, .csv y .tsv. Si eliges un PDF, primero conviértelo a Excel o CSV; cambiar la extensión no lo convierte.</p><label>Enlace de Google Sheets<input type="url" id="inventory-import-url" placeholder="https://docs.google.com/spreadsheets/d/..."></label><button type="button" class="btn" id="inventory-import-link">Leer enlace</button><label hidden>Fila de encabezados<input type="number" id="inventory-import-header" min="1" step="1"></label><div id="inventory-import-mapping" style="display:grid;gap:8px"></div><div id="inventory-import-preview" role="region" aria-label="Vista previa de productos"></div><p id="inventory-import-status" role="status" aria-live="polite"></p><button type="button" class="btn btn-save" id="inventory-import-commit" hidden>Importar filas</button> <button type="button" class="btn" id="inventory-import-close">Cerrar</button>';document.body.append(d);
  button.onclick=()=>{try{allowed();d.showModal();}catch(e){alert(e.message);}};$('inventory-import-close').onclick=()=>d.close();
  $('inventory-import-file').onchange=e=>load(async()=>{const f=e.target.files[0];if(!f)throw Error('Selecciona un archivo.');if(f.size>MAX)throw Error('Máximo 8 MB.');if(/\.pdf$/i.test(f.name)||f.type==='application/pdf')throw Error('Este archivo es un PDF. Para importar sus productos, conviértelo a Excel (.xlsx) o CSV. No basta con renombrarlo.');if(/\.xlsx$/i.test(f.name))return excel(await f.arrayBuffer());if(!/\.(csv|tsv)$/i.test(f.name))throw Error('Usa .xlsx o .csv; convierte los archivos .xls desde Excel.');return csv(await f.text());});
  $('inventory-import-link').onclick=()=>load(()=>readLink($('inventory-import-url').value.trim()));
  $('inventory-import-header').onchange=e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<rawRows.length)mapColumns(n-1);else{$('inventory-import-status').textContent='Indica una fila de encabezados válida.';$('inventory-import-commit').disabled=true;}};
  $('inventory-import-commit').onclick=()=>{if(busy||!rows.length)return;try{commit();}catch(e){$('inventory-import-status').textContent=e.message;}};
  $('inventory-import-template').onclick=()=>{const url=URL.createObjectURL(new Blob(['\uFEFFProducto,Cantidad,Unidad,Costo unitario,Stock ideal,Proveedor\r\nArroz,10,Lb,,20,\r\n'],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='plantilla-almacen.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const unit=$('inv_costo_unitario'),total=$('inv_costo_total'),quantity=$('inv_actual');unit.addEventListener('input',()=>{unit.dataset.manual='true';total.value=(Number(unit.value||0)*Number(quantity.value||0)).toFixed(2);});total.addEventListener('input',()=>{delete unit.dataset.manual;unit.value=Number(quantity.value)>0?(Number(total.value||0)/Number(quantity.value)).toFixed(2):'';});
  window.LuroInventoryImport={csv,excel,stage,plan,commit,sheetUrl,readLink,htmlRows,detectHeader};
 });
})();
