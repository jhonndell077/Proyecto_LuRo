'use strict';
(()=>{
 const tools=document.createElement('div');tools.className='quick-tools';tools.innerHTML='<button type="button" id="quick-help">Ayúdame a elegir ↗</button><button type="button" class="clear-search" id="clear-menu-search" hidden>Limpiar búsqueda ✕</button>';
 document.querySelector('.section-heading').after(tools);
 document.getElementById('quick-help').addEventListener('click',()=>openLafo());
 const search=document.getElementById('search'),clear=document.getElementById('clear-menu-search');
 search.addEventListener('input',()=>{clear.hidden=!search.value;});clear.addEventListener('click',()=>{search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));clear.hidden=true;search.focus();});
 const top=document.createElement('button');top.type='button';top.className='back-top';top.textContent='↑';top.setAttribute('aria-label','Volver al inicio');top.hidden=true;document.body.append(top);top.addEventListener('click',()=>{if(view!=='menu')setView('menu');document.getElementById('hero').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 window.addEventListener('scroll',()=>{top.hidden=window.scrollY<650;},{passive:true});
 const links=[...document.querySelectorAll('.website-nav a')];if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting);if(!visible.length)return;const id=visible[0].target.id;links.forEach(a=>{if(a.hash==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});},{rootMargin:'-10% 0px -60% 0px'});for(const id of ['hero','nosotros','menu-section','experiencia'])observer.observe(document.getElementById(id));}
})();
