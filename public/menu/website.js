'use strict';
document.querySelectorAll('.website-nav a,.story-link,.hero-link').forEach(link=>link.addEventListener('click',()=>{if(view!=='menu')setView('menu');}));
