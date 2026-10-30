"use strict";
const D = require('./menu-domain');
// Called inside the existing owner sync transaction, after reads and before writes.
module.exports = async function syncMenuPayments(db, tx, payload, owner) {
  const receipts = payload.menuOrderReceipts || {};
  const sales = (payload.ventas || []).filter(v => v.menuOrderId && receipts[v.menuOrderId] && !receipts[v.menuOrderId].paidAt && D.key(v.owner) === owner);
  const ids = [...new Set(sales.map(v => v.menuOrderId))].filter(id => /^WEB-[a-f0-9]{28}$/.test(id));
  const refs = ids.map(id => ({id,scope:D.hash(`${owner}\0${receipts[id].module}`)}));
  const snapshots = await Promise.all(refs.map(x=>tx.get(db.collection('menu_orders').doc(x.scope).collection('orders').doc(x.id))));
  for (const snap of snapshots) if (snap.exists && snap.data().payment?.status === 'paid') receipts[snap.data().id].paidAt = snap.data().payment.paidAt || Date.now();
  const payable = snapshots.filter(s=>s.exists && s.data().payment?.status!=='paid' && !['pending','rejected'].includes(s.data().status));
  const scopes = [...new Set(payable.map(s=>D.hash(`${owner}\0${s.data().module}`)))];
  const reserves = await Promise.all(scopes.map(scope=>tx.get(db.collection('menu_reservations').doc(scope))));
  const states = Object.fromEntries(scopes.map((scope,i)=>[scope,reserves[i].data() || {quantities:{},pending:{}}]));
  for(const snap of payable){
    const order=snap.data();
    const matches=order.items.every(i=>sales.filter(v=>v.menuOrderId===order.id&&v.plato===i.name).reduce((sum,v)=>sum+Number(v.cantidad||0),0)>=i.quantity);
    if(!matches)continue; // partial payments keep the reservation until the full order is recorded.
    const scope=D.hash(`${owner}\0${order.module}`);D.release(states[scope].quantities,order);
    receipts[order.id].paidAt = Date.now();
    tx.update(snap.ref,{payment:{status:'paid',method:'Caja LuRo',paidAt:Date.now()},updatedAt:Date.now()});
  }
  for(const scope of scopes)tx.set(db.collection('menu_reservations').doc(scope),states[scope]);
};
