const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const puppeteer=require('puppeteer');

test('mobile membership and Lafo work in Chrome with local fixtures and no external requests',async()=>{
 const browser=await puppeteer.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.setRequestInterception(true);
  page.on('request',async r=>{
   if(r.url().includes('cloudfunctions.net')){
    const name=r.url().split('/').pop();
    const results={menuGetCatalog:{business:'The Proyect',heroPhrase:'Pendiente por incluir',brand:{},items:[{id:'dish-fixture',name:'Mangú',price:250,basePrice:250,stock:3,category:'Desayuno',image:'',description:'Preparado aquí',ingredients:['Plátano','Cebolla'],soldQuantity:5,nutrition:{},allergens:''}]},menuGetOrders:{orders:[]},menuRegisterMember:{accessToken:'c'.repeat(64)},menuGetProfile:{name:'Ana',points:0,premiumActive:false,history:[],verificationPending:true}};
    return r.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'},body:JSON.stringify({result:results[name]})});
   }
   return r.url().startsWith('file:')||r.url().startsWith('data:')?r.continue():r.abort();
  });
  await page.goto(pathToFileURL(path.resolve(__dirname,'../public/menu/index.html')).href+'?owner=fixture&module=COCINA',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#luro-connection-status')?.textContent.includes('actualizado'),{timeout:8000}).catch(async e=>{throw new Error(e.message+' '+JSON.stringify({errors,status:await page.$eval('#luro-connection-status',x=>x.textContent).catch(()=> 'not mounted')}));});
  assert.equal(await page.$eval('#hero h1',x=>x.textContent),'Hoy secome bueno.');
  fs.mkdirSync(path.resolve(__dirname,'../tmp/integration2'),{recursive:true});
  await page.screenshot({path:path.resolve(__dirname,'../tmp/integration2/restored-home-mobile.png')});
  assert.equal(await page.$eval('#hero h1 em',x=>getComputedStyle(x).color),'rgb(226, 192, 141)');
  assert.equal(await page.$eval('.bottom-nav',x=>getComputedStyle(x).position),'fixed');
  await page.evaluate(()=>{openLafo();answerLafo('Qué es lo más vendido');answerLafo('De qué se compone Mangú');});
  assert.match(await page.$eval('#chat-messages',x=>x.textContent),/5 porciones vendidas/);
  assert.match(await page.$eval('#chat-messages',x=>x.textContent),/Plátano, Cebolla/);
  await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(x=>x.close());setView('profile');});
  await page.click('#luro-join');
  await page.type('#luro-member-form [name="name"]','Ana');
  await page.type('#luro-member-form [name="cedula"]','00112345678');
  await page.type('#luro-member-form [name="phone"]','8095551234');
  fs.mkdirSync(path.resolve(__dirname,'../tmp/integration2'),{recursive:true});
  await page.screenshot({path:path.resolve(__dirname,'../tmp/integration2/membership-mobile.png')});
  await page.click('#luro-member-form [type="submit"]');
  await page.waitForSelector('input[aria-label="Enlace privado de miembro"]');
  assert.match(await page.$eval('#secondary',x=>x.textContent),/Perfil creado/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
