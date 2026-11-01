"use strict";
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { randomBytes } = require('node:crypto');
const D = require('./menu-domain');
module.exports = function registerMenu({db, resolveSession, assertOwnerActive}) {
  const call = fn => onCall({cors: true}, async request => {
    try { return await fn(request); } catch (e) { if (e instanceof HttpsError) throw e; if (e instanceof D.MenuError) throw new HttpsError('failed-precondition', e.message); throw new HttpsError('internal', 'No se pudo completar la operación. Intenta de nuevo.'); }
  });
  function context(data) {
    const owner = D.key(data?.owner), module = D.text(data?.module, 80);
    if (!/^[a-z0-9_.@-]{1,100}$/.test(owner) || !module || /[\/\x00-\x1f]/.test(module)) throw new HttpsError('invalid-argument','Negocio o módulo inválido.');
    const ref = db.collection('datos_del_propietario').doc(owner);
    return {owner, module, ref, scope: D.hash(`${owner}\0${module}`)};
  }
  const unpack = snap => snap.data()?.db || snap.data()?.['base de datos'] || {};
  function token(data) { if (!/^[a-f0-9]{64}$/.test(data?.customerToken || '')) throw new HttpsError('unauthenticated','Sesión de cliente inválida.'); return D.hash(data.customerToken); }
  async function staff(request, adminOnly = false) {
    const c = await resolveSession(request, true); await assertOwnerActive(c.owner);
    if (adminOnly && !['admin','super-master'].includes(c.role)) throw new HttpsError('permission-denied','Solo el administrador puede configurar el menú.');
    if (c.collaborator) {
      const snap = await db.collection('autorizaciones').doc(`${c.owner}__${c.username}`).get();
      const person = snap.data() || {}, perms = person.permisos || [];
      const needed = ['accepted','rejected'].includes(request.data?.status) ? ['salida'] : ['salida','comandas'];
      if (!snap.exists || person.activo === false || !needed.some(p=>perms.includes(p))) throw new HttpsError('permission-denied','No tienes permisos de caja o cocina.');
    }
    return c;
  }
  const reserveRef = ctx => db.collection('menu_reservations').doc(ctx.scope);
  const tasksRef = ctx => db.collection('menu_tasks').doc(ctx.scope).collection('tasks');
  const membersRef = ctx => db.collection('menu_members').doc(ctx.scope).collection('members');
  const memberCode = id => 'LURO-' + id.slice(0,24).toUpperCase();
  const ordersRef = ctx => db.collection('menu_orders').doc(ctx.scope).collection('orders');
  function publicOrder(o) { return {id:o.id,date:new Date(o.createdAt).toISOString(),status:o.status,items:o.items,subtotal:o.subtotal,delivery:o.delivery,total:o.total,mesa:o.mesa || null,payment:o.payment,acceptedAt:o.acceptedAt || null,preparingAt:o.preparingAt || null,readyAt:o.readyAt || null,deliveredAt:o.deliveredAt || null,rejectionReason:o.rejectionReason || '',updatedAt:o.updatedAt}; }
  return {
    menuGetCatalog: call(async r => {
      const ctx = context(r.data); await assertOwnerActive(ctx.owner);
      const [snap,res] = await Promise.all([ctx.ref.get(),reserveRef(ctx).get()]);
      const menu = D.catalog(unpack(snap),ctx.owner,ctx.module,res.data()?.quantities || {});
      if (menu.heroPhrase === 'Pendiente por incluir') await db.runTransaction(async tx => {
        const ref = tasksRef(ctx).doc('hero-phrase'), existing = await tx.get(ref);
        if (!existing.exists || existing.data().status === 'completed') tx.set(ref,{id:'hero-phrase',type:'content',title:'Incluir frase de inicio',status:'pending',createdAt:Date.now()});
      });
      return menu;
    }),
    menuRegisterMember: call(async r => {
      const ctx=context(r.data), customerHash=token(r.data); await assertOwnerActive(ctx.owner);
      const name=D.text(r.data.name,80), cedula=D.text(r.data.cedula,30).replace(/\D/g,''), phone=D.text(r.data.phone,30).replace(/\D/g,'');
      if(name.length<2 || !/^\d{11}$/.test(cedula) || !/^\d{10,15}$/.test(phone)) throw new HttpsError('invalid-argument','Indica nombre, cédula de 11 dígitos y teléfono válido.');
      // One profile per opaque session. Identity alone never grants access to existing customer data.
      const accessToken=D.hash(`${r.data.customerToken}:${ctx.scope}:member`), memberRef=membersRef(ctx).doc(customerHash);
      return db.runTransaction(async tx => {
        const rr=reserveRef(ctx),[existing,bs,rs]=await Promise.all([tx.get(memberRef),tx.get(ctx.ref),tx.get(rr)]);
        D.catalog(unpack(bs),ctx.owner,ctx.module);
        if(!existing.exists){
          const now=Date.now(),state=rs.data()||{},minute=Math.floor(now/60000),count=state.memberMinute===minute?Number(state.memberCount)||0:0;
          if(count>=10)throw new HttpsError('resource-exhausted','Hay muchas solicitudes de membresía. Intenta en un minuto.');
          tx.set(rr,{...state,memberMinute:minute,memberCount:count+1});
          tx.set(memberRef,{name,cedula,phone,code:memberCode(customerHash),createdAt:now,customerId:null});
          tx.set(db.collection('menu_member_codes').doc(ctx.scope+'-'+memberCode(customerHash)),{memberId:customerHash});
          tx.set(tasksRef(ctx).doc('member-'+customerHash),{id:'member-'+customerHash,type:'membership',title:'Verificar nuevo miembro',memberId:customerHash,status:'pending',createdAt:now});
        }
        if(existing.exists&&!existing.data().code){tx.set(memberRef,{...existing.data(),code:memberCode(customerHash)});tx.set(db.collection('menu_member_codes').doc(ctx.scope+'-'+memberCode(customerHash)),{memberId:customerHash});}
        tx.set(db.collection('menu_customer_access').doc(D.hash(accessToken)),{owner:ctx.owner,module:ctx.module,memberId:customerHash,expiresAt:Date.now()+30*86400000});
        return {accessToken,expiresInDays:30,code:memberCode(customerHash),name:existing.exists?existing.data().name:name,phone:existing.exists?existing.data().phone:phone};
      });
    }),
    menuAssignMemberPackage: call(async r=>{
      const c=await staff(r,true),ctx=context({...r.data,owner:c.owner}),code=D.text(r.data.code,40).toUpperCase(),label=D.text(r.data.package,120);
      if(!/^LURO-[A-F0-9]{24}$/.test(code)||!label)throw new HttpsError('invalid-argument','Indica código y paquete.');
      return db.runTransaction(async tx=>{
        const cs=await tx.get(db.collection('menu_member_codes').doc(ctx.scope+'-'+code));
        if(!cs.exists)throw new HttpsError('not-found','Miembro no encontrado.');
        const ref=membersRef(ctx).doc(cs.data().memberId),ms=await tx.get(ref);
        if(!ms.exists||!ms.data().customerId)throw new HttpsError('failed-precondition','Verifica primero la identidad del miembro.');
        tx.set(ref,{...ms.data(),package:label,packageAssignedAt:Date.now()});return {ok:true};
      });
    }),
    menuListMembers: call(async r => {
      const c=await staff(r,true),ctx=context({...r.data,owner:c.owner});
      const snap=await membersRef(ctx).orderBy('createdAt','desc').limit(200).get();
      return {members:snap.docs.map(d=>{const m=d.data();return {name:m.name,cedula:m.cedula,phone:m.phone,code:m.code||'',package:m.package||'',verified:!!m.customerId,createdAt:m.createdAt};})};
    }),
    menuListTasks: call(async r => {
      const c=await staff(r,true),ctx=context({...r.data,owner:c.owner});
      const snap=await tasksRef(ctx).where('status','==','pending').limit(100).get();
      return {tasks:await Promise.all(snap.docs.map(async d=>{const t=d.data();if(t.memberId){const m=await membersRef(ctx).doc(t.memberId).get();t.member=m.data();}return t;}))};
    }),
    menuResolveTask: call(async r => {
      const c=await staff(r,true),ctx=context({...r.data,owner:c.owner}),id=D.text(r.data.id,90);
      if(!/^(hero-phrase|member-[a-f0-9]{64})$/.test(id))throw new HttpsError('invalid-argument','Tarea inválida.');
      return db.runTransaction(async tx=>{
        const ref=tasksRef(ctx).doc(id),[ts,bs]=await Promise.all([tx.get(ref),tx.get(ctx.ref)]);
        if(!ts.exists)throw new HttpsError('not-found','Tarea no encontrada.');
        const task=ts.data(),payload=unpack(bs);
        if(task.status==='completed')return {ok:true};
        if(task.type==='content' && !D.text(payload.menuIntegration?.[ctx.module]?.heroPhrase,200))throw new HttpsError('failed-precondition','Guarda primero la frase en Configuración.');
        if(task.type==='membership'){
          const mr=membersRef(ctx).doc(task.memberId),ms=await tx.get(mr);
          const customer=(payload.clientesFidelizacion||[]).find(x=>String(x.id)===String(r.data.customerId) && D.key(x.owner||ctx.owner)===ctx.owner);
          if(!customer || !ms.exists || String(customer.cedula||'').replace(/\D/g,'')!==ms.data().cedula)throw new HttpsError('failed-precondition','Registra o selecciona el cliente verificado en Clientes y puntos.');
          tx.set(mr,{...ms.data(),customerId:String(customer.id)});
        }
        tx.set(ref,{...task,status:'completed',completedAt:Date.now()});return {ok:true};
      });
    }),
    menuSubmitOrder: call(async r => {
      const ctx = context(r.data), customerHash = token(r.data); await assertOwnerActive(ctx.owner);
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(r.data.requestId || '')) throw new HttpsError('invalid-argument','Solicitud inválida.');
      const name = D.text(r.data.name,80), notes = D.text(r.data.notes,400);
      if (!name) throw new HttpsError('invalid-argument','Indica tu nombre.');
      const id = `WEB-${D.hash(`${customerHash}:${r.data.requestId}`).slice(0,28)}`, orderRef = ordersRef(ctx).doc(id), resRef = reserveRef(ctx);
      return db.runTransaction(async tx => {
        const [prev,snap,res] = await Promise.all([tx.get(orderRef),tx.get(ctx.ref),tx.get(resRef)]);
        if (prev.exists) return publicOrder(prev.data());
        let membership=null;
        const code=D.text(r.data.memberCode,40).toUpperCase();
        if(code){
          if(!/^LURO-[A-F0-9]{24}$/.test(code))throw new HttpsError('invalid-argument','Código de miembro inválido.');
          const cs=await tx.get(db.collection('menu_member_codes').doc(ctx.scope+'-'+code));
          if(!cs.exists)throw new HttpsError('not-found','Código de miembro no encontrado en este restaurante.');
          const ms=await tx.get(membersRef(ctx).doc(cs.data().memberId)),m=ms.data();
          if(!m)throw new HttpsError('not-found','Miembro no disponible.');
          const customer=(unpack(snap).clientesFidelizacion||[]).find(c=>String(c.id)===m.customerId&&D.key(c.owner||ctx.owner)===ctx.owner);
          membership={code,verified:!!customer,active:customer?.premiumActivo===true,customerId:customer?String(customer.id):null};
        }
        const state = res.data() || {}, quantities = state.quantities || {};
        const minute = Math.floor(Date.now()/60000);
        const count = state.minute === minute ? Number(state.count || 0) : 0;
        if (count >= 60 || Object.values(state.pending || {}).reduce((s,n)=>s+Number(n),0) >= 200) throw new HttpsError('resource-exhausted','Caja tiene muchas solicitudes. Intenta en un momento.');
        if (Number(state.pending?.[customerHash] || 0) >= 3) throw new HttpsError('resource-exhausted','Ya tienes tres pedidos pendientes de caja.');
        const menu = D.catalog(unpack(snap),ctx.owner,ctx.module,quantities), q = D.quote(menu,r.data.items);
        for (const i of q.items) quantities[i.id] = (Number(quantities[i.id]) || 0) + i.quantity;
        const pending = state.pending || {}; pending[customerHash] = (Number(pending[customerHash]) || 0) + 1;
        const now = Date.now(), order = {id,...q,owner:ctx.owner,module:ctx.module,customerHash,customer:{name,membership},notes,status:'pending',payment:{status:'pending',method:'Caja'},createdAt:now,updatedAt:now};
        tx.set(orderRef,order); tx.set(resRef,{quantities,pending,minute,count:count+1}); return publicOrder(order);
      });
    }),
    menuGetOrders: call(async r => {
      const ctx = context(r.data), customerHash = token(r.data); await assertOwnerActive(ctx.owner);
      // Equality-only query avoids requiring a composite Firestore index.
      const snap = await ordersRef(ctx).where('customerHash','==',customerHash).limit(100).get();
      return {orders:snap.docs.map(d=>publicOrder(d.data())).sort((a,b)=>b.updatedAt-a.updatedAt)};
    }),
    menuListOrders: call(async r => {
      const c = await staff(r),ctx=context({...r.data,owner:c.owner});
      const snap=await ordersRef(ctx).orderBy('createdAt','desc').limit(100).get();
      return {orders:snap.docs.map(d=>({...publicOrder(d.data()),customer:d.data().customer,notes:d.data().notes}))};
    }),
    menuUpdateOrder: call(async r => {
      const c=await staff(r),ctx=context({...r.data,owner:c.owner}),id=D.text(r.data.id,80),next=D.text(r.data.status,30);
      if (!/^WEB-[a-f0-9]{28}$/.test(id)) throw new HttpsError('invalid-argument','Pedido inválido.');
      return db.runTransaction(async tx=>{
        const orderRef=ordersRef(ctx).doc(id),rr=reserveRef(ctx);
        const [os,bs,rs]=await Promise.all([tx.get(orderRef),tx.get(ctx.ref),tx.get(rr)]);
        if(!os.exists) throw new HttpsError('not-found','Pedido no encontrado.');
        const order=os.data(),payload=unpack(bs),state=rs.data()||{},quantities=state.quantities||{},pending=state.pending||{},now=Date.now();
        if(order.status===next)return publicOrder(order);
        if(!D.canTransition(order.status,next))throw new HttpsError('failed-precondition','Transición de pedido inválida.');
        if(next==='accepted'){
          const menu=D.catalog(payload,ctx.owner,ctx.module,{});
          if(order.items.some(i=>!menu.items.some(p=>p.id===i.id && p.stock>=Math.max(i.quantity,Number(quantities[i.id])||0))))throw new HttpsError('failed-precondition','Revisa las existencias antes de aceptar.');
          payload.mesasEstado ||= {}; const tables=payload.mesasEstado.carritoPorMesa ||= {},meta=payload.mesasEstado.mesaMeta ||= {},unions=payload.mesasEstado.mesaUniones||{};
          const mesa=Array.from({length:20},(_,i)=>`Mesa ${i+1}`).find(m=>!(tables[m]||[]).length&&!meta[m]?.reservaNombre&&!unions[m]&&!(payload.comandasActivas||[]).some(x=>x.mesa===m));
          if(!mesa)throw new HttpsError('resource-exhausted','No hay mesas libres. Libera una mesa antes de aceptar.');
          const personaId=`web-${id}`;
          tables[mesa]=order.items.map(i=>({nombre:i.name,precio:i.unitPrice,cantidad:i.quantity,originalIndex:(payload.platos||[]).findIndex(p=>D.dishId(p)===i.id),personaId,personaNombre:order.customer.name,memberCode:order.customer.membership?.code||'',menuOrderId:id,menuItemId:i.id,menuNotes:i.notes}));
          meta[mesa]={inicioUso:now,reservaNombre:'',reservaHora:'',menuOrderId:id};
          payload.mesaCuentas ||= {};payload.mesaCuentas[mesa]={personas:[{id:personaId,nombre:order.customer.name,pagada:false,metodoPago:''}]};
          payload.menuOrderReceipts ||= {};payload.menuOrderReceipts[id]={mesa,module:ctx.module,acceptedAt:now};
          payload.comandasActivas ||= [];payload.comandasActivas.push({id:`CMD-${ctx.owner}-${ctx.module}-${mesa}`,menuOrderId:id,mesa,owner:ctx.owner,modulo:ctx.module,createdAt:now,items:order.items.map(i=>({nombre:i.name,cantidad:i.quantity,notes:i.notes})),notes:order.notes});
          order.mesa=mesa;order.acceptedAt=now;
          tx.set(ctx.ref,{db:payload,'base de datos':payload,updatedAtClient:now,syncKey:`menu-${id}-${now}`,updatedFrom:'menu-order'},{merge:true});
        }
        if(next==='rejected'){
          order.rejectionReason=D.text(r.data.reason || 'Caja no pudo aceptar el pedido.',240);D.release(quantities,order);
        }
        if(order.status==='pending')pending[order.customerHash]=Math.max(0,(Number(pending[order.customerHash])||0)-1);
        if(next==='preparing')order.preparingAt=now;
        if(next==='ready'){
          order.readyAt=now;payload.comandasActivas ||= [];payload.comandasHistorial ||= [];
          const com=payload.comandasActivas.find(x=>x.menuOrderId===id);
          if(com){payload.comandasActivas=payload.comandasActivas.filter(x=>x.menuOrderId!==id);payload.comandasHistorial.push({...com,doneAt:now});}
          tx.set(ctx.ref,{db:payload,'base de datos':payload,updatedAtClient:now,syncKey:`menu-ready-${id}-${now}`,updatedFrom:'menu-ready'},{merge:true});
        }
        if(next==='delivered')order.deliveredAt=now;
        order.status=next;order.updatedAt=now;tx.set(orderRef,order);tx.set(rr,{...state,quantities,pending});return publicOrder(order);
      });
    }),
    menuCreateCustomerLink: call(async r=>{
      const c=await staff(r,true),ctx=context({...r.data,owner:c.owner}),snap=await ctx.ref.get(),payload=unpack(snap);
      const customer=(payload.clientesFidelizacion||[]).find(x=>String(x.id)===String(r.data.customerId)&&D.key(x.owner||ctx.owner)===ctx.owner);
      if(!customer)throw new HttpsError('not-found','Cliente no encontrado.');
      const accessToken=randomBytes(32).toString('hex');
      await db.collection('menu_customer_access').doc(D.hash(accessToken)).set({owner:ctx.owner,customerId:String(customer.id),expiresAt:Date.now()+30*86400000});
      return {accessToken,expiresInDays:30};
    }),
    menuGetProfile: call(async r=>{
      const ctx=context(r.data);if(!/^[a-f0-9]{64}$/.test(r.data.accessToken||''))throw new HttpsError('unauthenticated','Solicita tu enlace privado en caja.');
      const access=await db.collection('menu_customer_access').doc(D.hash(r.data.accessToken)).get(),a=access.data();
      if(!a||a.owner!==ctx.owner||a.expiresAt<Date.now())throw new HttpsError('permission-denied','Enlace vencido o inválido. Solicita otro en caja.');
      await assertOwnerActive(ctx.owner);const payload=unpack(await ctx.ref.get());
      let customerId=a.customerId,card={};
      if(a.memberId){
        if(a.module!==ctx.module)throw new HttpsError('permission-denied','Enlace de otro módulo.');
        const ms=await membersRef(ctx).doc(a.memberId).get(),member=ms.data();
        if(!member)throw new HttpsError('not-found','Perfil no disponible.');
        if(!member.customerId)return {code:member.code||'',package:member.package||'',phone:member.phone,name:member.name,points:0,premiumActive:false,history:[],verificationPending:true};
        customerId=member.customerId;card={code:member.code||'',package:member.package||'',phone:member.phone};
      }
      const customer=(payload.clientesFidelizacion||[]).find(x=>String(x.id)===customerId && D.key(x.owner||ctx.owner)===ctx.owner);
      if(!customer)throw new HttpsError('not-found','Cliente no disponible.');
      // Only the linked customer's fields. No identity documents, phone, credentials or bank information.
      const identity = String(customer.cedula || '').replace(/\D/g,'');
      const history = (payload.facturasResumen||[]).filter(x => D.key(x.owner)===ctx.owner && x.modulo===ctx.module && identity.length >= 9 && String(x.rnc).replace(/\D/g,'')===identity).slice(-30).map(x=>({date:D.text(x.fecha,80),detail:'Compra registrada',total:Number(x.total)||0}));
      return {...card,name:D.text(customer.nombre),points:Number(customer.puntos)||0,premiumActive:customer.premiumActivo===true,history};
    })
  };
};
