'use strict';
// Preserve vertical scrolling: only a clearly horizontal rightward gesture opens nutrition.
let nutritionGesture=null;
document.addEventListener('pointerdown',e=>{
 const surface=e.target.closest('[data-swipe-nutrition]');
 if(!surface||e.target.closest('button')||!e.isPrimary)return;
 nutritionGesture={surface,x:e.clientX,y:e.clientY,id:e.pointerId};
});
document.addEventListener('pointerup',e=>{
 const g=nutritionGesture;nutritionGesture=null;
 if(!g||g.id!==e.pointerId)return;
 const dx=e.clientX-g.x,dy=e.clientY-g.y;
 if(dx>=60&&dx>Math.abs(dy)*1.5){openNutrition(g.surface.dataset.swipeNutrition,g.surface.dataset.swipeCustom==='true');}
});
document.addEventListener('pointercancel',()=>{nutritionGesture=null;});
document.addEventListener('dragstart',e=>{if(e.target.closest('[data-swipe-nutrition]'))e.preventDefault();});
document.addEventListener('keydown',e=>{
 const surface=e.target.closest('[data-swipe-nutrition]');
 if(surface&&e.target===surface&&e.key==='ArrowRight'){e.preventDefault();openNutrition(surface.dataset.swipeNutrition,surface.dataset.swipeCustom==='true');}
});
