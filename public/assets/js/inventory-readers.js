/* Lectores locales de Excel y PDF. No envían documentos a servicios externos. */
(() => {
 'use strict';
 const base=new URL('../vendor/',document.currentScript.src),MAX=8*1024*1024;
 let sheetPromise,pdfPromise;
 const key=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 function sheetjs(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(!sheetPromise)sheetPromise=new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();sheetPromise=null;reject(Error('No se pudo cargar el lector Excel. Revisa la conexión y vuelve a abrir Importar hoja.'));},20000);script.src=new URL('sheetjs/xlsx.full.min.js',base).href;script.onload=()=>{clearTimeout(timer);resolve(window.XLSX);};script.onerror=()=>{clearTimeout(timer);script.remove();sheetPromise=null;reject(Error('No se pudo cargar el lector Excel.'));};document.head.append(script);});return sheetPromise;
 }
 function zipLimit(buffer){
  const bytes=new Uint8Array(buffer);if(bytes.length>MAX)throw Error('Máximo 8 MB.');if(bytes[0]!==80||bytes[1]!==75)return;
  const view=new DataView(buffer);let pos=bytes.length-22;const min=Math.max(0,bytes.length-65557);while(pos>=min&&view.getUint32(pos,true)!==0x06054b50)pos--;
  if(pos<min)throw Error('Excel dañado: no se encontró su directorio.');const count=view.getUint16(pos+10,true);let at=view.getUint32(pos+16,true),expanded=0;if(count>3000)throw Error('El Excel tiene demasiados archivos internos.');
  for(let i=0;i<count;i++){if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error('Excel dañado.');expanded+=view.getUint32(at+24,true);if(expanded>32*1024*1024)throw Error('El Excel descomprimido supera 32 MB.');at+=46+view.getUint16(at+28,true)+view.getUint16(at+30,true)+view.getUint16(at+32,true);}
 }
 async function excel(buffer,index=0,listOnly=false){
  zipLimit(buffer);const XLSX=await sheetjs();let book;try{book=XLSX.read(buffer,{type:'array',dense:true,cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false,sheetRows:10102});}catch{throw Error('No se pudo abrir el Excel. Comprueba que no esté protegido por contraseña o dañado.');}
  if(!book.SheetNames.length||book.SheetNames.length>100)throw Error('El Excel no tiene hojas válidas o tiene más de 100.');if(listOnly)return book.SheetNames;
  if(!Number.isInteger(index)||!book.SheetNames[index])throw Error('Selecciona una hoja válida.');const sheet=book.Sheets[book.SheetNames[index]],range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');
  if(range.e.r>=10100||range.e.c>=1000)throw Error('Máximo 10,000 productos y 1,000 columnas.');
  return XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:true,range:0});
 }
 const aliases={nombre:['producto','productos','descripcion','nombre del producto'],unidad:['medida','unidad','unidad de medida'],cantidad:['almacen','cantidad','existencia','actual','total stok','total stock'],ideal:['stock ideal','stock ideal (provisional)','meta'],costo:['precio','costo unitario','precio unitario'],proveedor:['distribidora','distribuidora','proveedor','suplidor']};
 const unitPattern=/^(?:onza|onzas|oz|libra|libras|lb|unidad|unidades|unid|uni|und|g|gramos?|kg|kilogramos?|ml|mililitros?|l|lt|litros?)$/i;
 function table(items){
  const texts=items.filter(t=>typeof t.str==='string'&&t.str.trim()).map(t=>({text:t.str.trim(),x:t.transform[4]+t.width/2,y:t.transform[5],height:Math.max(1,t.height)}));
  const product=texts.find(t=>aliases.nombre.includes(key(t.text))),unit=texts.find(t=>aliases.unidad.includes(key(t.text))&&product&&Math.abs(t.y-product.y)<12);
  if(!product||!unit)return [];
  const tolerance=Math.max(product.height,unit.height)*1.5,headerItems=texts.filter(t=>Math.abs(t.y-product.y)<=tolerance).sort((a,b)=>a.x-b.x),columns=[];
  for(const t of headerItems){const near=columns.find(c=>Math.abs(c.x-t.x)<Math.max(3,t.height*2));if(near)near.labels.push(key(t.text));else columns.push({x:t.x,labels:[key(t.text)]});}
  const find=field=>{for(const alias of aliases[field]){const i=columns.findIndex(c=>c.labels.includes(alias));if(i>=0)return i;}return -1;};
  const index=Object.fromEntries(Object.keys(aliases).map(k=>[k,find(k)])),columnAt=x=>columns.findIndex((c,i)=>x>=(i?(columns[i-1].x+c.x)/2:-Infinity)&&x<(i<columns.length-1?(columns[i+1].x+c.x)/2:Infinity));
  if(index.nombre<0||index.unidad<0)return [];
  const anchors=texts.filter(t=>t.y<product.y-tolerance&&columnAt(t.x)===index.unidad&&unitPattern.test(t.text)).sort((a,b)=>b.y-a.y);
  return anchors.map((anchor,i)=>{const gap=anchors[i+1]?anchor.y-anchors[i+1].y:i?anchors[i-1].y-anchor.y:anchor.height*3,top=i?(anchors[i-1].y+anchor.y)/2:Math.min(product.y-tolerance,anchor.y+gap/2),bottom=anchors[i+1]?(anchor.y+anchors[i+1].y)/2:anchor.y-gap/2;
   const row=texts.filter(t=>t.y<=top&&t.y>bottom),cell=field=>index[field]<0?'':row.filter(t=>columnAt(t.x)===index[field]).sort((a,b)=>Math.abs(a.y-b.y)>Math.min(a.height,b.height)/2?b.y-a.y:a.x-b.x).map(t=>t.text).join(field==='nombre'||field==='proveedor'?' ':'');
   const name=cell('nombre');if(!name)throw Error('Hay una fila del PDF sin producto reconocible. Revisa el documento.');
   return [name,cell('cantidad'),anchor.text,cell('costo'),cell('ideal'),cell('proveedor')];
  });
 }
 async function pdf(buffer){
  if(buffer.byteLength>MAX)throw Error('Máximo 8 MB.');
  if(!pdfPromise)pdfPromise=import(new URL('pdfjs/pdf.mjs',base).href).catch(e=>{pdfPromise=null;throw Error('No se pudo cargar el lector PDF. Revisa la conexión y actualiza la aplicación.');});
  const lib=await pdfPromise;lib.GlobalWorkerOptions.workerSrc=new URL('pdfjs/pdf.worker.mjs',base).href;
  const task=lib.getDocument({data:new Uint8Array(buffer.slice(0)),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,stopAtErrors:true});
  try{const doc=await task.promise;if(doc.numPages>100)throw Error('El PDF supera 100 páginas.');const rows=[];let count=0,textCount=0;
   for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();count+=content.items.length;textCount+=content.items.filter(t=>t.str?.trim()).length;if(count>150000)throw Error('El PDF contiene demasiado texto.');const extracted=table(content.items);if(doc.numPages>1&&!extracted.length)throw Error('No se pudo reconocer la tabla en la página '+i+'. Para evitar una importación parcial, usa Excel o un PDF con encabezados en cada página.');rows.push(...extracted);if(rows.length>10000)throw Error('Máximo 10,000 productos.');page.cleanup();}
   if(!rows.length)throw Error(textCount?'No se reconoció una tabla de productos y unidades en el PDF. Usa Excel o CSV para esta estructura.':'El PDF contiene imágenes sin texto seleccionable. Se necesita OCR o el Excel original.');
   return [['Producto','Cantidad','Unidad','Costo unitario','Stock ideal','Proveedor'],...rows];
  }catch(e){if(e.name==='PasswordException')throw Error('El PDF está protegido por contraseña. Usa una copia sin protección.');throw e;}finally{await task.destroy();}
 }
 window.LuroImportReaders={excel,pdf,table};
})();
