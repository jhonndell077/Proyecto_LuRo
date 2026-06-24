/* -------------------------------------------------------
   VELVET — app.js
   Lee configuración dinámica guardada desde admin.html
------------------------------------------------------- */

const SITE_DEFAULTS = {
  general: {
    name: 'LA FOCA CHERIA',
    tagline: 'RESTAURANTE DE COSTA & LOUNGE',
    slogan: 'Sabor costero, brasas y momentos para compartir',
    phone: '+1 (809) 555-0000',
    whatsapp: '18095550000',
    email: 'hola@lafocacheria.com',
    address: 'Av. San Vicente de Paul esq. Calle Las Mercedes, Santo Domingo Este',
    mapslink: 'https://maps.google.com/?q=Santo+Domingo+Este',
    mapembed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d60659.81295396764!2d-69.84773!3d18.47977!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8eaf89aecacfaf95%3A0x657fafce23c2bc9b!2sSanto%20Domingo%20Este%2C%20Dominican%20Republic!5e0!3m2!1sen!2s!4v1703000000000',
    rating: '4.8★',
    reviews: '780+',
    satisfaction: '96%'
  },
  hero: {
    badge: 'Santo Domingo Este - Cocina de costa y brasas',
    title1: 'Sabores del mar',
    title2: 'y la parrilla',
    title3: 'para compartir',
    subtitle: 'Mariscos, arroces, picaderas y cocteles servidos en un ambiente calido para almorzar, cenar y celebrar.',
    btn1: 'Reservar Mesa',
    btn2: 'Ver Menu'
  },
  hours: [
    { days: 'Lunes - Jueves', open: '12:00 PM', close: '12:00 AM' },
    { days: 'Viernes - Sabado', open: '12:00 PM', close: '3:00 AM' },
    { days: 'Domingo', open: '12:00 PM', close: '11:00 PM' }
  ],
  social: {
    instagram: '#',
    facebook: '#',
    tiktok: '#',
    youtube: '#',
    wa_msg: 'Hola, quisiera hacer una reservacion en La Foca Cheria',
    wa_tooltip: 'Reserva ahora por WhatsApp'
  },
  menu: {
    food: [
      { name: 'Chillo Frito Entero', desc: 'Pescado crujiente con tostones, ensalada fresca y salsa de la casa', price: 'RD$ 1,250' },
      { name: 'Pasta Caribe con Camarones', desc: 'Pasta cremosa con camarones salteados, ajo y toque de coco', price: 'RD$ 1,150' },
      { name: 'Mofongo de Mariscos', desc: 'Mofongo suave coronado con camarones, calamares y salsa criolla', price: 'RD$ 1,380' },
      { name: 'Parrillada Foca Cheria', desc: 'Mix de res, pollo, cerdo y vegetales para compartir en mesa', price: 'RD$ 1,950' },
      { name: 'Salmon a la Brasa', desc: 'Lomo de salmon sellado con pure rustico y vegetales grillados', price: 'RD$ 1,420' },
      { name: 'Risotto Marinero', desc: 'Arroz cremoso con mejillones, camarones y perfume de vino blanco', price: 'RD$ 1,290' }
    ],
    cocktails: [
      { name: 'Cheria Tropical', desc: 'Ron anejo, chinola, pina natural y espuma citrica', price: 'RD$ 420' },
      { name: 'Mojito de Coco', desc: 'Ron blanco, coco, hierbabuena y limon recien exprimido', price: 'RD$ 390' },
      { name: 'Foca Spritz', desc: 'Aperitivo naranja, espumante y soda con perfil fresco', price: 'RD$ 450' },
      { name: 'Margarita Tamarindo', desc: 'Tequila, tamarindo, triple sec y borde de sal especiada', price: 'RD$ 430' },
      { name: 'Sangria de la Casa', desc: 'Vino tinto, frutas de estacion y toque de canela', price: 'RD$ 380' },
      { name: 'Daiquiri de Fresa', desc: 'Ron, fresa natural y hielo frappado para clima tropical', price: 'RD$ 360' }
    ],
    wines: [
      { name: 'Sauvignon Blanc', desc: 'Blanco fresco ideal para mariscos, ceviches y pescados', price: 'RD$ 2,450 / botella' },
      { name: 'Chardonnay Reserva', desc: 'Cuerpo medio con notas de vainilla para salmon y pastas', price: 'RD$ 2,850 / botella' },
      { name: 'Tempranillo Crianza', desc: 'Tinto amable para parrilladas, mofongo y cortes a la brasa', price: 'RD$ 2,300 / botella' },
      { name: 'Prosecco Brut', desc: 'Espumoso ligero para brindis, cumpleanos y celebraciones', price: 'RD$ 2,100 / botella' }
    ],
    beers: [
      { name: 'Presidente', desc: 'Lager dominicana fria para acompanar frituras y picaderas', price: 'RD$ 180' },
      { name: 'Corona Extra', desc: 'Ligera, citrica y perfecta para mariscos y tardes frescas', price: 'RD$ 250' },
      { name: 'Stella Artois', desc: 'Perfil balanceado para platos de salmon y pastas cremosas', price: 'RD$ 290' },
      { name: 'Modelo Especial', desc: 'Cerveza dorada con buen cuerpo para parrilladas y burgers', price: 'RD$ 310' }
    ]
  },
  services: [
    { icon: '🦐', name: 'Cocina de Mar', desc: 'Pescados, mariscos y arroces preparados al momento con sabor dominicano.', link: '#menu', linkText: 'Ver Menu ->' },
    { icon: '🥩', name: 'Parrilla', desc: 'Carnes, salmon y parrilladas pensadas para compartir en grupo.', link: '#menu', linkText: 'Ver Platos ->' },
    { icon: '🍸', name: 'Cocteles Tropicales', desc: 'Bebidas frescas con frutas, ron, tequila y presentacion vistosa.', link: '#menu', linkText: 'Ver Cocteles ->' },
    { icon: '🎉', name: 'Cumpleanos y Eventos', desc: 'Espacios para celebrar con menu, brindis y atencion personalizada.', link: '#reservations', linkText: 'Cotizar ->' },
    { icon: '🎵', name: 'Ambiente con Musica', desc: 'Ideal para tardes activas, cenas y encuentros especiales.', link: '#gallery', linkText: 'Ver Ambiente ->' },
    { icon: '🚗', name: 'Parqueo y Acceso', desc: 'Facilidad para llegar, estacionar y compartir sin complicaciones.', link: '#location', linkText: 'Como Llegar ->' },
    { icon: '🍽', name: 'Menu Familiar', desc: 'Opciones para picar, almorzar y cenar con buena relacion calidad-precio.', link: '#menu', linkText: 'Ver Precios ->' },
    { icon: '📸', name: 'Espacios Fotografables', desc: 'Decoracion, platos y tragos listos para destacar en redes.', link: '#gallery', linkText: 'Ver Fotos ->' },
    { icon: '💬', name: 'Reservas Rapidas', desc: 'Atencion por WhatsApp para mesas, grupos y celebraciones.', link: '#reservations', linkText: 'Reservar ->' }
  ],
  testimonials: [
    { name: 'Laura Santana', rating: '★★★★★', text: 'El chillo llego crujiente, con buen tamano y una presentacion muy bonita. Es de esos lugares donde quieres volver con la familia.', date: 'Hace 2 dias' },
    { name: 'Jose Miguel', rating: '★★★★★', text: 'La parrillada para compartir rinde bien, la musica acompana y el servicio se mantuvo atento toda la noche.', date: 'Hace 5 dias' },
    { name: 'Karina Perez', rating: '★★★★★', text: 'Pedi mofongo de mariscos y una sangria de la casa. Muy buena relacion entre sabor, ambiente y precio.', date: 'Hace 1 semana' },
    { name: 'Ramon de Leon', rating: '★★★★★', text: 'El modulo transmite justo lo que venden: comida de mar, parrilla, celebracion y fotos bonitas sin perder comodidad.', date: 'Hace 2 semanas' },
    { name: 'Nathaly Cruz', rating: '★★★★★', text: 'Fuimos a celebrar un cumpleanos y nos resolvieron la mesa rapido. Los cocteles tropicales gustaron bastante.', date: 'Hace 3 semanas' },
    { name: 'Edwin Rosario', rating: '★★★★★', text: 'Buen sitio para almorzar y tambien para ir de noche. Se siente cuidado, fresco y con informacion clara en todo momento.', date: 'Hace 1 mes' }
  ],
  gallery: [
    { cat: 'Ambiente', title: 'Salon Principal' },
    { cat: 'Cocteles', title: 'Barra Tropical' },
    { cat: 'Especialidad', title: 'Platos de Mar' },
    { cat: 'Terraza', title: 'Mesas para Compartir' },
    { cat: 'Cena', title: 'Noches con Buen Ambiente' },
    { cat: 'Eventos', title: 'Celebraciones y Cumpleanos' },
    { cat: 'Maridaje', title: 'Vinos y Cervezas Frias' },
    { cat: 'Signature', title: 'Experiencia La Foca Cheria' }
  ]
};

/* --- Leer datos del admin panel --- */
function applySiteConfig() {
  function loadCfg(key, fallback) {
    try { const v = localStorage.getItem('velvet_' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }

  /* Colores */
  const colors = loadCfg('colors', null);
  if (colors) {
    const root = document.documentElement;
    if (colors.gold)  root.style.setProperty('--gold', colors.gold);
    if (colors.green) root.style.setProperty('--green', colors.green);
    if (colors.dark)  root.style.setProperty('--dark', colors.dark);
    if (colors.rose)  root.style.setProperty('--rose', colors.rose);
    // Derivar gold-light
    if (colors.gold)  root.style.setProperty('--gold-light', lightenHex(colors.gold, 28));
  }

  function lightenHex(hex, amt) {
    let c = parseInt(hex.replace('#',''), 16);
    let r = Math.min(255, (c >> 16) + amt);
    let g = Math.min(255, ((c >> 8) & 0xff) + amt);
    let b = Math.min(255, (c & 0xff) + amt);
    return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
  }

  function setMeta(selector, content) {
    var meta = document.querySelector(selector);
    if (meta) meta.setAttribute('content', content);
  }

  function applyImage(selector, url) {
    document.querySelectorAll(selector).forEach(function(el) {
      el.style.backgroundImage = 'linear-gradient(180deg, rgba(10,10,11,.12), rgba(10,10,11,.38)), url(' + url + ')';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    });
  }

  function applyImagery() {
    var imageMap = {
      '.lounge-img': 'https://images.pexels.com/photos/29962517/pexels-photo-29962517.jpeg?cs=srgb&dl=pexels-valeriya-29962517.jpg&fm=jpg',
      '.cocktail-img': 'https://images.pexels.com/photos/19120151/pexels-photo-19120151.jpeg?cs=srgb&dl=pexels-the-castlebar-3902897-19120151.jpg&fm=jpg',
      '.food1': 'https://images.pexels.com/photos/20802562/pexels-photo-20802562.jpeg?cs=srgb&dl=pexels-change-c-c-974768353-20802562.jpg&fm=jpg',
      '.food2': 'https://images.pexels.com/photos/19671377/pexels-photo-19671377.jpeg?cs=srgb&dl=pexels-ionela-mat-268382825-19671377.jpg&fm=jpg',
      '.food3': 'https://images.pexels.com/photos/24868977/pexels-photo-24868977.jpeg?cs=srgb&dl=pexels-kadiravsarr-24868977.jpg&fm=jpg',
      '.food4': 'https://images.pexels.com/photos/32738701/pexels-photo-32738701.jpeg?cs=srgb&dl=pexels-richard-l-2150581203-32738701.jpg&fm=jpg',
      '.food5': 'https://images.pexels.com/photos/3763847/pexels-photo-3763847.jpeg?cs=srgb&dl=pexels-horizon-content-2100060-3763847.jpg&fm=jpg',
      '.food6': 'https://images.pexels.com/photos/20802562/pexels-photo-20802562.jpeg?cs=srgb&dl=pexels-change-c-c-974768353-20802562.jpg&fm=jpg',
      '.ck1': 'https://images.pexels.com/photos/19120151/pexels-photo-19120151.jpeg?cs=srgb&dl=pexels-the-castlebar-3902897-19120151.jpg&fm=jpg',
      '.ck2': 'https://images.pexels.com/photos/24868977/pexels-photo-24868977.jpeg?cs=srgb&dl=pexels-kadiravsarr-24868977.jpg&fm=jpg',
      '.ck3': 'https://images.pexels.com/photos/19120151/pexels-photo-19120151.jpeg?cs=srgb&dl=pexels-the-castlebar-3902897-19120151.jpg&fm=jpg',
      '.ck4': 'https://images.pexels.com/photos/24868977/pexels-photo-24868977.jpeg?cs=srgb&dl=pexels-kadiravsarr-24868977.jpg&fm=jpg',
      '.ck5': 'https://images.pexels.com/photos/19120151/pexels-photo-19120151.jpeg?cs=srgb&dl=pexels-the-castlebar-3902897-19120151.jpg&fm=jpg',
      '.ck6': 'https://images.pexels.com/photos/24868977/pexels-photo-24868977.jpeg?cs=srgb&dl=pexels-kadiravsarr-24868977.jpg&fm=jpg',
      '.w1': 'https://images.pexels.com/photos/34491485/pexels-photo-34491485.jpeg?cs=srgb&dl=pexels-ufukiseloglu-34491485.jpg&fm=jpg',
      '.w2': 'https://images.pexels.com/photos/21967052/pexels-photo-21967052.jpeg?cs=srgb&dl=pexels-seljansalim-21967052.jpg&fm=jpg',
      '.w3': 'https://images.pexels.com/photos/28345131/pexels-photo-28345131.jpeg?cs=srgb&dl=pexels-celine-3776818-28345131.jpg&fm=jpg',
      '.w4': 'https://images.pexels.com/photos/34491485/pexels-photo-34491485.jpeg?cs=srgb&dl=pexels-ufukiseloglu-34491485.jpg&fm=jpg',
      '.b1': 'https://images.pexels.com/photos/15138585/pexels-photo-15138585.jpeg?cs=srgb&dl=pexels-alpyildizlar-15138585.jpg&fm=jpg',
      '.b2': 'https://images.pexels.com/photos/15555562/pexels-photo-15555562.jpeg?cs=srgb&dl=pexels-einbeck-tourismus-455872439-15555562.jpg&fm=jpg',
      '.b3': 'https://images.pexels.com/photos/15700339/pexels-photo-15700339.jpeg?cs=srgb&dl=pexels-matias-304877458-15700339.jpg&fm=jpg',
      '.b4': 'https://images.pexels.com/photos/15138585/pexels-photo-15138585.jpeg?cs=srgb&dl=pexels-alpyildizlar-15138585.jpg&fm=jpg',
      '.gi1': 'https://images.pexels.com/photos/35654093/pexels-photo-35654093.jpeg?cs=srgb&dl=pexels-fidan-nazim-qizi-134456769-35654093.jpg&fm=jpg',
      '.gi2': 'https://images.pexels.com/photos/19120151/pexels-photo-19120151.jpeg?cs=srgb&dl=pexels-the-castlebar-3902897-19120151.jpg&fm=jpg',
      '.gi3': 'https://images.pexels.com/photos/20802562/pexels-photo-20802562.jpeg?cs=srgb&dl=pexels-change-c-c-974768353-20802562.jpg&fm=jpg',
      '.gi4': 'https://images.pexels.com/photos/28345131/pexels-photo-28345131.jpeg?cs=srgb&dl=pexels-celine-3776818-28345131.jpg&fm=jpg',
      '.gi5': 'https://images.pexels.com/photos/5490965/pexels-photo-5490965.jpeg?cs=srgb&dl=pexels-rachel-claire-5490965.jpg&fm=jpg',
      '.gi6': 'https://images.pexels.com/photos/29962517/pexels-photo-29962517.jpeg?cs=srgb&dl=pexels-valeriya-29962517.jpg&fm=jpg',
      '.gi7': 'https://images.pexels.com/photos/34491485/pexels-photo-34491485.jpeg?cs=srgb&dl=pexels-ufukiseloglu-34491485.jpg&fm=jpg',
      '.gi8': 'https://images.pexels.com/photos/32738701/pexels-photo-32738701.jpeg?cs=srgb&dl=pexels-richard-l-2150581203-32738701.jpg&fm=jpg'
    };

    Object.entries(imageMap).forEach(function(entry) {
      applyImage(entry[0], entry[1]);
    });
  }

  function applyStaticContent() {
    document.title = 'La Foca Cheria - Restaurante de Costa & Lounge | Santo Domingo Este';
    setMeta('meta[name="description"]', 'La Foca Cheria en Santo Domingo Este: cocina de mar, parrilla, cocteles tropicales y un ambiente ideal para compartir.');
    setMeta('meta[name="keywords"]', 'La Foca Cheria, restaurante en Santo Domingo Este, mariscos, parrilla, cocteles, menu con precios, reservaciones');
    setMeta('meta[property="og:title"]', 'La Foca Cheria - Restaurante de Costa & Lounge | Santo Domingo Este');
    setMeta('meta[property="og:description"]', 'Sabores del mar, parrilla y cocteles en un espacio pensado para almorzar, cenar y celebrar.');

    var navTexts = ['Experiencia', 'Servicios', 'Menu', 'Galeria', 'Resenas', 'Ubicacion', 'Reservar'];
    document.querySelectorAll('.nav-links a').forEach(function(link, i) {
      if (navTexts[i]) link.textContent = navTexts[i];
    });

    var sceneTexts = ['Cocteles Tropicales', 'Platos para Compartir', 'Cocina de Mar'];
    document.querySelectorAll('.scene-card span').forEach(function(el, i) {
      if (sceneTexts[i]) el.textContent = sceneTexts[i];
    });

    setText('.experience .section-eyebrow', 'Experiencia La Foca Cheria');
    var experienceTitle = document.querySelector('.experience .section-title');
    if (experienceTitle) experienceTitle.innerHTML = 'Todo lo que buscas<br /><em>en un solo lugar</em>';
    setText('.experience .section-desc', 'Un modulo pensado para vender platos, ambiente, comodidad y momentos para compartir.');

    var experienceItems = [
      ['Cocina de Mar', 'Pescados, mariscos y arroces preparados al momento'],
      ['Cocteles Frios', 'Tragos tropicales listos para mesa, afterwork o celebracion'],
      ['Vinos para Maridar', 'Opciones ligeras y reservas para pescado, salmon y parrilla'],
      ['Cervezas Bien Frias', 'Marcas populares para frituras, picaderas y mariscos'],
      ['Mesas para Grupos', 'Distribucion comoda para familia, amigos y celebraciones'],
      ['Eventos y Cumpleanos', 'Atencion para reservas, brindis y reuniones especiales'],
      ['Salon Principal', 'Un area comoda para comer con calma y tomar buenas fotos'],
      ['Terraza y Aire', 'Ambiente agradable para tardes activas y cenas relajadas'],
      ['Reserva Rapida', 'Proceso simple por WhatsApp para asegurar tu mesa'],
      ['Platos para Compartir', 'Parrilladas, mofongos y picaderas con buena salida'],
      ['Servicio Cercano', 'Atencion amable con enfoque en rapidez y experiencia'],
      ['Presentacion Cuidada', 'Cada plato ayuda a vender mejor desde la primera vista']
    ];
    document.querySelectorAll('.exp-item').forEach(function(item, i) {
      var title = item.querySelector('h3');
      var desc = item.querySelector('p');
      if (experienceItems[i]) {
        if (title) title.textContent = experienceItems[i][0];
        if (desc) desc.textContent = experienceItems[i][1];
      }
    });

    setText('.why-content .section-eyebrow', 'Por que visitarnos');
    var whyTitle = document.querySelector('.why-content .section-title');
    if (whyTitle) whyTitle.innerHTML = 'Lo que conecta<br /><em>con tus clientes</em>';
    var whyFeatures = [
      ['Menu claro y vendible', 'Platos, bebidas y precios presentados para facilitar la decision de compra.'],
      ['Imagenes reales de apetito', 'Las fotos refuerzan el valor percibido de mariscos, parrilla y cocteles.'],
      ['Ambiente para celebrar', 'El contenido comunica mesas para grupos, cumpleanos y buenos momentos.'],
      ['Reservacion directa', 'WhatsApp, telefono y llamados a la accion visibles en todo el flujo.'],
      ['Informacion util', 'Horarios, ubicacion, galeria y contacto sin huecos ni textos vacios.']
    ];
    document.querySelectorAll('.why-feat').forEach(function(item, i) {
      var title = item.querySelector('h4');
      var desc = item.querySelector('p');
      if (whyFeatures[i]) {
        if (title) title.textContent = whyFeatures[i][0];
        if (desc) desc.textContent = whyFeatures[i][1];
      }
    });

    setText('.services .section-eyebrow', 'Servicios Destacados');
    var servicesTitle = document.querySelector('.services .section-title');
    if (servicesTitle) servicesTitle.innerHTML = 'Una propuesta<br /><em>completa para vender</em>';

    setText('.menu-preview .section-eyebrow', 'Menu con Precios');
    var menuTitle = document.querySelector('.menu-preview .section-title');
    if (menuTitle) menuTitle.innerHTML = 'Sabores que invitan<br /><em>a ordenar mas</em>';
    var menuTabTexts = ['🍽 Comidas', '🍸 Cocteles', '🍷 Vinos', '🍺 Cervezas'];
    document.querySelectorAll('.mtab').forEach(function(tab, i) {
      if (menuTabTexts[i]) tab.textContent = menuTabTexts[i];
    });

    setText('.gallery .section-eyebrow', 'Galeria del Restaurante');
    var galleryTitle = document.querySelector('.gallery .section-title');
    if (galleryTitle) galleryTitle.innerHTML = 'Mira el ambiente<br /><em>antes de llegar</em>';

    setText('.testimonials .section-eyebrow', 'Lo que comentan del lugar');
    var testimonialsTitle = document.querySelector('.testimonials .section-title');
    if (testimonialsTitle) testimonialsTitle.innerHTML = 'Experiencias que<br /><em>ayudan a vender</em>';

    var reservationsTitle = document.querySelector('.reservations .section-title');
    if (reservationsTitle) reservationsTitle.innerHTML = 'Asegura tu<br /><em>mesa especial</em>';
    var reservationsInfo = document.querySelector('.res-info p');
    if (reservationsInfo) reservationsInfo.textContent = 'Reserva con tiempo y garantiza un espacio para comer bien, celebrar y compartir sin contratiempos.';

    setText('.location .section-eyebrow', 'Como Llegar');
    var locationTitle = document.querySelector('.location .section-title');
    if (locationTitle) locationTitle.innerHTML = 'Encuentranos en<br /><em>Santo Domingo Este</em>';

    var footerDescription = document.querySelector('.footer-brand p');
    if (footerDescription) footerDescription.textContent = 'La Foca Cheria combina cocina de mar, parrilla y cocteles en un formato pensado para atraer, informar y convertir visitas en reservas.';
    var footerBottom = document.querySelectorAll('.footer-bottom p');
    if (footerBottom[0]) footerBottom[0].textContent = '© 2024 La Foca Cheria. Todos los derechos reservados.';
    if (footerBottom[1]) footerBottom[1].textContent = 'Disenado para vender mejor en Santo Domingo';
    applyImagery();
  }

  /* General */
  applyStaticContent();
  const gen = loadCfg('general', SITE_DEFAULTS.general);
  if (gen) {
    // Logo
    document.querySelectorAll('.logo-text').forEach(el => { if (gen.name) el.textContent = gen.name; });
    document.querySelectorAll('.logo-sub').forEach(el  => { if (gen.tagline) el.textContent = gen.tagline; });

    // Stats (hero + why-us usan data-stat)
    document.querySelectorAll('[data-stat="rating"]').forEach(el => { if (gen.rating) el.textContent = gen.rating; });
    document.querySelectorAll('[data-stat="reviews"]').forEach(el => { if (gen.reviews) el.textContent = gen.reviews; });
    document.querySelectorAll('[data-stat="satisfaction"]').forEach(el => { if (gen.satisfaction) el.textContent = gen.satisfaction; });
    // rating-num: solo el número sin ? (para el badge del why-us)
    if (gen.rating) {
      document.querySelectorAll('[data-stat="rating-num"]').forEach(el => {
        el.textContent = gen.rating.replace(/[^\d.]/g, '');
      });
    }

    // Teléfono
    document.querySelectorAll('a[href^="tel:"]').forEach(a => { if (gen.phone) a.href = 'tel:' + gen.phone.replace(/\D/g,''); });
    document.querySelectorAll('[data-loc="phone"]').forEach(el => { if (gen.phone) el.textContent = gen.phone; });
    document.querySelectorAll('[data-fc="phone"]').forEach(el  => { if (gen.phone) el.textContent = '?? ' + gen.phone; });

    // Email
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => { if (gen.email) a.href = 'mailto:' + gen.email; });
    document.querySelectorAll('[data-fc="email"]').forEach(el => { if (gen.email) el.textContent = '?? ' + gen.email; });

    // WhatsApp links
    const social0 = loadCfg('social', SITE_DEFAULTS.social);
    const waMsg = (social0 && social0.wa_msg) ? social0.wa_msg : 'Hola, quisiera hacer una reservación en Velvet';
    document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
      if (gen.whatsapp) a.href = 'https://wa.me/' + gen.whatsapp + '?text=' + encodeURIComponent(waMsg);
    });

    // Dirección
    document.querySelectorAll('[data-loc="address"]').forEach(el => { if (gen.address) el.textContent = gen.address; });
    document.querySelectorAll('[data-fc="address"]').forEach(el  => { if (gen.address) el.textContent = '?? ' + gen.address; });

    // Maps
    if (gen.mapslink) document.querySelectorAll('a[href*="maps.google"]').forEach(a => a.href = gen.mapslink);
    if (gen.mapembed) { const iframe = document.querySelector('.loc-map iframe'); if (iframe) iframe.src = gen.mapembed; }
  }

  /* Hero */
  const hero = loadCfg('hero', SITE_DEFAULTS.hero);
  if (hero) {
    if (hero.badge)    setText('.hero-badge span:last-child', hero.badge);
    if (hero.title1 || hero.title2 || hero.title3) {
      const titleEl = document.querySelector('.hero-title');
      if (titleEl) titleEl.innerHTML = `${hero.title1 || ''}<br /><em>${hero.title2 || ''}</em><br />${hero.title3 || ''}`;
    }
    if (hero.subtitle) setText('.hero-subtitle', hero.subtitle);
    if (hero.btn1) { const b1 = document.querySelector('.hero-buttons .btn-primary span'); if (b1) b1.textContent = hero.btn1; }
    if (hero.btn2) { const b2 = document.querySelector('.hero-buttons .btn-ghost span');   if (b2) b2.textContent = hero.btn2; }
  }

  /* Horarios */
  const hours = loadCfg('hours', SITE_DEFAULTS.hours);
  if (hours && hours.length) {
    // Reservations section (.rh-row)
    const containers = document.querySelectorAll('.rh-row');
    containers.forEach((row, i) => {
      if (hours[i]) {
        const spans = row.querySelectorAll('span');
        if (spans[0]) spans[0].textContent = hours[i].days;
        if (spans[1]) spans[1].textContent = hours[i].open + ' – ' + hours[i].close;
      }
    });
    // Location section hours block
    document.querySelectorAll('[data-loc="hours"]').forEach(el => {
      el.innerHTML = hours.map(h => h.days + ': ' + h.open + ' – ' + h.close).join('<br />');
    });
    // Footer hours
    document.querySelectorAll('[data-fc="hours"]').forEach(el => {
      el.textContent = '?? ' + hours.map(h => h.days + ': ' + h.open + '–' + h.close).join(' · ');
    });
  }

  /* Redes sociales */
  const social = loadCfg('social', SITE_DEFAULTS.social);
  if (social) {
    if (social.instagram) document.querySelectorAll('.social-link.instagram, .footer-social a[aria-label="Instagram"]').forEach(a => a.href = social.instagram);
    if (social.facebook)  document.querySelectorAll('.social-link.facebook,  .footer-social a[aria-label="Facebook"]').forEach(a  => a.href = social.facebook);
    if (social.tiktok)    document.querySelectorAll('.social-link.tiktok,    .footer-social a[aria-label="TikTok"]').forEach(a    => a.href = social.tiktok);
    if (social.youtube)   document.querySelectorAll('.footer-social a[aria-label="YouTube"]').forEach(a => a.href = social.youtube);
    // WhatsApp tooltip del botón flotante
    if (social.wa_tooltip) {
      const waFloat = document.querySelector('.wa-float');
      if (waFloat) waFloat.setAttribute('title', social.wa_tooltip);
    }
  }

  /* Menú */
  const menuData = loadCfg('menu', SITE_DEFAULTS.menu);
  if (menuData) {
    const catMap = { food: 'food', cocktails: 'cocktails', wines: 'wines', beers: 'beers' };
    const cssMap = {
      food: ['food1','food2','food3','food4','food5','food6'],
      cocktails: ['ck1','ck2','ck3','ck4','ck5','ck6'],
      wines: ['w1','w2','w3','w4'],
      beers: ['b1','b2','b3','b4']
    };
    Object.entries(catMap).forEach(([cat, tabId]) => {
      const panel = document.getElementById('tab-' + tabId);
      if (!panel || !menuData[cat]) return;
      const grid = panel.querySelector('.menu-grid');
      if (!grid) return;
      grid.innerHTML = menuData[cat].map((item, i) => `
        <div class="menu-item">
          <div class="mi-img ${(cssMap[cat] || [])[i] || 'food1'}"></div>
          <div class="mi-info">
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
            <span class="mi-price">${item.price}</span>
          </div>
        </div>
      `).join('');
    });
    applyImagery();
  }

  /* Testimonios */
  const testis = loadCfg('testimonials', SITE_DEFAULTS.testimonials);
  if (testis && testis.length) {
    const avColors = ['av1','av2','av3','av4','av5','av6'];
    const track = document.getElementById('testiTrack');
    if (track) {
      track.innerHTML = testis.map((t, i) => `
        <div class="testi-card">
          <div class="tc-header">
            <div class="tc-avatar ${avColors[i % avColors.length]}"></div>
            <div><h4>${t.name}</h4><div class="tc-stars">${t.rating}</div></div>
            <span class="tc-date">${t.date}</span>
          </div>
          <p>"${t.text}"</p>
          <div class="tc-source">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google Review
          </div>
        </div>
      `).join('');
    }
  }

  /* Servicios */
  const svcs = loadCfg('services', SITE_DEFAULTS.services);
  if (svcs && svcs.length) {
    const grid = document.querySelector('.services-grid');
    if (grid) {
      grid.innerHTML = svcs.map((s, i) => `
        <div class="service-card reveal" data-delay="${i * 100}">
          <div class="svc-glow"></div>
          <div class="svc-icon">${s.icon}</div>
          <h3>${s.name}</h3>
          <p>${s.desc}</p>
          ${s.link ? `<a href="${s.link}" class="svc-link">${s.linkText || 'Ver más ?'}</a>` : ''}
        </div>
      `).join('');
      // Re-observe new cards
      grid.querySelectorAll('.service-card').forEach(el => {
        if (typeof io !== 'undefined') io.observe(el);
      });
    }
  }

  /* Galería — textos + imágenes subidas desde el admin */
  const galleryItems = document.querySelectorAll('.g-item');
  const galleryData  = loadCfg('gallery', SITE_DEFAULTS.gallery);

  galleryItems.forEach(function(el, i) {
    /* Textos desde admin */
    if (galleryData && galleryData[i]) {
      const cat   = el.querySelector('.g-cat');
      const title = el.querySelector('.g-overlay h4');
      if (cat)   cat.textContent   = galleryData[i].cat;
      if (title) title.textContent = galleryData[i].title;
    }
    /* Imagen subida desde el admin */
    const storedImg = localStorage.getItem('velvet_gallery_img_' + i);
    if (storedImg) {
      const imgDiv = el.querySelector('.g-img');
      if (imgDiv) {
        imgDiv.style.backgroundImage    = 'url(' + storedImg + ')';
        imgDiv.style.backgroundSize     = 'cover';
        imgDiv.style.backgroundPosition = 'center';
      }
    }
  });
  applyImagery();

  /* Amenidades */
  const amenities = loadCfg('amenities', null);
  if (amenities && amenities.length) {
    const grid = document.querySelector('.amen-grid');
    if (grid) {
      grid.innerHTML = amenities.map(card => `
        <div class="amen-card">
          <h3>${card.icon || ''} ${card.title || ''}</h3>
          <ul>
            ${(Array.isArray(card.items) ? card.items : []).map(item => `<li>&#10003; ${item}</li>`).join('')}
          </ul>
        </div>
      `).join('');
      /* Re-observar nuevas tarjetas para la animación reveal */
      grid.querySelectorAll('.amen-card').forEach(el => {
        if (typeof io !== 'undefined') io.observe(el);
      });
    }
  }

  /* Experiencia (exp-grid) */
  const experience = loadCfg('experience', null);
  if (experience && experience.length) {
    const expGrid = document.querySelector('.exp-grid');
    if (expGrid) {
      expGrid.innerHTML = experience.map((item, i) => `
        <div class="exp-item" data-delay="${i * 50}">
          <div class="exp-icon">${item.icon || '?'}</div>
          <h3>${item.title || ''}</h3>
          <p>${item.desc || ''}</p>
        </div>
      `).join('');
      expGrid.querySelectorAll('.exp-item').forEach(el => {
        if (typeof io !== 'undefined') io.observe(el);
      });
    }
  }

  /* ¿Por qué nosotros? (why-features) */
  const whyus = loadCfg('whyus', null);
  if (whyus && whyus.length) {
    const whyFeatures = document.querySelector('.why-features');
    if (whyFeatures) {
      whyFeatures.innerHTML = whyus.map(item => `
        <div class="why-feat">
          <div class="wf-check">?</div>
          <div>
            <h4>${item.title || ''}</h4>
            <p>${item.desc || ''}</p>
          </div>
        </div>
      `).join('');
    }
  }

  function setText(selector, text) {
    if (!text) return;
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }
}

/* ------------------------------------------------------
   SINCRONIZACIÓN EN TIEMPO REAL — Firebase Realtime DB
   3 mecanismos en paralelo para máxima confiabilidad:
   1. Carga inicial al abrir la página
   2. Server-Sent Events (instantáneo cuando admin guarda)
   3. Polling cada 4 segundos (respaldo garantizado)
------------------------------------------------------ */
(function initCloudSync() {
  var RTDB = 'https://lafocacheria-default-rtdb.firebaseio.com/velvet';
  var lastVersion = null; /* Detecta si los datos cambiaron antes de re-aplicar */
  var cloudApplied = false;
  var fallbackTimer = setTimeout(function() {
    if (!cloudApplied) applySiteConfig();
  }, 1200);

  /* Aplica config de la nube al DOM */
  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    /* Evitar re-renders innecesarios comparando versión */
    var incomingVersion = data._updated || JSON.stringify(data).length;
    if (incomingVersion === lastVersion) return;
    lastVersion = incomingVersion;
    cloudApplied = true;
    clearTimeout(fallbackTimer);

    var keys = ['general','hero','menu','services','testimonials',
                'hours','social','gallery','colors','closedMsg','amenities',
                'experience','whyus'];
    keys.forEach(function(key) {
      if (data[key] !== undefined)
        localStorage.setItem('velvet_' + key, JSON.stringify(data[key]));
    });

    /* Imágenes de galería (almacenadas como base64) */
    if (data._gallery_imgs && typeof data._gallery_imgs === 'object') {
      Object.entries(data._gallery_imgs).forEach(function(entry) {
        if (entry[1]) localStorage.setItem('velvet_gallery_img_' + entry[0], entry[1]);
      });
    }

    applySiteConfig();
  }

  /* ? Carga inicial */
  function fetchConfig() {
    return fetch(RTDB + '.json?ts=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) { if (data) applyFromCloud(data); })
      .catch(function() {});
  }
  fetchConfig();

  /* ? Server-Sent Events — instantáneo */
  try {
    var es = new EventSource(RTDB + '.json');
    es.addEventListener('put', function(e) {
      try {
        var payload = JSON.parse(e.data);
        var cfg = payload.path === '/' ? payload.data : null;
        if (cfg) applyFromCloud(cfg);
      } catch(err) {}
    });
    /* Si SSE falla, el polling lo cubre */
    es.onerror = function() { try { es.close(); } catch(e) {} };
  } catch(err) {}

  /* ? Polling cada 4 segundos — garantía absoluta */
  setInterval(fetchConfig, 2500);

  window.addEventListener('pageshow', fetchConfig);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) fetchConfig();
  });

  /* ? Storage event — mismo navegador, otra pestaña */
  window.addEventListener('storage', function(e) {
    if (!e.key || e.key.startsWith('velvet_')) applySiteConfig();
  });
})();

(function initLafoAssistant() {
  var LAFO_RTDB = 'https://lafocacheria-default-rtdb.firebaseio.com/lafo_public';
  var LAFO_REQUESTS_RTDB = 'https://lafocacheria-default-rtdb.firebaseio.com/lafo_requests';
  var lafoState = { platos: [], producciones: [], summary: null, updatedAt: 0 };
  var lafoSeeded = false;

  function saludoCamareroLafo() {
    var saludos = [
      'Bienvenido, aqui te atiende Lafo.',
      'A la orden, soy Lafo.',
      'Estoy contigo para ayudarte a pedir bien.'
    ];
    return saludos[Math.floor(Math.random() * saludos.length)];
  }

  function tonoCamareroLafo(texto, modo) {
    var base = String(texto || '').trim();
    if (!base) return base;
    if (/^Hola, soy <strong>Lafo<\/strong>\./.test(base)) {
      return base.replace('Hola, soy <strong>Lafo</strong>.', saludoCamareroLafo() + ' Soy <strong>Lafo</strong>.');
    }
    if (/^Te puedo servir/.test(base)) {
      return 'Ahora mismo te puedo ofrecer esto desde cocina:' + base.replace(/^Te puedo servir estos platos ahora mismo:/, '');
    }
    if (/^Te recomiendo/.test(base) || /^Hoy te recomiendo/.test(base)) {
      return 'Mi recomendacion como camarero es esta: ' + base;
    }
    if (/^Estos platos/.test(base)) {
      return 'Te hablo claro para cuidarte el pedido: ' + base;
    }
    if (/^Hay algunos platos/.test(base)) {
      return 'Te aviso como camarero: ' + base;
    }
    if (/^Te lo explico/.test(base)) {
      return 'Con gusto te lo explico como en mesa: ' + base;
    }
    if (modo && modo.isBrief) return 'A la orden. ' + base;
    return base;
  }

  function inferirIntentoLafo(consulta) {
    var texto = normalizarConsultaLafo(consulta);
    if (/marisc|camaron|pescad|chillo|salmon/.test(texto)) return 'mariscos';
    if (/compart|grupo|familia|picar/.test(texto)) return 'compartir';
    if (/pasta|risotto|arroz/.test(texto)) return 'pasta-arroz';
    if (/parrill|carne|brasa/.test(texto)) return 'parrilla';
    if (/agotad|sin stock/.test(texto)) return 'stock-agotado';
    if (/limitad|queda poco/.test(texto)) return 'stock-limitado';
    if (/menu|disponible|pedir/.test(texto)) return 'consulta-menu';
    if (/explica|ayudame|no entiendo/.test(texto)) return 'orientacion';
    return 'general';
  }

  function registrarSolicitudLafo(prompt, respuesta, meta) {
    var consulta = String(prompt || '').trim();
    var answer = String(respuesta || '').trim();
    if (!consulta || !answer) return;
    var payload = {
      createdAt: new Date().toISOString(),
      prompt: consulta.slice(0, 500),
      normalizedPrompt: normalizarConsultaLafo(consulta).slice(0, 500),
      response: answer.slice(0, 1200),
      intent: inferirIntentoLafo(consulta),
      source: 'lafocacheria-web',
      page: location.pathname || '/',
      snapshotUpdatedAt: Number(lafoState.updatedAt || 0),
      summary: {
        disponibles: platosDisponiblesLafo().length,
        limitados: platosLimitadosLafo().length,
        agotados: platosAgotadosLafo().length
      },
      topAvailable: platosDisponiblesLafo().slice(0, 3).map(function(item) {
        return {
          nombre: String(item.nombre || ''),
          stock: Number(item.stock || 0),
          estado: String(item.estado || '')
        };
      }),
      meta: meta || {}
    };
    try {
      var localKey = 'lafo_requests_local';
      var prev = JSON.parse(localStorage.getItem(localKey) || '[]');
      if (!Array.isArray(prev)) prev = [];
      prev.unshift(payload);
      localStorage.setItem(localKey, JSON.stringify(prev.slice(0, 120)));
    } catch (_) {}
    fetch(LAFO_REQUESTS_RTDB + '.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function() {});
  }

  function lafoRefs() {
    return {
      fab: document.getElementById('lafoFab'),
      panel: document.getElementById('lafoPanel'),
      close: document.getElementById('lafoClose'),
      status: document.getElementById('lafoStatus'),
      messages: document.getElementById('lafoMessages'),
      form: document.getElementById('lafoForm'),
      input: document.getElementById('lafoInput'),
      countAvailable: document.getElementById('lafoCountAvailable'),
      countLimited: document.getElementById('lafoCountLimited'),
      countSoldOut: document.getElementById('lafoCountSoldOut')
    };
  }

  function normalizarLafo(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function normalizarConsultaLafo(texto) {
    var value = ' ' + normalizarLafo(texto) + ' ';
    var reemplazos = [
      [/\bq\b/g, ' que '],
      [/\bk\b/g, ' que '],
      [/\bke\b/g, ' que '],
      [/\baki\b/g, ' aqui '],
      [/\btoy\b/g, ' estoy '],
      [/\bpa\b/g, ' para '],
      [/\bpk\b/g, ' porque '],
      [/\bxf?a\b/g, ' por favor '],
      [/\bmarico\b/g, ' marisco '],
      [/\bcamarone?s\b/g, ' camarones '],
      [/\bmofon?go\b/g, ' mofongo '],
      [/\bparriya\b/g, ' parrilla '],
      [/\brisoto\b/g, ' risotto '],
      [/\bsalmonn?\b/g, ' salmon '],
      [/\brecomiendame\b/g, ' recomendame '],
      [/\bdisponivilidad\b/g, ' disponibilidad '],
      [/\bagotao?s?\b/g, ' agotado '],
      [/\blimitao?s?\b/g, ' limitado ']
    ];
    reemplazos.forEach(function(entry) {
      value = value.replace(entry[0], entry[1]);
    });
    return value.replace(/\s+/g, ' ').trim();
  }

  function detectarModoLafo(entrada) {
    var raw = String(entrada || '').trim();
    var normal = normalizarConsultaLafo(raw);
    return {
      raw: raw,
      normal: normal,
      isBrief: normal.split(/\s+/).filter(Boolean).length <= 4,
      needsDidactic: /(no se|explica|explicame|ayudame|soy nuevo|no entiendo|como funciona|que significa)/.test(normal),
      excited: /[!?]{2,}|^[A-Z0-9\s]+$/.test(raw) && raw.length > 4
    };
  }

  function escaparHtml(texto) {
    return String(texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function precioLafo(valor) {
    var n = Number(valor || 0);
    return n > 0 ? ('RD$ ' + n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })) : 'Consultar';
  }

  function menuIndexLafo() {
    var cfg = null;
    try {
      cfg = JSON.parse(localStorage.getItem('velvet_menu') || 'null');
    } catch (_) {}
    var base = (cfg && typeof cfg === 'object') ? cfg : SITE_DEFAULTS.menu;
    var all = []
      .concat(Array.isArray(base.food) ? base.food : [])
      .concat(Array.isArray(base.cocktails) ? base.cocktails : [])
      .concat(Array.isArray(base.wines) ? base.wines : [])
      .concat(Array.isArray(base.beers) ? base.beers : []);
    var index = {};
    all.forEach(function(item) {
      index[normalizarLafo(item.name)] = item;
    });
    return index;
  }

  function enriquecerPlatoLafo(plato) {
    var menu = menuIndexLafo();
    var info = menu[normalizarLafo(plato.nombre)] || null;
    return {
      nombre: plato.nombre,
      precio: info && info.price ? info.price : precioLafo(plato.precio),
      desc: info && info.desc ? info.desc : '',
      estado: plato.estado,
      stock: Number(plato.stock || 0),
      faltantes: Array.isArray(plato.faltantes) ? plato.faltantes : []
    };
  }

  function platosDisponiblesLafo() {
    return (Array.isArray(lafoState.platos) ? lafoState.platos : []).filter(function(item) {
      return item.estado !== 'agotado' && Number(item.stock || 0) > 0;
    });
  }

  function platosLimitadosLafo() {
    return (Array.isArray(lafoState.platos) ? lafoState.platos : []).filter(function(item) {
      return item.estado === 'limitado' && Number(item.stock || 0) > 0;
    });
  }

  function platosAgotadosLafo() {
    return (Array.isArray(lafoState.platos) ? lafoState.platos : []).filter(function(item) {
      return item.estado === 'agotado' || Number(item.stock || 0) <= 0;
    });
  }

  function actualizarResumenLafo() {
    var refs = lafoRefs();
    if (refs.countAvailable) refs.countAvailable.textContent = String(platosDisponiblesLafo().length);
    if (refs.countLimited) refs.countLimited.textContent = String(platosLimitadosLafo().length);
    if (refs.countSoldOut) refs.countSoldOut.textContent = String(platosAgotadosLafo().length);
  }

  function actualizarEstadoLafo(msg) {
    var refs = lafoRefs();
    if (refs.status) refs.status.textContent = msg;
  }

  function abrirLafo() {
    var refs = lafoRefs();
    if (!refs.panel) return;
    refs.panel.classList.add('open');
    refs.panel.setAttribute('aria-hidden', 'false');
    if (refs.input) refs.input.focus();
    sembrarSaludoLafo();
  }

  function cerrarLafo() {
    var refs = lafoRefs();
    if (!refs.panel) return;
    refs.panel.classList.remove('open');
    refs.panel.setAttribute('aria-hidden', 'true');
  }

  function agregarMensajeLafo(role, html) {
    var refs = lafoRefs();
    if (!refs.messages) return;
    var wrap = document.createElement('div');
    wrap.className = 'lafo-msg ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'lafo-bubble';
    bubble.innerHTML = html;
    wrap.appendChild(bubble);
    refs.messages.appendChild(wrap);
    refs.messages.scrollTop = refs.messages.scrollHeight;
  }

  function renderizarPillsLafo(platos) {
    if (!platos.length) return '';
    return '<div class="lafo-menu-pills">' + platos.slice(0, 4).map(function(item) {
      return '<span>' + escaparHtml(item.nombre) + ' · ' + escaparHtml(item.precio) + '</span>';
    }).join('') + '</div>';
  }

  function construirMensajeBienvenidaLafo() {
    var disponibles = platosDisponiblesLafo().map(enriquecerPlatoLafo);
    if (!disponibles.length) {
      return 'Ahora mismo no tengo platos confirmados para ofrecerte. Si gustas, puedo decirte cuando la cocina vuelva a tener salida.';
    }
    var top = disponibles.slice(0, 3);
    return 'Hola, soy <strong>Lafo</strong>. Bienvenido. Estoy para ayudarte a elegir algo rico para comer. Si quieres, puedo recomendarte segun lo que te apetezca hoy.' + renderizarPillsLafo(top);
  }

  function sembrarSaludoLafo() {
    if (lafoSeeded) return;
    lafoSeeded = true;
    agregarMensajeLafo('assistant', tonoCamareroLafo(construirMensajeBienvenidaLafo(), { isBrief: false }));
  }

  function coincidePreferenciaLafo(nombre, consulta) {
    var n = normalizarLafo(nombre);
    if (/marisc|camaron|pescad|chillo|salmon|mar/.test(consulta)) return /(marisc|camaron|chillo|salmon|marinero|pescad)/.test(n);
    if (/compart|grupo|familia|picar/.test(consulta)) return /(parrillada|picadera|mofongo)/.test(n);
    if (/pasta/.test(consulta)) return /pasta/.test(n);
    if (/arroz|risotto/.test(consulta)) return /(risotto|arroz)/.test(n);
    if (/parrill|carne|brasa/.test(consulta)) return /(parrill|brasa)/.test(n);
    if (/liger|suave/.test(consulta)) return /(salmon|pasta|chillo)/.test(n);
    return true;
  }

  function recomendarPlatosLafo(consulta) {
    var disponibles = platosDisponiblesLafo().map(enriquecerPlatoLafo);
    if (!disponibles.length) return [];
    var filtrados = disponibles.filter(function(item) {
      return coincidePreferenciaLafo(item.nombre, consulta);
    });
    var base = filtrados.length ? filtrados : disponibles;
    return base.sort(function(a, b) { return b.stock - a.stock || a.nombre.localeCompare(b.nombre); }).slice(0, 3);
  }

  function explicarEstadoLafo(item) {
    if (!item) return '';
    if (item.estado === 'agotado') return 'No lo ofrezco porque ahora mismo no tiene salida real.';
    if (item.estado === 'limitado') return 'Sí puede salir, pero queda poco stock y conviene pedirlo pronto.';
    return 'Está disponible con respaldo real en cocina.';
  }

  function construirRespuestaDidacticaLafo(recomendados) {
    if (!recomendados.length) {
      return 'Te lo explico fácil: yo solo recomiendo platos que tienen salida real en cocina. Si ahora no tengo uno disponible, prefiero decírtelo claro antes que inventarte una opción.';
    }
    var principal = recomendados[0];
    return 'Te lo explico fácil: en este momento te recomiendo <strong>' + escaparHtml(principal.nombre) + '</strong> porque está listo para servirse. Precio: <strong>' + escaparHtml(principal.precio) + '</strong>.' + renderizarPillsLafo(recomendados);
  }

  function respuestaLafo(entrada) {
    var modo = detectarModoLafo(entrada);
    var consulta = modo.normal;
    var disponibles = platosDisponiblesLafo().map(enriquecerPlatoLafo);
    var limitados = platosLimitadosLafo().map(enriquecerPlatoLafo);
    var agotados = platosAgotadosLafo().map(enriquecerPlatoLafo);

    if (!lafoState.updatedAt) {
      return 'Un momentito, estoy organizando el menú para atenderte mejor. Enseguida te doy una recomendación.';
    }

    if (!consulta || /hola|buenas|hey/.test(consulta)) {
      return construirMensajeBienvenidaLafo();
    }

    if (modo.needsDidactic) {
      return construirRespuestaDidacticaLafo(recomendarPlatosLafo(consulta));
    }

    if (/agotad|no hay|sin stock/.test(consulta)) {
      if (!agotados.length) return 'Ahora mismo no tengo platos agotados reportados. Lo que te ofrezca puede salir desde cocina.';
      return 'Estos platos no debo ofrecerlos ahora mismo: <strong>' + agotados.slice(0, 4).map(function(item) { return escaparHtml(item.nombre); }).join(', ') + '</strong>.';
    }

    if (/limitad|poco|queda poco/.test(consulta)) {
      if (!limitados.length) return 'En este momento no tengo platos con existencia limitada. La salida está bastante estable.';
      return 'Hay algunos platos con salida corta: <strong>' + limitados.slice(0, 4).map(function(item) { return escaparHtml(item.nombre); }).join(', ') + '</strong>. Si te gusta uno de esos, te recomiendo pedirlo pronto.';
    }

    if (/disponible|que hay|menu|que puedo pedir/.test(consulta)) {
      if (!disponibles.length) return 'No tengo platos disponibles confirmados ahora mismo.';
      return 'Te puedo servir estos platos ahora mismo:' + renderizarPillsLafo(disponibles.slice(0, 4));
    }

    if (/produccion|cocina|interna/.test(consulta)) {
      var producciones = (Array.isArray(lafoState.producciones) ? lafoState.producciones : []).filter(function(item) {
        return item.estado !== 'agotado';
      }).slice(0, 4);
      if (!producciones.length) return 'No veo producciones internas activas para apoyarme en este momento.';
      return 'Hoy la cocina tiene buena base para servirte con agilidad. Entre lo que más se está moviendo ahora mismo está: <strong>' + producciones.map(function(item) {
        return escaparHtml(item.nombre) + ' (' + escaparHtml(String(item.actual)) + ' ' + escaparHtml(item.unidad || '') + ')';
      }).join(', ') + '</strong>.';
    }

    var recomendados = recomendarPlatosLafo(consulta);
    if (!recomendados.length) {
      return modo.isBrief
        ? 'Puedo ayudarte mejor si me dices una pista corta: mariscos, parrilla, pasta o para compartir.'
        : 'No encontré una coincidencia clara con eso, pero puedo ayudarte si me dices si quieres mariscos, algo a la brasa, pasta o un plato para compartir.';
    }

    var principal = recomendados[0];
    var intro = /recom|indecis|hoy|suger/.test(consulta)
      ? 'Hoy te recomiendo <strong>' + escaparHtml(principal.nombre) + '</strong> porque está disponible y listo para servir.'
      : 'Te recomiendo <strong>' + escaparHtml(principal.nombre) + '</strong>.';

    var detalle = principal.desc ? ' ' + escaparHtml(principal.desc) + '.' : '';
    var cierre = principal.stock <= 3
      ? ' Queda limitado, así que conviene pedirlo pronto.'
      : ' Tiene buena salida disponible ahora mismo.';

    if (modo.excited) {
      intro = 'Claro. ' + intro;
    }

    return tonoCamareroLafo(intro + detalle + ' Precio: <strong>' + escaparHtml(principal.precio) + '</strong>. ' + explicarEstadoLafo(principal) + cierre + renderizarPillsLafo(recomendados), modo);
  }

  function manejarEnvioLafo(texto) {
    var limpio = String(texto || '').trim();
    if (!limpio) return;
    agregarMensajeLafo('user', escaparHtml(limpio));
    var respuesta = respuestaLafo(limpio);
    agregarMensajeLafo('assistant', respuesta);
    registrarSolicitudLafo(
      limpio,
      respuesta.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      {
        didactic: detectarModoLafo(limpio).needsDidactic === true,
        availableCount: platosDisponiblesLafo().length
      }
    );
  }

  function aplicarSnapshotLafo(data) {
    if (!data || typeof data !== 'object') return;
    lafoState = {
      platos: Array.isArray(data.platos) ? data.platos : [],
      producciones: Array.isArray(data.producciones) ? data.producciones : [],
      summary: data.summary || null,
      updatedAt: Number(data._updated || 0)
    };
    actualizarResumenLafo();
    actualizarEstadoLafo(lafoState.updatedAt ? 'Listo para ayudarte con el menú.' : 'Preparando recomendaciones para ti.');
    if (lafoSeeded && lafoRefs().messages && lafoRefs().messages.children.length <= 2) {
      lafoRefs().messages.innerHTML = '';
      lafoSeeded = false;
      sembrarSaludoLafo();
    }
  }

  function fetchSnapshotLafo() {
    return fetch(LAFO_RTDB + '.json?ts=' + Date.now(), { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) { if (data) aplicarSnapshotLafo(data); })
      .catch(function() {
        actualizarEstadoLafo('Sin respuesta operativa en este momento.');
      });
  }

  var refs = lafoRefs();
  if (!refs.fab || !refs.panel) return;

  refs.fab.addEventListener('click', abrirLafo);
  if (refs.close) refs.close.addEventListener('click', cerrarLafo);
  document.querySelectorAll('[data-lafo-prompt]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      abrirLafo();
      manejarEnvioLafo(btn.getAttribute('data-lafo-prompt') || '');
    });
  });
  if (refs.form) {
    refs.form.addEventListener('submit', function(e) {
      e.preventDefault();
      var value = refs.input ? refs.input.value : '';
      manejarEnvioLafo(value);
      if (refs.input) refs.input.value = '';
    });
  }

  fetchSnapshotLafo();
  setInterval(fetchSnapshotLafo, 5000);
  window.addEventListener('pageshow', fetchSnapshotLafo);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) fetchSnapshotLafo();
  });
})();

/* --- Navbar scroll --- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
  document.getElementById('backTop').classList.toggle('visible', window.scrollY > 400);
});

/* --- Hamburger --- */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

/* --- Back to top --- */
document.getElementById('backTop').addEventListener('click', () =>
  window.scrollTo({ top: 0, behavior: 'smooth' })
);

/* --- Hero particles --- */
(function spawnParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      animation-duration:${Math.random()*12+8}s;
      animation-delay:${Math.random()*10}s;
      opacity:0;
    `;
    container.appendChild(p);
  }
})();

/* --- Intersection Observer (reveal) --- */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      const delay = el.dataset.delay ? parseInt(el.dataset.delay) : 0;
      setTimeout(() => el.classList.add('visible'), delay);
      io.unobserve(el);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(
  '.exp-item, .service-card, .why-feat, .reveal, .amen-card'
).forEach(el => io.observe(el));

/* --- Menu tabs --- */
document.querySelectorAll('.mtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

/* --- Testimonials slider --- */
(function initSlider() {
  const track  = document.getElementById('testiTrack');
  const cards  = track.querySelectorAll('.testi-card');
  const dotsEl = document.getElementById('testiDots');
  let current  = 0;
  let perView  = window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 3;
  let total    = Math.ceil(cards.length / perView);
  let autoId;

  function buildDots() {
    dotsEl.innerHTML = '';
    total = Math.ceil(cards.length / perView);
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className = 'tc-dot' + (i === current ? ' active' : '');
      d.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(d);
    }
  }

  function goTo(idx) {
    current = (idx + total) % total;
    const cardWidth = cards[0].offsetWidth + 24;
    track.style.transform = `translateX(-${current * perView * cardWidth}px)`;
    dotsEl.querySelectorAll('.tc-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
  }

  function next() { goTo(current + 1); }
  function startAuto() { autoId = setInterval(next, 4000); }
  function stopAuto()  { clearInterval(autoId); }

  document.getElementById('testiNext').addEventListener('click', () => { stopAuto(); goTo(current + 1); startAuto(); });
  document.getElementById('testiPrev').addEventListener('click', () => { stopAuto(); goTo(current - 1); startAuto(); });

  window.addEventListener('resize', () => {
    perView = window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 3;
    current = 0;
    track.style.transform = 'translateX(0)';
    buildDots();
  });

  buildDots();
  startAuto();
})();

/* --- Gallery lightbox --- */
(function initGallery() {
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lbImg');
  const lbCaption = document.getElementById('lbCaption');

  document.querySelectorAll('.g-item').forEach(item => {
    item.addEventListener('click', () => {
      const imgEl    = item.querySelector('.g-img');
      const caption  = item.querySelector('.g-overlay h4')?.textContent || '';
      const bg       = window.getComputedStyle(imgEl).background;

      lbImg.style.cssText = `
        width: 600px; height: 380px;
        background: ${bg};
        background-size: cover;
        background-position: center;
      `;
      lbCaption.textContent = caption;
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  document.getElementById('lbClose').addEventListener('click', closeLb);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLb(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });

  function closeLb() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }
})();

/* --- Reservation form --- */
document.getElementById('reservationForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  setTimeout(() => {
    document.getElementById('formSuccess').classList.add('show');
    this.reset();
    btn.textContent = 'Reservar Ahora';
    btn.disabled = false;
  }, 1200);
});

/* --- Smooth anchor scroll with offset --- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* --- Set min date for reservation --- */
(function setMinDate() {
  const dateInput = document.querySelector('input[name="date"]');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }
})();

