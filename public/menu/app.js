'use strict';

const icons = {
  bag: '<path d="M6 7h12l2 14H4L6 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  menu: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 2-5 9 0 10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.menu}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => `RD$ ${value.toLocaleString('es-DO', {maximumFractionDigits: 2})}`;
const photo = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=700&q=85`;
const MENU = [
  {id:'yaroa',name:'Yaroa Especial “The Proyect”',category:'fast_food',badge:'🔥 Top ventas',price:350,rating:'4.9',image:photo('photo-1585109649139-366815a0d713'),description:'Papas o maduro, carne sazonada, abundante queso gratinado y las salsas de la casa.',groups:[{name:'Tipo de base',options:[['Papas fritas',0],['Plátano maduro',40]]},{name:'Tamaño',options:[['Pequeña',0,.85],['Mediana',0,1],['Grande',0,1.35]],selected:1},{name:'Acompañante extra',multiple:true,options:[['Papas de freír con carne de res',180]]}]},
  {id:'pancakes',name:'Pancake Tradicional',category:'desayunos',badge:'♡ Favorito',price:260,rating:'4.8',image:photo('photo-1567620905732-2d1ec7ab7445'),description:'Esponjosos, dorados a la mantequilla y servidos con sirope de arce y blueberries.',groups:[{name:'Tamaño y porción',options:[['Regular · 3 piezas',0],['Jumbo · 5 piezas',130]]}]},
  {id:'chimi',name:'Chimi de Calle Premium',category:'fast_food',badge:'✦ Sabor de la calle',price:220,rating:'4.7',image:photo('photo-1568901346375-23c9450c58cd'),description:'Pan de agua crujiente, carne al estilo dominicano, repollo fresco y nuestra salsa rosa.',groups:[{name:'Selección de carne',options:[['Carne de res',0],['Carne de cerdo',0],['Mixto · Res + cerdo',50]]}]},
  {id:'langosta',name:'Langosta en Mantequilla',category:'gourmet',badge:'✧ Selección gourmet',price:1450,rating:'5.0',image:photo('photo-1553240799-36bbf332a5c3'),description:'Cola de langosta con mantequilla de ajo, perejil, romero y un delicado toque cítrico.'},
  {id:'hamburguesa',name:'Hamburguesa Clásica',category:'fast_food',badge:'★ Recomendado',price:380,rating:'4.8',image:photo('photo-1550547660-d9450f859349'),description:'Res Angus, cheddar derretido, vegetales frescos y pepinillos en un suave pan brioche.',groups:[{name:'Dale tu toque',multiple:true,options:[['Extra queso cheddar',60],['Tocineta crujiente',80]]}]},
  {id:'alitas',name:'Alitas Crujientes',category:'compartir',badge:'☺ Para compartir',price:420,rating:'4.9',image:photo('photo-1567620832903-9fc6debc209f'),description:'Doradas y crujientes, bañadas en tu salsa favorita. Con aderezo ranch o queso azul.',groups:[{name:'Porción',options:[['8 piezas',0],['12 piezas',190]]},{name:'Salsa preferida',options:[['BBQ ahumada',0],['Búfalo picante',0],['Honey mustard',0]]}]},
  {id:'cordero',name:'Cordero de la Casa',category:'gourmet',badge:'✦ Especialidad',price:980,rating:'4.9',image:photo('photo-1544025162-d76694265947'),description:'Cordero estofado lentamente en vino tinto, romero y especias. Con puré trufado.'}
];
// Consistent illustrative photography from the existing AI reference sheets.
MENU.forEach(item => {item.image = `assets/menu-photos/${item.id}.svg`;});
const CATEGORIES = [['todos','✦','Todos'],['fast_food','♨','Fast Food'],['gourmet','✧','Gourmet'],['desayunos','☀','Desayunos'],['compartir','☺','Para compartir']];
