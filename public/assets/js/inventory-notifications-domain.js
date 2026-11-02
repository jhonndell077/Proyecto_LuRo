/* Historial persistente de movimientos y avisos de reposición. Sin acceso a red. */
(function(root){
 'use strict';
 const norm=x=>String(x??'').trim().toLowerCase(),scope=(owner,module)=>JSON.stringify([norm(owner),module]);
 const itemKey=p=>JSON.stringify([norm(p.owner),p.modulo,norm(p.nombre),p.unidad]);
 const target=(p,period)=>Math.max(0,Number((period==='viernes_domingo'?p.stockViernesDomingo:p.stockLunesJueves)??p.ideal)||0);
 function observe(db,now=Date.now()){
  if(!Array.isArray(db.almacen))return false;
  let changed=false;db.inventoryNotifications=Array.isArray(db.inventoryNotifications)?db.inventoryNotifications:[];
  const states=db.inventoryNotificationState&&typeof db.inventoryNotificationState==='object'&&!Array.isArray(db.inventoryNotificationState)?db.inventoryNotificationState:{};
  db.inventoryNotificationState=states;const knownScopes=new Set(Object.values(states).filter(Boolean).map(s=>scope(s.owner,s.modulo)));const seen=new Set(),ids=new Set(db.inventoryNotifications.map(n=>n.id));
  function emit(p,key,state,type,period,previous,quantity,goal){
   const id=JSON.stringify([key,state.revision,type,period,previous,quantity,state.week,state.weekend]);if(ids.has(id))return;
   ids.add(id);db.inventoryNotifications.push({id,owner:norm(p.owner),modulo:p.modulo,producto:p.nombre,unidad:p.unidad,type,period,previous,quantity,target:goal,createdAt:now,readAt:0});changed=true;
  }
  for(const p of db.almacen){
   if(!p||!p.owner||!p.modulo||!p.nombre||!Number.isFinite(Number(p.actual)))continue;
   const key=itemKey(p);if(seen.has(key))continue;seen.add(key);
   const old=states[key],quantity=Number(p.actual),week=target(p,'lunes_jueves'),weekend=target(p,'viernes_domingo');
   if(old&&old.quantity===quantity&&old.week===week&&old.weekend===weekend)continue;
   const state={owner:norm(p.owner),modulo:p.modulo,quantity,week,weekend,revision:(Number(old?.revision)||0)+1};
   if((old&&old.quantity!==quantity)||(!old&&quantity!==0&&knownScopes.has(scope(p.owner,p.modulo))))emit(p,key,state,'movement','all',old?.quantity??0,quantity,0);
   const needWeek=week>quantity&&(!old||old.quantity>=old.week),needWeekend=weekend>quantity&&(!old||old.quantity>=old.weekend);
   if(needWeek&&needWeekend&&week===weekend)emit(p,key,state,'replenishment','all',quantity,quantity,week);
   else{if(needWeek)emit(p,key,state,'replenishment','lunes_jueves',quantity,quantity,week);if(needWeekend)emit(p,key,state,'replenishment','viernes_domingo',quantity,quantity,weekend);}
   states[key]=state;changed=true;
  }
  for(const key of Object.keys(states))if(!seen.has(key)){delete states[key];changed=true;}
  // El historial reciente se limita a 200 avisos por propietario y módulo.
  const groups=new Map();for(const event of db.inventoryNotifications){const s=scope(event.owner,event.modulo);if(!groups.has(s))groups.set(s,[]);groups.get(s).push(event);}
  const retained=[...groups.values()].flatMap(xs=>xs.sort((a,b)=>Number(a.createdAt)-Number(b.createdAt)).slice(-200));if(retained.length!==db.inventoryNotifications.length){db.inventoryNotifications=retained;changed=true;}
  return changed;
 }
 function events(db,owner,module,period){return (db.inventoryNotifications||[]).filter(n=>norm(n.owner)===norm(owner)&&n.modulo===module&&(n.period==='all'||n.period===period)).sort((a,b)=>b.createdAt-a.createdAt);}
 function readAll(db,owner,module,period,now=Date.now()){let count=0;for(const n of events(db,owner,module,period))if(!n.readAt){n.readAt=now;count++;}return count;}
 function merge(remote,local){
  const scopes=new Set([...(remote.almacen||[]),...(remote.inventoryNotifications||[])].map(p=>scope(p.owner,p.modulo))),map=new Map();
  for(const n of [...(local.inventoryNotifications||[]),...(remote.inventoryNotifications||[])]){if(!n?.id||!scopes.has(scope(n.owner,n.modulo)))continue;const old=map.get(n.id);map.set(n.id,{...n,readAt:Math.max(Number(old?.readAt)||0,Number(n.readAt)||0)});}
  remote.inventoryNotifications=[...map.values()];const states={...(local.inventoryNotificationState||{}),...(remote.inventoryNotificationState||{})};remote.inventoryNotificationState={};
  for(const [key,value] of Object.entries(states))if(value&&scopes.has(scope(value.owner,value.modulo)))remote.inventoryNotificationState[key]=value;
  return remote;
 }
 const api={observe,events,readAll,merge};root.LuroInventoryNotices=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
