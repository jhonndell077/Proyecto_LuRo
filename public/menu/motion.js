'use strict';
(()=>{
 const root=document.documentElement;
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const progress=document.createElement('div');progress.className='motion-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
 const hero=document.querySelector('.hero');
 const specks=document.createElement('div');specks.className='ambient-specks';specks.setAttribute('aria-hidden','true');
 for(let i=0;i<12;i++){const dot=document.createElement('span');dot.style.setProperty('--spark-duration',(8+i%4*1.7)+'s');dot.style.left=(4+i*8)+'%';dot.style.animationDelay=-(i*1.3)+'s';specks.append(dot);}hero.append(specks);
 const observed=new WeakSet();
 const enabled=()=>!preference.matches;
 const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const el=entry.target;observer.unobserve(el);if(enabled())el.classList.add('motion-enter');}},{threshold:.08}):null;
 function watch(){if(!observer)return;document.querySelectorAll('.hero-content,.hero-photo,.business-story>div,.section-heading,.card,.experience-columns article,.business-experience>h2,.service-strip').forEach((el,i)=>{if(observed.has(el))return;observed.add(el);el.style.setProperty('--motion-delay',`${Math.min(i%3*75,150)}ms`);observer.observe(el);});}
 function sync(){root.classList.toggle('motion-paused',!enabled());if(!enabled())document.querySelectorAll('.motion-enter').forEach(el=>el.classList.remove('motion-enter'));}
 preference.addEventListener('change',sync);
 let pending=false;function update(){const d=document.documentElement;const max=d.scrollHeight-d.clientHeight;root.style.setProperty('--reading-progress',max>0?String(Math.min(1,Math.max(0,d.scrollTop/max))):'0');pending=false;}
 window.addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});window.addEventListener('resize',update);
 const menu=document.getElementById('menu');if(menu)new MutationObserver(()=>{watch();update();}).observe(menu,{childList:true});
 sync();watch();update();
})();
