'use strict';
// DC2.5: los favoritos y el carrito son acciones independientes.
const discovery=$('dish-discovery');
const dishGroup=(duplicate=false)=>`<div class="dish-group" ${duplicate?'aria-hidden="true"':''}>${MENU.map(x=>`<button class="discovery-dish" data-order="${x.id}" ${duplicate?'tabindex="-1"':''}><img src="${x.image}" alt="" loading="lazy"><span><small>${escapeHtml(x.badge)}</small><strong>${escapeHtml(x.name)}</strong><em>${money(x.price)} <span>↗</span></em></span></button>`).join('')}</div>`;
$('dish-track').innerHTML=dishGroup()+dishGroup(true);
// Duplicados decorativos sin foco; al detener el movimiento se muestran los originales.
let discoveryPaused=false;
$('pause-discovery').addEventListener('click',()=>{discoveryPaused=!discoveryPaused;discovery.classList.toggle('is-paused',discoveryPaused);$('pause-discovery').setAttribute('aria-pressed',String(discoveryPaused));$('pause-discovery').setAttribute('aria-label',discoveryPaused?'Reanudar carrusel':'Pausar carrusel');$('pause-discovery').textContent=discoveryPaused?'▶':'Ⅱ';});
function refreshNavigation(){
 const cartOpen=$('cart-dialog').open;
 document.querySelectorAll('.bottom-nav button').forEach(b=>{const active=cartOpen?b.id==='nav-cart':b.dataset.view===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
const priorView=setView;setView=function(next){priorView(next);discovery.hidden=view!=='menu';refreshNavigation();const area=(view==='menu'||view==='favorites')?$('menu'):$('secondary');area.classList.remove('module-enter');void area.offsetWidth;area.classList.add('module-enter');};
const priorCart=openCart;openCart=function(){priorCart();refreshNavigation();};
$('cart-dialog').addEventListener('close',refreshNavigation);
refreshNavigation();
