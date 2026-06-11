/* -------------------------------------------------------
   KITCHEN HOUSE - admin.js  (v2 - corrected)
------------------------------------------------------- */

/* --------------------------------------------
   DEFAULT DATA
-------------------------------------------- */
const DEFAULTS = {
  credentials: { user: 'admin', pass: 'velvet2024' },
  general: {
    name: 'VELVET', tagline: 'RESTAURANT & LOUNGE',
    slogan: 'El Mejor Ambiente Premium de Santo Domingo Este',
    phone: '+1 (809) 555-0000', whatsapp: '18095550000',
    email: 'info@velvetrd.com',
    address: 'Av. San Vicente de Paúl esq. Calle Las Mercedes, Santo Domingo Este',
    mapslink: 'https://maps.google.com/?q=Santo+Domingo+Este',
    mapembed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d60659.81295396764!2d-69.84773!3d18.47977!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8eaf89aecacfaf95%3A0x657fafce23c2bc9b!2sSanto%20Domingo%20Este%2C%20Dominican%20Republic!5e0!3m2!1sen!2s!4v1703000000000',
    rating: '4.5?', reviews: '1,265+', satisfaction: '95%'
  },
  hero: {
    badge: 'Santo Domingo Este · Desde 2018',
    title1: 'El Mejor Ambiente', title2: 'Premium', title3: 'de Santo Domingo Este',
    subtitle: 'Experiencias gastronómicas, música en vivo, coctelería exclusiva y entretenimiento de primer nivel.',
    btn1: 'Reservar Mesa', btn2: 'Ver Menú'
  },
  hours: [
    { days: 'Lunes – Jueves', open: '12:00 PM', close: '12:00 AM' },
    { days: 'Viernes – Sábado', open: '12:00 PM', close: '3:00 AM' },
    { days: 'Domingo', open: '12:00 PM', close: '11:00 PM' }
  ],
  closedMsg: 'Actualmente cerrado · Abrimos pronto',
  social: {
    instagram: '#', facebook: '#', tiktok: '#', youtube: '#',
    wa_msg: 'Hola, quisiera hacer una reservación en Velvet',
    wa_tooltip: '¡Reserva ahora por WhatsApp!'
  },
  colors: { gold: '#c9a84c', green: '#5db87a', dark: '#0a0a0b', rose: '#d4607a' },
  menu: {
    food: [
      { name: 'Churrasco Premium',  desc: 'Corte wagyu en salsa chimichurri con papas rústicas', price: 'RD$ 1,850' },
      { name: 'Langosta al Grill',  desc: 'Langosta fresca con mantequilla de hierbas y limón',  price: 'RD$ 2,400' },
      { name: 'Tabla de Antipastos',desc: 'Selección de quesos importados, embutidos y aceitunas', price: 'RD$ 1,200' },
      { name: 'Filete Mignon',       desc: 'Término a elección con salsa de trufas y vegetales',   price: 'RD$ 2,100' },
      { name: 'Camarones al Ajillo', desc: 'Camarones jumbo en mantequilla de ajo y vino blanco',   price: 'RD$ 1,650' },
      { name: 'Ceviche Marino',      desc: 'Mezcla de mariscos frescos en leche de tigre',            price: 'RD$ 980'   }
    ],
    cocktails: [
      { name: 'Velvet Sour',    desc: 'Whisky bourbon, limón fresco, clara de huevo y amaro', price: 'RD$ 650' },
      { name: 'Green Garden',   desc: 'Gin premium, pepino, albahaca, tónica y limón',   price: 'RD$ 580' },
      { name: 'Negroni Classico',desc: 'Gin, Campari y Vermut Rosso con cáscara de naranja',  price: 'RD$ 620' },
      { name: 'Passion Mule',   desc: 'Vodka, maracuyá, jengibre, lima y ginger beer',        price: 'RD$ 550' },
      { name: 'Old Fashioned',  desc: 'Bourbon premium, bitter, azúcar morena y naranja',     price: 'RD$ 700' },
      { name: 'Mezcal Sunset',  desc: 'Mezcal artesanal, jugo de toronja y sal de gusano',         price: 'RD$ 680' }
    ],
    wines: [
      { name: 'Malbec Reserva',      desc: 'Argentina · Mendoza · Notas de ciruela y chocolate',      price: 'RD$ 2,800 / botella' },
      { name: 'Chardonnay Grand Cru',desc: 'Francia · Borgoña · Notas de mantequilla y vainilla', price: 'RD$ 3,500 / botella' },
      { name: 'Rioja Crianza',       desc: 'España · La Rioja · Tempranillo envejecido en roble', price: 'RD$ 2,200 / botella' },
      { name: 'Prosecco DOC',        desc: 'Italia · Véneto · Burbujas finas y notas de melocotón', price: 'RD$ 1,800 / botella' }
    ],
    beers: [
      { name: 'Presidente Premium', desc: 'Lager · República Dominicana · Fresca y suave', price: 'RD$ 220' },
      { name: 'Corona Extra',       desc: 'Lager · México · Con limón premium',        price: 'RD$ 280' },
      { name: 'Stella Artois',      desc: 'Lager · Bélgica · Elegante y refrescante',       price: 'RD$ 320' },
      { name: 'Craft IPA Local',    desc: 'IPA Artesanal · Santo Domingo · Lúpulo tropical', price: 'RD$ 380' }
    ]
  },
  services: [
    { icon: '\uD83C\uDF7D', name: 'Restaurante',      desc: 'Gastronom\u00eda premium con ingredientes frescos y chefs especializados.',  link: '#menu',         linkText: 'Ver Men\u00fa \u2192' },
    { icon: '\uD83C\uDF77', name: 'Wine Bar',         desc: 'M\u00e1s de 50 etiquetas cuidadosamente seleccionadas de todo el mundo.',    link: '#menu',         linkText: 'Carta de Vinos \u2192' },
    { icon: '\uD83C\uDF78', name: 'Cocktails Lounge', desc: 'Mixolog\u00eda artesanal con destilados premium e ingredientes frescos.',    link: '#menu',         linkText: 'Ver Carta \u2192' },
    { icon: '\uD83C\uDFB5', name: 'M\u00fasica en Vivo',   desc: 'Artistas nacionales e internacionales todos los fines de semana.',      link: '#reservations', linkText: 'Ver Agenda \u2192' },
    { icon: '\uD83C\uDFC6', name: 'Deportes',         desc: 'Pantallas gigantes 4K para los mejores eventos deportivos en vivo.',    link: '#',             linkText: 'Pr\u00f3ximos Eventos \u2192' },
    { icon: '\uD83C\uDF89', name: 'Eventos Privados', desc: 'Celebraciones corporativas, cumplea\u00f1os y reuniones exclusivas.',         link: '#reservations', linkText: 'Cotizar \u2192' },
    { icon: '\uD83D\uDC83', name: '\u00c1rea de Baile',    desc: 'Pista de baile con el mejor DJ y m\u00fasica seleccionada.',                 link: '#reservations', linkText: 'Reservar \u2192' },
    { icon: '\uD83D\uDE97', name: 'Valet Parking',    desc: 'Servicio de valet parking gratuito con amplio espacio disponible.',     link: '#location',     linkText: 'Ver Ubicaci\u00f3n \u2192' },
    { icon: '\uD83C\uDF3F', name: 'Terraza Exterior', desc: '\u00c1rea al aire libre con decoraci\u00f3n natural y ambiente relajado.',        link: '#gallery',      linkText: 'Ver Fotos \u2192' }
  ],
  testimonials: [
    { name: 'Mar\u00eda Gonz\u00e1lez', rating: '\u2B50\u2B50\u2B50\u2B50\u2B50', text: 'Excelente ambiente y servicios, muy atentas las chicas y muy hermoso el lugar. Sin duda el mejor sitio para salir en Santo Domingo Este.', date: 'Hace 2 d\u00edas' },
    { name: 'Carlos Mart\u00ednez',     rating: '\u2B50\u2B50\u2B50\u2B50\u2B50', text: 'Lo mejor de Santo Domingo Este. El ambiente es inigualable, la m\u00fasica en vivo es incre\u00edble y los c\u00f3cteles son de otro nivel.', date: 'Hace 1 semana' },
    { name: 'Paola Jim\u00e9nez',       rating: '\u2B50\u2B50\u2B50\u2B50\u2B50', text: 'Excelente lugar para compartir con amistades. Vinimos para una celebraci\u00f3n de cumplea\u00f1os y la atenci\u00f3n fue espectacular.', date: 'Hace 2 semanas' },
    { name: 'Roberto P\u00e9rez',       rating: '\u2B50\u2B50\u2B50\u2B50\u2B50', text: 'Ambiente exclusivo y trato excepcional. Los platos son exquisitos y los c\u00f3cteles artesanales son de los mejores que he probado en RD.', date: 'Hace 3 semanas' },
    { name: 'Ana Rodr\u00edguez',       rating: '\u2B50\u2B50\u2B50\u2B50\u2B50', text: 'Uno de mis lugares favoritos en Santo Domingo Este. La terraza es bell\u00edsima y la decoraci\u00f3n con las plantas y las luces crea un ambiente m\u00e1gico.', date: 'Hace 1 mes' },
    { name: 'Miguel Santos',            rating: '\u2B50\u2B50\u2B50\u2B50\u2B50', text: '\u00a1Excelente comida, servicio y ambiente! Lo mejor es que siempre hay algo nuevo: m\u00fasica en vivo, eventos especiales.', date: 'Hace 1 mes' }
  ],
  gallery: [
    { cat: 'Ambiente',        title: 'Lounge Principal' },
    { cat: 'Cócteles',   title: 'Mixología Premium' },
    { cat: 'Gastronomía',title: 'Churrasco Signature' },
    { cat: 'Terraza',         title: 'Espacio Exterior Premium' },
    { cat: 'Música en Vivo', title: 'Noches Especiales' },
    { cat: 'Eventos',         title: 'Celebraciones Privadas' },
    { cat: 'Wine Bar',        title: 'Selección de Vinos' },
    { cat: 'Lounge',          title: 'Área VIP' }
  ]
};

/* --------------------------------------------
   STATE (module-level, initialized in initDOM)
-------------------------------------------- */
let currentMenuTab = 'food';
let $loginScreen, $adminPanel;

/* --------------------------------------------
   STORAGE HELPERS
-------------------------------------------- */
function cfgLoad(key, fallback) {
  try {
    const v = localStorage.getItem('velvet_' + key);
    return v ? JSON.parse(v) : JSON.parse(JSON.stringify(fallback));
  } catch (e) {
    return JSON.parse(JSON.stringify(fallback));
  }
}
function cfgSave(key, value) {
  localStorage.setItem('velvet_' + key, JSON.stringify(value));
}

function notifyParentCloudStatus(text, color, state) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'velvet_cloud_status',
        text: text,
        color: color,
        state: state || ''
      }, '*');
    }
  } catch (e) {}
}

function handleExternalSaveRequest(event) {
  var allowedOrigins = [
    'https://luro-control.web.app',
    window.location.origin
  ];
  if (event && event.origin && allowedOrigins.indexOf(event.origin) === -1) return;
  if (!event || !event.data || event.data.type !== 'velvet_save_all') return;
  runGlobalSaveFlow();
}

function deriveHeroTitlesFromSlogan(slogan) {
  var raw = String(slogan || '').trim();
  if (!raw) return null;

  var premiumMatch = raw.match(/premium/i);
  if (premiumMatch) {
    var idx = premiumMatch.index || 0;
    var word = raw.slice(idx, idx + premiumMatch[0].length);
    var before = raw.slice(0, idx).trim();
    var after = raw.slice(idx + premiumMatch[0].length).trim();
    return {
      title1: before || DEFAULTS.hero.title1,
      title2: word || DEFAULTS.hero.title2,
      title3: after || DEFAULTS.hero.title3
    };
  }

  var words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return {
      title1: words[0] || DEFAULTS.hero.title1,
      title2: words[1] || '',
      title3: ''
    };
  }

  var pivot = Math.ceil(words.length / 2);
  return {
    title1: words.slice(0, pivot - 1).join(' ') || DEFAULTS.hero.title1,
    title2: words[pivot - 1] || DEFAULTS.hero.title2,
    title3: words.slice(pivot).join(' ')
  };
}

function syncHeroTitlesFromGeneralSlogan() {
  var derived = deriveHeroTitlesFromSlogan(getVal('g_slogan'));
  if (!derived) return;

  var heroData = cfgLoad('hero', DEFAULTS.hero);
  heroData.title1 = derived.title1;
  heroData.title2 = derived.title2;
  heroData.title3 = derived.title3;
  cfgSave('hero', heroData);

  setVal('h_title1', heroData.title1);
  setVal('h_title2', heroData.title2);
  setVal('h_title3', heroData.title3);
}

/* --------------------------------------------
   SINCRONIZACIÓN EN LA NUBE (Firebase RTDB)
   Publica TODOS los cambios a lafocacheria.web.app
-------------------------------------------- */
var RTDB = 'https://lafocacheria-default-rtdb.firebaseio.com/velvet';

function syncToCloud() {
  /* Recopila TODA la config de localStorage */
  var keys = ['general','hero','menu','services','testimonials',
              'hours','social','gallery','colors','closedMsg','amenities',
              'experience','whyus'];
  var allConfig = {};
  keys.forEach(function(key) {
    var v = localStorage.getItem('velvet_' + key);
    if (v) { try { allConfig[key] = JSON.parse(v); } catch(e) {} }
  });

  /* Imágenes de galería (base64) */
  var galleryImgs = {};
  for (var i = 0; i < 12; i++) {
    var img = localStorage.getItem('velvet_gallery_img_' + i);
    if (img) galleryImgs[i] = img;
  }
  if (Object.keys(galleryImgs).length) allConfig._gallery_imgs = galleryImgs;

  /* Timestamp para que el sitio detecte el cambio */
  allConfig._updated = Date.now();

  var statusEl = document.getElementById('cloudStatus');
  var saveBtn  = document.getElementById('globalSave');
  if (statusEl) { statusEl.textContent = '\u23F3 Publicando...'; statusEl.style.color = '#f0c040'; }
  notifyParentCloudStatus('\u23F3 Publicando...', '#f0c040', 'publishing');

  fetch(RTDB + '.json?ts=' + Date.now(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(allConfig)
  })
  .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
  .then(function() {
    /* ? Éxito: feedback visual */
    if (statusEl) { statusEl.textContent = '\u2705 Sitio actualizado'; statusEl.style.color = '#A1DFCB'; }
    if (saveBtn) {
      saveBtn.textContent = '\u2705 Publicado';
      saveBtn.style.background = '#A1DFCB';
      saveBtn.style.color = '#0a0a0b';
      setTimeout(function() {
        saveBtn.textContent = '\uD83D\uDCBE Guardar Cambios';
        saveBtn.style.background = '';
        saveBtn.style.color = '';
        if (statusEl) { statusEl.textContent = '\u2601\uFE0F En l\u00ednea'; statusEl.style.color = '#A1DFCB'; }
      }, 3000);
    }
    showToast('\u2705 Cambios en vivo en lafocacheria.web.app');
  })
  .catch(function(err) {
    console.warn('Cloud sync error:', err);
    if (statusEl) { statusEl.textContent = '\u26A0\uFE0F Sin conexi\u00f3n'; statusEl.style.color = '#f08060'; }
    if (saveBtn) { saveBtn.textContent = '\uD83D\uDCBE Guardar Cambios'; saveBtn.style.background = ''; saveBtn.style.color = ''; }
    showToast('\u274C Error al publicar. Revisa la conexi\u00f3n.', true);
  });
}
window.syncToCloud = syncToCloud;

/* --------------------------------------------
   SHOW / HIDE ADMIN
-------------------------------------------- */
function showAdmin() {
  $loginScreen.style.display = 'none';
  $adminPanel.style.display  = 'flex';
  initAdmin();
}

/* --------------------------------------------
   INIT ADMIN PANEL
-------------------------------------------- */
function initAdmin() {
  loadSectionData();
  updateDashboardCounts();
  renderMenuEditor();
  renderServicesEditor();
  renderTestimonialsEditor();
  renderHoursEditor();
  renderGalleryEditor();
  renderAmenitiesEditor();
  renderExperienceEditor();
  renderWhyUsEditor();
  loadColorsPanel();
  syncColorPickers();
}

/* --------------------------------------------
   LOAD FORM VALUES
-------------------------------------------- */
function loadSectionData() {
  const g = cfgLoad('general', DEFAULTS.general);
  setVal('g_name', g.name);         setVal('g_tagline', g.tagline);       setVal('g_slogan', g.slogan);
  setVal('g_phone', g.phone);       setVal('g_whatsapp', g.whatsapp);     setVal('g_email', g.email);
  setVal('g_address', g.address);   setVal('g_mapslink', g.mapslink);     setVal('g_mapembed', g.mapembed);
  setVal('g_rating', g.rating);     setVal('g_reviews', g.reviews);       setVal('g_satisfaction', g.satisfaction);

  const h = cfgLoad('hero', DEFAULTS.hero);
  setVal('h_badge', h.badge);       setVal('h_title1', h.title1);         setVal('h_title2', h.title2);
  setVal('h_title3', h.title3);     setVal('h_subtitle', h.subtitle);
  setVal('h_btn1', h.btn1);         setVal('h_btn2', h.btn2);

  const s = cfgLoad('social', DEFAULTS.social);
  setVal('s_instagram', s.instagram); setVal('s_facebook', s.facebook);
  setVal('s_tiktok', s.tiktok);       setVal('s_youtube', s.youtube);
  setVal('s_wa_msg', s.wa_msg);       setVal('s_wa_tooltip', s.wa_tooltip);

  setVal('h_closed_msg', cfgLoad('closedMsg', DEFAULTS.closedMsg));
}

/* --------------------------------------------
   SECTION SWITCHING  (global — llamado desde onclick)
-------------------------------------------- */
function switchSection(name) {
  document.querySelectorAll('.sb-item').forEach(function(b) {
    b.classList.toggle('active', b.dataset.section === name);
  });
  document.querySelectorAll('.admin-section').forEach(function(s) {
    s.classList.toggle('active', s.id === 'sec-' + name);
  });
  var titles = {
    dashboard: 'Dashboard', general: 'Información General',
    hero: 'Hero / Portada', menu: 'Menú', services: 'Servicios',
    testimonials: 'Testimonios', hours: 'Horarios', social: 'Redes Sociales',
    gallery: 'Galería', colors: 'Colores & Marca', security: 'Seguridad'
  };
  var tb = document.getElementById('tbTitle');
  if (tb) tb.textContent = titles[name] || name;
  // close mobile sidebar
  var sb  = document.getElementById('sidebar');
  var ov  = document.querySelector('.sb-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
}
window.switchSection = switchSection;

/* --------------------------------------------
   SAVE SECTION  (global)
-------------------------------------------- */
function saveSection(name) {
  switch (name) {
    case 'general': {
      cfgSave('general', {
        name: getVal('g_name'), tagline: getVal('g_tagline'), slogan: getVal('g_slogan'),
        phone: getVal('g_phone'), whatsapp: getVal('g_whatsapp'), email: getVal('g_email'),
        address: getVal('g_address'), mapslink: getVal('g_mapslink'), mapembed: getVal('g_mapembed'),
        rating: getVal('g_rating'), reviews: getVal('g_reviews'), satisfaction: getVal('g_satisfaction')
      });
      syncHeroTitlesFromGeneralSlogan();
      break;
    }
    case 'hero': {
      cfgSave('hero', {
        badge: getVal('h_badge'), title1: getVal('h_title1'), title2: getVal('h_title2'),
        title3: getVal('h_title3'), subtitle: getVal('h_subtitle'),
        btn1: getVal('h_btn1'), btn2: getVal('h_btn2')
      });
      break;
    }
    case 'menu': {
      var rows  = document.querySelectorAll('#menuEditor .menu-item-row');
      var items = [];
      rows.forEach(function(row) {
        items.push({
          name:  row.querySelector('[data-field="name"]').value,
          desc:  row.querySelector('[data-field="desc"]').value,
          price: row.querySelector('[data-field="price"]').value
        });
      });
      var menuData = cfgLoad('menu', DEFAULTS.menu);
      menuData[currentMenuTab] = items;
      cfgSave('menu', menuData);
      break;
    }
    case 'services': {
      var svcs = [];
      document.querySelectorAll('.svc-row').forEach(function(row) {
        svcs.push({
          icon:     row.querySelector('[data-field="icon"]').value,
          name:     row.querySelector('[data-field="name"]').value,
          desc:     row.querySelector('[data-field="desc"]').value,
          linkText: row.querySelector('[data-field="linkText"]').value,
          link:     row.querySelector('[data-field="link"]').value
        });
      });
      cfgSave('services', svcs);
      break;
    }
    case 'testimonials': {
      var testis = [];
      document.querySelectorAll('.testi-row').forEach(function(row) {
        testis.push({
          name:   row.querySelector('[data-field="name"]').value,
          rating: row.querySelector('[data-field="rating"]').value,
          text:   row.querySelector('[data-field="text"]').value,
          date:   row.querySelector('[data-field="date"]').value
        });
      });
      cfgSave('testimonials', testis);
      updateDashboardCounts();
      break;
    }
    case 'hours': {
      var hrs = [];
      document.querySelectorAll('.hours-row').forEach(function(row) {
        hrs.push({
          days:  row.querySelector('[data-field="days"]').value,
          open:  row.querySelector('[data-field="open"]').value,
          close: row.querySelector('[data-field="close"]').value
        });
      });
      cfgSave('hours', hrs);
      cfgSave('closedMsg', getVal('h_closed_msg'));
      break;
    }
    case 'social': {
      cfgSave('social', {
        instagram: getVal('s_instagram'), facebook: getVal('s_facebook'),
        tiktok: getVal('s_tiktok'), youtube: getVal('s_youtube'),
        wa_msg: getVal('s_wa_msg'), wa_tooltip: getVal('s_wa_tooltip')
      });
      break;
    }
    case 'gallery': {
      var gItems = [];
      document.querySelectorAll('.gallery-edit-item').forEach(function(item) {
        gItems.push({
          cat:   item.querySelector('[data-field="cat"]').value,
          title: item.querySelector('[data-field="title"]').value
        });
      });
      cfgSave('gallery', gItems);
      break;
    }
    case 'amenities': {
      var amenCards = [];
      document.querySelectorAll('#amenitiesEditor .svc-row').forEach(function(row) {
        var itemsRaw = row.querySelector('[data-field="items"]').value;
        amenCards.push({
          icon:  row.querySelector('[data-field="icon"]').value.trim(),
          title: row.querySelector('[data-field="title"]').value.trim(),
          items: itemsRaw.split('\n').map(function(l){ return l.trim(); }).filter(Boolean)
        });
      });
      cfgSave('amenities', amenCards);
      break;
    }
    case 'dashboard':
      showToast('\u2139\uFE0F Dashboard no tiene cambios que guardar');
      return;
    default:
      return;
  }
  showToast('\u2705 ' + (name.charAt(0).toUpperCase() + name.slice(1)) + ' guardado correctamente');
  flashStatus();
  syncToCloud(); // Publica automaticamente al sitio
}
window.saveSection = saveSection;

/* Versión silenciosa: guarda sin toast ni sync (usada por el botón global) */
function saveSectionSilent(name) {
  switch (name) {
    case 'general':
      cfgSave('general', {
        name: getVal('g_name'), tagline: getVal('g_tagline'), slogan: getVal('g_slogan'),
        phone: getVal('g_phone'), whatsapp: getVal('g_whatsapp'), email: getVal('g_email'),
        address: getVal('g_address'), mapslink: getVal('g_mapslink'), mapembed: getVal('g_mapembed'),
        rating: getVal('g_rating'), reviews: getVal('g_reviews'), satisfaction: getVal('g_satisfaction')
      });
      syncHeroTitlesFromGeneralSlogan();
      break;
    case 'hero':
      cfgSave('hero', {
        badge: getVal('h_badge'), title1: getVal('h_title1'), title2: getVal('h_title2'),
        title3: getVal('h_title3'), subtitle: getVal('h_subtitle'),
        btn1: getVal('h_btn1'), btn2: getVal('h_btn2')
      }); break;
    case 'menu': {
      var rows = document.querySelectorAll('#menuEditor .menu-item-row');
      var items = [];
      rows.forEach(function(row) {
        items.push({ name: row.querySelector('[data-field="name"]').value,
                     desc: row.querySelector('[data-field="desc"]').value,
                     price: row.querySelector('[data-field="price"]').value });
      });
      var md = cfgLoad('menu', DEFAULTS.menu);
      md[currentMenuTab] = items;
      cfgSave('menu', md); break;
    }
    case 'services': {
      var svcs = [];
      document.querySelectorAll('.svc-row').forEach(function(row) {
        svcs.push({ icon: row.querySelector('[data-field="icon"]').value,
                    name: row.querySelector('[data-field="name"]').value,
                    desc: row.querySelector('[data-field="desc"]').value,
                    linkText: row.querySelector('[data-field="linkText"]').value,
                    link: row.querySelector('[data-field="link"]').value });
      });
      cfgSave('services', svcs); break;
    }
    case 'testimonials': {
      var testis = [];
      document.querySelectorAll('.testi-row').forEach(function(row) {
        testis.push({ name: row.querySelector('[data-field="name"]').value,
                      rating: row.querySelector('[data-field="rating"]').value,
                      text: row.querySelector('[data-field="text"]').value,
                      date: row.querySelector('[data-field="date"]').value });
      });
      cfgSave('testimonials', testis); break;
    }
    case 'hours': {
      var hrs = [];
      document.querySelectorAll('.hours-row').forEach(function(row) {
        hrs.push({ days: row.querySelector('[data-field="days"]').value,
                   open: row.querySelector('[data-field="open"]').value,
                   close: row.querySelector('[data-field="close"]').value });
      });
      cfgSave('hours', hrs);
      cfgSave('closedMsg', getVal('h_closed_msg')); break;
    }
    case 'social':
      cfgSave('social', {
        instagram: getVal('s_instagram'), facebook: getVal('s_facebook'),
        tiktok: getVal('s_tiktok'), youtube: getVal('s_youtube'),
        wa_msg: getVal('s_wa_msg'), wa_tooltip: getVal('s_wa_tooltip')
      }); break;
    case 'gallery': {
      var gItems = [];
      document.querySelectorAll('.gallery-edit-item').forEach(function(item) {
        gItems.push({ cat: item.querySelector('[data-field="cat"]').value,
                      title: item.querySelector('[data-field="title"]').value });
      });
      cfgSave('gallery', gItems); break;
    }
    case 'amenities': {
      var amenCards = [];
      document.querySelectorAll('#amenitiesEditor .svc-row').forEach(function(row) {
        var itemsRaw = row.querySelector('[data-field="items"]').value;
        amenCards.push({ icon: row.querySelector('[data-field="icon"]').value.trim(),
                         title: row.querySelector('[data-field="title"]').value.trim(),
                         items: itemsRaw.split('\n').map(function(l){ return l.trim(); }).filter(Boolean) });
      });
      cfgSave('amenities', amenCards); break;
    }
    case 'experience': {
      var expItems = [];
      document.querySelectorAll('#experienceEditor .exp-edit-row').forEach(function(row) {
        expItems.push({ icon: row.querySelector('[data-field="icon"]').value.trim(),
                        title: row.querySelector('[data-field="title"]').value.trim(),
                        desc: row.querySelector('[data-field="desc"]').value.trim() });
      });
      cfgSave('experience', expItems); break;
    }
    case 'whyus': {
      var whyItems = [];
      document.querySelectorAll('#whyusEditor .why-edit-row').forEach(function(row) {
        whyItems.push({ title: row.querySelector('[data-field="title"]').value.trim(),
                        desc: row.querySelector('[data-field="desc"]').value.trim() });
      });
      cfgSave('whyus', whyItems); break;
    }
    default: break;
  }
}

function runGlobalSaveFlow() {
  var globalSave = document.getElementById('globalSave');

  /* 1. Guarda la sección activa normalmente */
  var active = document.querySelector('.admin-section.active');
  var activeName = active ? active.id.replace('sec-', '') : '';
  if (activeName && activeName !== 'dashboard') {
    saveSection(activeName);
  }

  /* 2. Recorre y guarda TODAS las demás secciones con datos en el DOM */
  var allSections = ['general','hero','menu','services','testimonials',
                     'hours','social','gallery','colors','amenities',
                     'experience','whyus'];
  allSections.forEach(function(name) {
    if (name === activeName) return;
    var el = document.getElementById('sec-' + name);
    if (el) saveSectionSilent(name);
  });

  /* 3. Publica inmediatamente en lafocacheria.web.app */
  syncToCloud();

  /* 4. Feedback visual en el botón */
  if (globalSave) {
    globalSave.textContent = '\u2705 Publicado';
    globalSave.style.background = '#A1DFCB';
    globalSave.style.color = '#0a0a0b';
    setTimeout(function() {
      globalSave.textContent = '\uD83D\uDCBE Guardar Cambios';
      globalSave.style.background = '';
      globalSave.style.color = '';
    }, 2500);
  }
}
window.saveSectionSilent = saveSectionSilent;

/* --------------------------------------------
   MENU EDITOR
-------------------------------------------- */
function renderMenuEditor() {
  var menuData = cfgLoad('menu', DEFAULTS.menu);
  var items    = menuData[currentMenuTab] || [];
  var container = document.getElementById('menuEditor');
  if (!container) return;

  var labelMap = { food: 'Plato', cocktails: 'Cóctel', wines: 'Vino', beers: 'Cerveza' };
  var html = '';
  items.forEach(function(item, i) {
    html += '<div class="menu-item-row">'
      + '<div class="field-group"><label>Nombre</label><input type="text" data-field="name" value="' + esc(item.name) + '" placeholder="Nombre" /></div>'
      + '<div class="field-group"><label>Descripción</label><input type="text" data-field="desc" value="' + esc(item.desc) + '" placeholder="Descripción" /></div>'
      + '<div class="field-group"><label>Precio</label><input type="text" data-field="price" value="' + esc(item.price) + '" placeholder="RD$ 0" /></div>'
      + '<button class="delete-btn" onclick="deleteMenuItem(' + i + ')" type="button" title="Eliminar">\u2715</button>'
      + '</div>';
  });
  html += '<button class="add-btn" onclick="addMenuItem()" type="button" style="margin-top:8px">\u2795 Agregar ' + (labelMap[currentMenuTab] || 'Elemento') + '</button>';
  container.innerHTML = html;
}

function addMenuItem() {
  var menuData = cfgLoad('menu', DEFAULTS.menu);
  if (!menuData[currentMenuTab]) menuData[currentMenuTab] = [];
  menuData[currentMenuTab].push({ name: '', desc: '', price: '' });
  cfgSave('menu', menuData);
  renderMenuEditor();
}
window.addMenuItem = addMenuItem;

function deleteMenuItem(idx) {
  if (!confirm('¿Eliminar este elemento del menú?')) return;
  var menuData = cfgLoad('menu', DEFAULTS.menu);
  menuData[currentMenuTab].splice(idx, 1);
  cfgSave('menu', menuData);
  renderMenuEditor();
  showToast('\uD83D\uDDD1\uFE0F Elemento eliminado');
}
window.deleteMenuItem = deleteMenuItem;

/* --------------------------------------------
   SERVICES EDITOR
-------------------------------------------- */
function renderServicesEditor() {
  var svcs = cfgLoad('services', DEFAULTS.services);
  var container = document.getElementById('servicesEditor');
  if (!container) return;
  var html = '';
  svcs.forEach(function(s, i) {
    html += '<div class="svc-row">'
      + '<div class="svc-row-header"><span class="svc-row-icon">' + s.icon + '</span><span class="svc-row-title">Servicio ' + (i + 1) + '</span>'
      + '<button class="delete-btn" onclick="deleteService(' + i + ')" type="button" title="Eliminar">\u2715</button></div>'
      + '<div class="field-group"><label>\u00cdcono (emoji)</label><input type="text" data-field="icon" value="' + esc(s.icon) + '" placeholder="\u2728" /></div>'
      + '<div class="field-group"><label>Nombre</label><input type="text" data-field="name" value="' + esc(s.name) + '" placeholder="Nombre del servicio" /></div>'
      + '<div class="field-group"><label>Descripción</label><textarea data-field="desc" rows="2" placeholder="Descripción...">' + esc(s.desc) + '</textarea></div>'
      + '<div class="field-group"><label>Texto del bot\u00f3n</label><input type="text" data-field="linkText" value="' + esc(s.linkText || 'Ver m\u00e1s \u2192') + '" placeholder="Ver m\u00e1s \u2192" /></div>'
      + '<div class="field-group"><label>Enlace del botón (# para ancla)</label><input type="text" data-field="link" value="' + esc(s.link || '#') + '" placeholder="#menu" /></div>'
      + '</div>';
  });
  container.innerHTML = html;
}

function deleteService(idx) {
  if (!confirm('¿Eliminar este servicio?')) return;
  var svcs = cfgLoad('services', DEFAULTS.services);
  svcs.splice(idx, 1);
  cfgSave('services', svcs);
  renderServicesEditor();
  updateDashboardCounts();
  showToast('\uD83D\uDDD1\uFE0F Servicio eliminado');
}
window.deleteService = deleteService;

/* --------------------------------------------
   TESTIMONIALS EDITOR
-------------------------------------------- */
function renderTestimonialsEditor() {
  var testis = cfgLoad('testimonials', DEFAULTS.testimonials);
  var container = document.getElementById('testiEditor');
  if (!container) return;
  var html = '';
  testis.forEach(function(t, i) {
    html += '<div class="testi-row">'
      + '<div class="testi-row-header"><span class="testi-row-num">Testimonio #' + (i + 1) + '</span>'
      + '<button class="delete-btn" onclick="deleteTestimonial(' + i + ')" type="button" title="Eliminar">\u2715</button></div>'
      + '<div class="testi-fields">'
      + '<div class="field-group"><label>Nombre del cliente</label><input type="text" data-field="name" value="' + esc(t.name) + '" placeholder="Nombre" /></div>'
      + '<div class="field-group"><label>Calificaci\u00f3n</label><input type="text" data-field="rating" value="' + esc(t.rating) + '" placeholder="\u2B50\u2B50\u2B50\u2B50\u2B50" /></div>'
      + '<div class="field-group"><label>Fecha</label><input type="text" data-field="date" value="' + esc(t.date) + '" placeholder="Hace 2 días" /></div>'
      + '<div class="field-group" style="grid-column:span 2"><label>Comentario</label><textarea data-field="text" rows="3" placeholder="Comentario del cliente...">' + esc(t.text) + '</textarea></div>'
      + '</div></div>';
  });
  container.innerHTML = html;
}

function addTestimonial() {
  var testis = cfgLoad('testimonials', DEFAULTS.testimonials);
  testis.push({ name: '', rating: '\u2B50\u2B50\u2B50\u2B50\u2B50', text: '', date: 'Reciente' });
  cfgSave('testimonials', testis);
  renderTestimonialsEditor();
  showToast('\u2795 Nuevo testimonio agregado');
}
window.addTestimonial = addTestimonial;

function deleteTestimonial(idx) {
  if (!confirm('¿Eliminar este testimonio?')) return;
  var testis = cfgLoad('testimonials', DEFAULTS.testimonials);
  testis.splice(idx, 1);
  cfgSave('testimonials', testis);
  renderTestimonialsEditor();
  updateDashboardCounts();
  showToast('\uD83D\uDDD1\uFE0F Testimonio eliminado');
}
window.deleteTestimonial = deleteTestimonial;

/* --------------------------------------------
   HOURS EDITOR
-------------------------------------------- */
function renderHoursEditor() {
  var hrs = cfgLoad('hours', DEFAULTS.hours);
  var container = document.getElementById('hoursEditor');
  if (!container) return;
  var html = '';
  hrs.forEach(function(h, i) {
    html += '<div class="hours-row">'
      + '<div class="field-group"><label>Días</label><input type="text" data-field="days" value="' + esc(h.days) + '" placeholder="Lunes – Viernes" /></div>'
      + '<div class="field-group"><label>Apertura</label><input type="text" data-field="open" value="' + esc(h.open) + '" placeholder="12:00 PM" /></div>'
      + '<div class="field-group"><label>Cierre</label><input type="text" data-field="close" value="' + esc(h.close) + '" placeholder="12:00 AM" /></div>'
      + '<button class="delete-btn" onclick="deleteHoursRow(' + i + ')" type="button" title="Eliminar" style="margin-bottom:1px">\u2715</button>'
      + '</div>';
  });
  container.innerHTML = html;
}

function addHoursRow() {
  var hrs = cfgLoad('hours', DEFAULTS.hours);
  hrs.push({ days: '', open: '', close: '' });
  cfgSave('hours', hrs);
  renderHoursEditor();
}
window.addHoursRow = addHoursRow;

function deleteHoursRow(idx) {
  var hrs = cfgLoad('hours', DEFAULTS.hours);
  hrs.splice(idx, 1);
  cfgSave('hours', hrs);
  renderHoursEditor();
}
window.deleteHoursRow = deleteHoursRow;

/* --------------------------------------------
   GALLERY EDITOR  (con upload de imágenes)
-------------------------------------------- */
function renderGalleryEditor() {
  var items = cfgLoad('gallery', DEFAULTS.gallery);
  var container = document.getElementById('galleryEditor');
  if (!container) return;

  var html = '';
  items.forEach(function(item, i) {
    var storedImg = localStorage.getItem('velvet_gallery_img_' + i) || '';
    var thumbStyle = storedImg
      ? 'background-image:url(' + storedImg + ');background-size:cover;background-position:center;'
      : '';
    var hasImg = !!storedImg;

    html += '<div class="gallery-edit-item">'
      + '<button class="delete-btn gallery-delete-btn" onclick="deleteGalleryItem(' + i + ')" type="button" title="Eliminar tarjeta">\u2715</button>'

      /* -- Columna izquierda: preview + controles -- */
      + '<div class="gei-left">'

        /* preview box */
        + '<div class="gei-preview-box gei-fallback-' + (i + 1) + '" id="gei-thumb-' + i + '" style="' + thumbStyle + '">'
        + (!hasImg ? '<span class="gei-empty-label">Sin imagen</span>' : '')
        + '</div>'

        /* botones de acción */
        + '<div class="gei-img-actions">'
          + '<label for="gei-file-' + i + '" class="gei-upload-btn" title="Subir imagen desde tu computadora">\uD83D\uDCE4 Subir imagen</label>'
          + (hasImg
              ? '<button type="button" class="gei-clear-btn" onclick="clearGalleryImage(' + i + ')" title="Eliminar imagen">\uD83D\uDDD1\uFE0F Quitar</button>'
              : '')
        + '</div>'

        /* input file oculto */
        + '<input type="file" id="gei-file-' + i + '" accept="image/jpeg,image/png,image/webp,image/gif" '
        + 'style="display:none" onchange="handleGalleryImage(event,' + i + ')" />'

        /* barra de progreso */
        + '<div class="gei-progress" id="gei-progress-' + i + '" style="display:none">'
          + '<div class="gei-progress-bar"></div>'
        + '</div>'

      + '</div>'

      /* -- Columna derecha: campos de texto -- */
      + '<div class="gei-fields">'
        + '<div class="field-group"><label>Categoría</label>'
          + '<input type="text" data-field="cat" value="' + esc(item.cat) + '" placeholder="Ambiente" /></div>'
        + '<div class="field-group"><label>Título de la foto</label>'
          + '<input type="text" data-field="title" value="' + esc(item.title) + '" placeholder="Lounge Principal" /></div>'
        + (hasImg
            ? '<div class="gei-img-info" id="gei-info-' + i + '">'
                + '<span class="gei-img-badge">\u2705 Imagen cargada</span>'
              + '</div>'
            : '<div class="gei-img-info" id="gei-info-' + i + '">'
                + '<span class="gei-img-badge empty">Sin imagen — se usará fondo degradado</span>'
              + '</div>')
      + '</div>'

    + '</div>';
  });

  container.innerHTML = html;
}

function deleteGalleryItem(idx) {
  if (!confirm('¿Eliminar esta tarjeta de galería?')) return;

  var items = cfgLoad('gallery', DEFAULTS.gallery);
  items.splice(idx, 1);
  cfgSave('gallery', items);

  var previousImgs = {};
  for (var i = 0; i < 24; i++) {
    var img = localStorage.getItem('velvet_gallery_img_' + i);
    if (img) previousImgs[i] = img;
    localStorage.removeItem('velvet_gallery_img_' + i);
  }

  var nextIndex = 0;
  Object.keys(previousImgs)
    .map(function(key) { return Number(key); })
    .sort(function(a, b) { return a - b; })
    .forEach(function(oldIndex) {
      if (oldIndex === idx) return;
      localStorage.setItem('velvet_gallery_img_' + nextIndex, previousImgs[oldIndex]);
      nextIndex++;
    });

  renderGalleryEditor();
  showToast('\uD83D\uDDD1\uFE0F Tarjeta de galería eliminada');
}
window.deleteGalleryItem = deleteGalleryItem;

/* -- Manejar selección de archivo -- */
function handleGalleryImage(event, idx) {
  var file = event.target.files[0];
  if (!file) return;

  /* Validar tipo */
  if (!file.type.startsWith('image/')) {
    showToast('\u274C Solo se aceptan im\u00e1genes (JPG, PNG, WebP, GIF)', true);
    return;
  }

  /* Mostrar progreso */
  var progress = document.getElementById('gei-progress-' + idx);
  if (progress) progress.style.display = 'block';

  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      /* Comprimir y redimensionar con canvas */
      var canvas  = document.createElement('canvas');
      var maxW    = 1200;
      var maxH    = 900;
      var w       = img.width;
      var h       = img.height;

      /* Mantener proporción */
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }

      canvas.width  = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      /* Guardar como JPEG 85% calidad */
      var dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      /* Verificar tamaño en localStorage (~5MB max) */
      if (dataUrl.length > 5 * 1024 * 1024) {
        /* Intentar con menor calidad */
        dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      }

      try {
        localStorage.setItem('velvet_gallery_img_' + idx, dataUrl);
        if (progress) progress.style.display = 'none';
        renderGalleryEditor();
        showToast('\u2705 Imagen ' + (idx + 1) + ' cargada correctamente');
      } catch (storageErr) {
        if (progress) progress.style.display = 'none';
        showToast('\u274C Imagen muy grande para guardar. Usa una imagen m\u00e1s peque\u00f1a.', true);
      }
    };
    img.onerror = function() {
      if (progress) progress.style.display = 'none';
      showToast('\u274C No se pudo leer la imagen', true);
    };
    img.src = e.target.result;
  };
  reader.onerror = function() {
    if (progress) progress.style.display = 'none';
    showToast('\u274C Error al leer el archivo', true);
  };
  reader.readAsDataURL(file);

  /* Reset input para permitir cargar el mismo archivo de nuevo */
  event.target.value = '';
}
window.handleGalleryImage = handleGalleryImage;

/* -- Eliminar imagen de galería -- */
function clearGalleryImage(idx) {
  if (!confirm('¿Quitar la imagen del espacio ' + (idx + 1) + '? Se usará el fondo degradado.')) return;
  localStorage.removeItem('velvet_gallery_img_' + idx);
  renderGalleryEditor();
  showToast('\uD83D\uDDD1\uFE0F Imagen eliminada - se restaur\u00f3 el fondo por defecto');
}
window.clearGalleryImage = clearGalleryImage;

/* --------------------------------------------
   COLORS
-------------------------------------------- */
function loadColorsPanel() {
  var c = cfgLoad('colors', DEFAULTS.colors);
  setColorField('gold',  c.gold);
  setColorField('green', c.green);
  setColorField('dark',  c.dark);
  setColorField('rose',  c.rose);
  applyColorsPreview(c);
}

function setColorField(name, val) {
  var cp = document.getElementById('c_' + name);
  var ct = document.getElementById('c_' + name + '_txt');
  if (cp) cp.value = val;
  if (ct) ct.value = val;
}

function syncColorPickers() {
  ['gold','green','dark','rose'].forEach(function(name) {
    var cp = document.getElementById('c_' + name);
    var ct = document.getElementById('c_' + name + '_txt');
    if (cp) cp.addEventListener('input', function() { if (ct) ct.value = cp.value; updateColorPreview(); });
    if (ct) ct.addEventListener('input', function() {
      if (/^#[0-9a-fA-F]{6}$/.test(ct.value)) { if (cp) cp.value = ct.value; updateColorPreview(); }
    });
  });
}

function updateColorPreview() {
  applyColorsPreview({
    gold:  (document.getElementById('c_gold')  || {}).value  || DEFAULTS.colors.gold,
    green: (document.getElementById('c_green') || {}).value  || DEFAULTS.colors.green,
    dark:  (document.getElementById('c_dark')  || {}).value  || DEFAULTS.colors.dark,
    rose:  (document.getElementById('c_rose')  || {}).value  || DEFAULTS.colors.rose
  });
}

function applyColorsPreview(c) {
  var hero = document.querySelector('.cp-hero');
  if (hero) hero.style.background = c.dark;
  var emTitle = document.querySelector('.cp-title.em');
  if (emTitle) emTitle.style.color = c.gold;
  var btn1 = document.getElementById('cpBtn1');
  if (btn1) btn1.style.background = 'linear-gradient(135deg,' + c.gold + ',' + lightenHex(c.gold, 28) + ')';
  var badge = document.querySelector('.cp-badge');
  if (badge) { badge.style.color = c.gold; badge.style.borderColor = c.gold + '44'; badge.style.background = c.gold + '1a'; }
}

function lightenHex(hex, amt) {
  var col = parseInt(hex.replace('#',''), 16);
  var r   = Math.min(255, (col >> 16) + amt);
  var g   = Math.min(255, ((col >> 8) & 0xff) + amt);
  var b   = Math.min(255, (col & 0xff) + amt);
  return '#' + [r,g,b].map(function(x){ return x.toString(16).padStart(2,'0'); }).join('');
}

function applyColors() {
  var c = {
    gold:  (document.getElementById('c_gold')  || {}).value  || DEFAULTS.colors.gold,
    green: (document.getElementById('c_green') || {}).value  || DEFAULTS.colors.green,
    dark:  (document.getElementById('c_dark')  || {}).value  || DEFAULTS.colors.dark,
    rose:  (document.getElementById('c_rose')  || {}).value  || DEFAULTS.colors.rose
  };
  cfgSave('colors', c);
  showToast('\uD83C\uDFA8 Colores guardados - Se aplicar\u00e1n al recargar el sitio');
}
window.applyColors = applyColors;

function resetColors() {
  if (!confirm('¿Restaurar colores predeterminados?')) return;
  cfgSave('colors', DEFAULTS.colors);
  loadColorsPanel();
  showToast('\u267B\uFE0F Colores restaurados');
}
window.resetColors = resetColors;

/* --------------------------------------------
   AMENIDADES EDITOR
-------------------------------------------- */
var DEFAULTS_AMENITIES = [
  { icon: '\u267F', title: 'Accesibilidad', items: ['Sanitarios accesibles', 'Acceso para sillas de ruedas', 'Estacionamiento accesible'] },
  { icon: '\uD83D\uDECE\uFE0F', title: 'Servicios',     items: ['Entrega a domicilio', 'Para llevar', 'Consumo en el lugar', 'Servicio a la mesa', 'Reservaciones'] },
  { icon: '\uD83D\uDCB3', title: 'M\u00e9todos de Pago', items: ['Tarjetas de cr\u00e9dito', 'Tarjetas de d\u00e9bito', 'Efectivo', 'NFC / Pagos digitales'] },
  { icon: '\uD83D\uDE97',  title: 'Estacionamiento', items: ['Gratuito', 'Amplio espacio', 'Valet Parking', 'Vigilancia 24/7'] }
];

function renderAmenitiesEditor() {
  var data = cfgLoad('amenities', DEFAULTS_AMENITIES);
  var container = document.getElementById('amenitiesEditor');
  if (!container) return;
  container.innerHTML = data.map(function(card, ci) {
    return '<div class="svc-row" style="flex-direction:column; gap:10px;" data-ci="' + ci + '">' +
      '<div style="display:flex; gap:10px; align-items:center;">' +
        '<input style="width:60px; text-align:center; font-size:1.4rem;" data-field="icon" value="' + (card.icon || '') + '" placeholder="\u2728" />' +
        '<input style="flex:1;" data-field="title" value="' + (card.title || '') + '" placeholder="Título de la tarjeta" />' +
        '<button class="svc-del-btn" onclick="deleteAmenityCard(' + ci + ')" title="Eliminar tarjeta">\u2715</button>' +
      '</div>' +
      '<textarea data-field="items" rows="4" placeholder="Un ítem por línea" style="width:100%; resize:vertical; background:var(--dark-3); color:var(--white); border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:10px; font-size:.85rem;">' +
        (Array.isArray(card.items) ? card.items.join('\n') : '') +
      '</textarea>' +
    '</div>';
  }).join('');
}
window.renderAmenitiesEditor = renderAmenitiesEditor;

function addAmenityCard() {
  var data = cfgLoad('amenities', DEFAULTS_AMENITIES);
  data.push({ icon: '\uD83D\uDCDD', title: 'Nueva tarjeta', items: ['\u00cdtem 1', '\u00cdtem 2'] });
  cfgSave('amenities', data);
  renderAmenitiesEditor();
}
window.addAmenityCard = addAmenityCard;

function deleteAmenityCard(idx) {
  var data = cfgLoad('amenities', DEFAULTS_AMENITIES);
  data.splice(idx, 1);
  cfgSave('amenities', data);
  renderAmenitiesEditor();
  showToast('Tarjeta eliminada');
}
window.deleteAmenityCard = deleteAmenityCard;

/* --------------------------------------------
   EXPERIENCIA EDITOR
-------------------------------------------- */
var DEFAULTS_EXPERIENCE = [
  { icon: '\uD83C\uDFB5', title: 'M\u00fasica en Vivo',       desc: 'Artistas en vivo todos los fines de semana' },
  { icon: '\uD83C\uDF78', title: 'Buenos C\u00f3cteles',       desc: 'Mixolog\u00eda artesanal con ingredientes premium' },
  { icon: '\uD83C\uDF77', title: 'Vinos Premium',          desc: 'Selecci\u00f3n curada de las mejores bodegas' },
  { icon: '\uD83C\uDF7A', title: 'Cervezas Exclusivas',    desc: 'Nacionales e importadas de alta calidad' },
  { icon: '\uD83C\uDFC6', title: 'Deportes en Pantalla',   desc: 'Pantallas gigantes para los mejores eventos' },
  { icon: '\uD83C\uDF89', title: 'Eventos Especiales',      desc: 'Celebraciones privadas y corporativas' },
  { icon: '\uD83D\uDECB\uFE0F',  title: '\u00c1rea Lounge',            desc: 'Sof\u00e1s y espacios c\u00f3modos para relajarte' },
  { icon: '\uD83C\uDF3F', title: 'Terraza',                 desc: 'Ambiente al aire libre con decoraci\u00f3n tropical' },
  { icon: '\uD83D\uDEAA', title: 'Comedor Privado',         desc: 'Sala exclusiva para grupos y reuniones' },
  { icon: '\uD83D\uDC83', title: 'Lugar para Bailar',       desc: 'Pista de baile con la mejor m\u00fasica' },
  { icon: '\uD83E\uDD35', title: 'Servicio Exclusivo',      desc: 'Atenci\u00f3n personalizada y profesional' },
  { icon: '\u2728', title: 'Ambiente Premium',         desc: 'Decoraci\u00f3n de lujo e iluminaci\u00f3n ambiental' }
];

function renderExperienceEditor() {
  var data = cfgLoad('experience', DEFAULTS_EXPERIENCE);
  var container = document.getElementById('experienceEditor');
  if (!container) return;
  container.innerHTML = data.map(function(item, i) {
    return '<div class="exp-edit-row svc-row" style="align-items:center; gap:10px;" data-i="' + i + '">' +
      '<input style="width:56px; text-align:center; font-size:1.3rem;" data-field="icon" value="' + (item.icon || '') + '" placeholder="\u2728" />' +
      '<input style="width:180px;" data-field="title" value="' + (item.title || '') + '" placeholder="Título" />' +
      '<input style="flex:1;" data-field="desc" value="' + (item.desc || '') + '" placeholder="Descripción corta" />' +
      '<button class="svc-del-btn" onclick="deleteExperienceItem(' + i + ')" title="Eliminar">\u2715</button>' +
    '</div>';
  }).join('');
}
window.renderExperienceEditor = renderExperienceEditor;

function addExperienceItem() {
  var data = cfgLoad('experience', DEFAULTS_EXPERIENCE);
  data.push({ icon: '\u2728', title: 'Nuevo \u00edtem', desc: 'Descripci\u00f3n del \u00edtem' });
  cfgSave('experience', data);
  renderExperienceEditor();
}
window.addExperienceItem = addExperienceItem;

function deleteExperienceItem(idx) {
  var data = cfgLoad('experience', DEFAULTS_EXPERIENCE);
  data.splice(idx, 1);
  cfgSave('experience', data);
  renderExperienceEditor();
  showToast('Ítem eliminado');
}
window.deleteExperienceItem = deleteExperienceItem;

/* --------------------------------------------
   ¿POR QUÉ NOSOTROS? EDITOR
-------------------------------------------- */
var DEFAULTS_WHYUS = [
  { title: 'Excelente Ambiente',     desc: 'Decoración moderna con iluminación ambiental única' },
  { title: 'Atención Profesional',   desc: 'Personal capacitado para brindarte la mejor experiencia' },
  { title: 'Comida de Calidad',      desc: 'Ingredientes frescos y recetas exclusivas' },
  { title: 'Perfecto para Grupos',   desc: 'Capacidad para grupos grandes con áreas reservadas' },
  { title: 'Ambiente Seguro',        desc: 'Seguridad privada y personal de confianza' }
];

function renderWhyUsEditor() {
  var data = cfgLoad('whyus', DEFAULTS_WHYUS);
  var container = document.getElementById('whyusEditor');
  if (!container) return;
  container.innerHTML = data.map(function(item, i) {
    return '<div class="why-edit-row svc-row" style="align-items:center; gap:10px;" data-i="' + i + '">' +
      '<input style="flex:1;" data-field="title" value="' + (item.title || '') + '" placeholder="Característica" />' +
      '<input style="flex:2;" data-field="desc" value="' + (item.desc || '') + '" placeholder="Descripción" />' +
      '<button class="svc-del-btn" onclick="deleteWhyUsItem(' + i + ')" title="Eliminar">\u2715</button>' +
    '</div>';
  }).join('');
}
window.renderWhyUsEditor = renderWhyUsEditor;

function addWhyUsItem() {
  var data = cfgLoad('whyus', DEFAULTS_WHYUS);
  data.push({ title: 'Nueva característica', desc: 'Descripción de la característica' });
  cfgSave('whyus', data);
  renderWhyUsEditor();
}
window.addWhyUsItem = addWhyUsItem;

function deleteWhyUsItem(idx) {
  var data = cfgLoad('whyus', DEFAULTS_WHYUS);
  data.splice(idx, 1);
  cfgSave('whyus', data);
  renderWhyUsEditor();
  showToast('Ítem eliminado');
}
window.deleteWhyUsItem = deleteWhyUsItem;

/* --------------------------------------------
   SECURITY
-------------------------------------------- */
function changePassword() {
  var creds  = cfgLoad('credentials', DEFAULTS.credentials);
  var oldPw  = getVal('sec_old');
  var newPw  = getVal('sec_new');
  var cfm    = getVal('sec_confirm');
  var msg    = document.getElementById('secPwMsg');
  if (!msg) return;
  if (oldPw !== creds.pass)  { msg.className = 'sec-pw-msg err'; msg.textContent = '\u274C La contrase\u00f1a actual no es correcta'; return; }
  if (newPw.length < 6)      { msg.className = 'sec-pw-msg err'; msg.textContent = '\u274C La nueva contrase\u00f1a debe tener al menos 6 caracteres'; return; }
  if (newPw !== cfm)         { msg.className = 'sec-pw-msg err'; msg.textContent = '\u274C Las contrase\u00f1as nuevas no coinciden'; return; }
  creds.pass = newPw;
  cfgSave('credentials', creds);
  ['sec_old','sec_new','sec_confirm'].forEach(function(id){ setVal(id, ''); });
  msg.className = 'sec-pw-msg ok';
  msg.textContent = '\u2705 Contrase\u00f1a actualizada correctamente';
  showToast('\u2705 Contrase\u00f1a cambiada');
}
window.changePassword = changePassword;

function changeUsername() {
  var creds = cfgLoad('credentials', DEFAULTS.credentials);
  var newU  = getVal('sec_user_new').trim();
  var pw    = getVal('sec_user_pw');
  if (pw !== creds.pass) { showToast('\u274C Contrase\u00f1a incorrecta', true); return; }
  if (!newU)             { showToast('\u274C El usuario no puede estar vac\u00edo', true); return; }
  creds.user = newU;
  cfgSave('credentials', creds);
  setVal('sec_user_new', ''); setVal('sec_user_pw', '');
  showToast('\u2705 Usuario actualizado: ' + newU);
}
window.changeUsername = changeUsername;

/* --------------------------------------------
   EXPORT / IMPORT / RESET
-------------------------------------------- */
function exportConfig() {
  var config = {};
  ['general','hero','menu','services','testimonials','hours','closedMsg','social','gallery','colors'].forEach(function(k) {
    config[k] = cfgLoad(k, DEFAULTS[k] || null);
  });
  var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'yatincy-admin-config-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  showToast('\uD83D\uDCE4 Configuraci\u00f3n exportada');
}
window.exportConfig = exportConfig;

function importConfig() {
  var fi = document.getElementById('importFile');
  if (fi) fi.click();
}
window.importConfig = importConfig;

function handleImport(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var config = JSON.parse(ev.target.result);
      Object.keys(config).forEach(function(k){ cfgSave(k, config[k]); });
      showToast('\uD83D\uDCE5 Configuraci\u00f3n importada - Recargando...');
      setTimeout(function(){ location.reload(); }, 1500);
    } catch(err) {
      showToast('\u274C Archivo inv\u00e1lido', true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}
window.handleImport = handleImport;

function resetAll() {
  if (!confirm('\u26A0\uFE0F Esto restaurar\u00e1 TODA la configuraci\u00f3n. \u00bfContinuar?')) return;
  if (!confirm('¿Estás seguro? Esta acción no se puede deshacer.')) return;
  ['general','hero','menu','services','testimonials','hours','closedMsg','social','gallery','colors'].forEach(function(k){
    localStorage.removeItem('velvet_' + k);
  });
  showToast('\u267B\uFE0F Configuraci\u00f3n restaurada - Recargando...');
  setTimeout(function(){ location.reload(); }, 1500);
}
window.resetAll = resetAll;

/* --------------------------------------------
   DASHBOARD COUNTS
-------------------------------------------- */
function updateDashboardCounts() {
  var menu  = cfgLoad('menu', DEFAULTS.menu);
  var total = 0;
  Object.keys(menu).forEach(function(k){ total += menu[k].length; });
  var t1 = document.getElementById('dcMenuCount');
  if (t1) t1.textContent = total + ' elementos en carta';
  var testis = cfgLoad('testimonials', DEFAULTS.testimonials);
  var t2 = document.getElementById('dcTestiCount');
  if (t2) t2.textContent = testis.length + ' reseñas activas';
  var svcs = cfgLoad('services', DEFAULTS.services);
  var t3 = document.getElementById('dcSvcCount');
  if (t3) t3.textContent = svcs.length + ' servicios listados';
}

/* --------------------------------------------
   UI HELPERS
-------------------------------------------- */
function showToast(msg, isError) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.className = 'toast'; }, 3200);
}

function flashStatus() {
  var dot = document.querySelector('.status-dot');
  var txt = document.getElementById('statusText');
  if (dot) { dot.style.background = '#c9a84c'; dot.style.boxShadow = '0 0 6px #c9a84c'; }
  if (txt) txt.textContent = 'Guardando...';
  setTimeout(function(){
    if (dot) { dot.style.background = ''; dot.style.boxShadow = ''; }
    if (txt) txt.textContent = 'Todos los cambios guardados';
  }, 1200);
}

function getVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = (val == null ? '' : val); }
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* --------------------------------------------
   DOM INIT — runs when DOM is ready
-------------------------------------------- */
function initDOM() {
  $loginScreen = document.getElementById('loginScreen');
  $adminPanel  = document.getElementById('adminPanel');

  if (!$loginScreen || !$adminPanel) {
    console.error('Kitchen House: elementos del DOM no encontrados.');
    return;
  }

  /* -- Auto-login from session -- */
  if (sessionStorage.getItem('velvet_admin_auth') === 'true') {
    showAdmin();
  }

  /* -- Login form -- */
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var creds = cfgLoad('credentials', DEFAULTS.credentials);
      var u = (document.getElementById('loginUser') || {}).value.trim();
      var p = (document.getElementById('loginPass') || {}).value;
      var err = document.getElementById('loginError');
    if (u === creds.user && p === creds.pass) {
        sessionStorage.setItem('velvet_admin_auth', 'true');
        if (err) err.classList.remove('show');
        $loginScreen.style.transition = 'opacity .35s, transform .35s';
        $loginScreen.style.opacity    = '0';
        $loginScreen.style.transform  = 'scale(.98)';
          setTimeout(function(){
            $loginScreen.style.display = 'none';
            showAdmin();
          }, 380);
      } else {
        if (err) err.classList.add('show');
        var pass = document.getElementById('loginPass');
        if (pass) { pass.value = ''; pass.focus(); }
      }
    });
  }

  /* -- Password toggle -- */
  var pwToggle = document.getElementById('pwToggle');
  if (pwToggle) {
    pwToggle.addEventListener('click', function() {
      var inp = document.getElementById('loginPass');
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      this.textContent = inp.type === 'password' ? '\uD83D\uDC41' : '\uD83D\uDE48';
    });
  }

  /* -- Logout -- */
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      sessionStorage.removeItem('velvet_admin_auth');
      location.reload();
    });
  }

  /* -- Sidebar nav items -- */
  document.querySelectorAll('.sb-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchSection(this.dataset.section);
    });
  });

  /* -- Menu tabs -- */
  document.querySelectorAll('.mta').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.mta').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      currentMenuTab = btn.dataset.tab;
      renderMenuEditor();
    });
  });

  /* -- Global save button -- */
  var globalSave = document.getElementById('globalSave');
  if (globalSave) {
    globalSave.addEventListener('click', function() {
      runGlobalSaveFlow();
    });
  }

  /* -- Mobile sidebar toggle -- */
  var ov = document.createElement('div');
  ov.className = 'sb-overlay';
  document.body.appendChild(ov);
  ov.addEventListener('click', function() {
    var sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
    ov.classList.remove('show');
  });

  var sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      var sb = document.getElementById('sidebar');
      if (!sb) return;
      if (window.innerWidth <= 900) {
        sb.classList.toggle('open');
        ov.classList.toggle('show');
      } else {
        sb.classList.toggle('collapsed');
        var main = document.querySelector('.admin-main');
        if (main) main.classList.toggle('expanded');
      }
    });
  }
}

/* -- Trigger initDOM safely -- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDOM);
} else {
  initDOM();
}

window.addEventListener('message', handleExternalSaveRequest);

