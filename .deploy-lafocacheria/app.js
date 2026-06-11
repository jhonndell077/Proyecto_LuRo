/* ═══════════════════════════════════════════════════════
   VELVET — app.js
   Lee configuración dinámica guardada desde admin.html
═══════════════════════════════════════════════════════ */

/* ─── Leer datos del admin panel ─── */
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

  /* General */
  const gen = loadCfg('general', null);
  if (gen) {
    // Logo
    document.querySelectorAll('.logo-text').forEach(el => { if (gen.name) el.textContent = gen.name; });
    document.querySelectorAll('.logo-sub').forEach(el  => { if (gen.tagline) el.textContent = gen.tagline; });

    // Stats (hero + why-us usan data-stat)
    document.querySelectorAll('[data-stat="rating"]').forEach(el => { if (gen.rating) el.textContent = gen.rating; });
    document.querySelectorAll('[data-stat="reviews"]').forEach(el => { if (gen.reviews) el.textContent = gen.reviews; });
    document.querySelectorAll('[data-stat="satisfaction"]').forEach(el => { if (gen.satisfaction) el.textContent = gen.satisfaction; });
    // rating-num: solo el número sin ★ (para el badge del why-us)
    if (gen.rating) {
      document.querySelectorAll('[data-stat="rating-num"]').forEach(el => {
        el.textContent = gen.rating.replace(/[^\d.]/g, '');
      });
    }

    // Teléfono
    document.querySelectorAll('a[href^="tel:"]').forEach(a => { if (gen.phone) a.href = 'tel:' + gen.phone.replace(/\D/g,''); });
    document.querySelectorAll('[data-loc="phone"]').forEach(el => { if (gen.phone) el.textContent = gen.phone; });
    document.querySelectorAll('[data-fc="phone"]').forEach(el  => { if (gen.phone) el.textContent = '📞 ' + gen.phone; });

    // Email
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => { if (gen.email) a.href = 'mailto:' + gen.email; });
    document.querySelectorAll('[data-fc="email"]').forEach(el => { if (gen.email) el.textContent = '✉️ ' + gen.email; });

    // WhatsApp links
    const social0 = loadCfg('social', null);
    const waMsg = (social0 && social0.wa_msg) ? social0.wa_msg : 'Hola, quisiera hacer una reservación en Velvet';
    document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
      if (gen.whatsapp) a.href = 'https://wa.me/' + gen.whatsapp + '?text=' + encodeURIComponent(waMsg);
    });

    // Dirección
    document.querySelectorAll('[data-loc="address"]').forEach(el => { if (gen.address) el.textContent = gen.address; });
    document.querySelectorAll('[data-fc="address"]').forEach(el  => { if (gen.address) el.textContent = '📍 ' + gen.address; });

    // Maps
    if (gen.mapslink) document.querySelectorAll('a[href*="maps.google"]').forEach(a => a.href = gen.mapslink);
    if (gen.mapembed) { const iframe = document.querySelector('.loc-map iframe'); if (iframe) iframe.src = gen.mapembed; }
  }

  /* Hero */
  const hero = loadCfg('hero', null);
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
  const hours = loadCfg('hours', null);
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
      el.textContent = '🕐 ' + hours.map(h => h.days + ': ' + h.open + '–' + h.close).join(' · ');
    });
  }

  /* Redes sociales */
  const social = loadCfg('social', null);
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
  const menuData = loadCfg('menu', null);
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
  }

  /* Testimonios */
  const testis = loadCfg('testimonials', null);
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
  const svcs = loadCfg('services', null);
  if (svcs && svcs.length) {
    const grid = document.querySelector('.services-grid');
    if (grid) {
      grid.innerHTML = svcs.map((s, i) => `
        <div class="service-card reveal" data-delay="${i * 100}">
          <div class="svc-glow"></div>
          <div class="svc-icon">${s.icon}</div>
          <h3>${s.name}</h3>
          <p>${s.desc}</p>
          ${s.link ? `<a href="${s.link}" class="svc-link">${s.linkText || 'Ver más →'}</a>` : ''}
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
  const galleryData  = loadCfg('gallery', null);

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

  /* Amenidades */
  const amenities = loadCfg('amenities', null);
  if (amenities && amenities.length) {
    const grid = document.querySelector('.amen-grid');
    if (grid) {
      grid.innerHTML = amenities.map(card => `
        <div class="amen-card">
          <h3>${card.icon || ''} ${card.title || ''}</h3>
          <ul>
            ${(Array.isArray(card.items) ? card.items : []).map(item => `<li>✓ ${item}</li>`).join('')}
          </ul>
        </div>
      `).join('');
      /* Re-observar nuevas tarjetas para la animación reveal */
      grid.querySelectorAll('.amen-card').forEach(el => {
        if (typeof io !== 'undefined') io.observe(el);
      });
    }
  }

  function setText(selector, text) {
    if (!text) return;
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }
}

/* Ejecutar al cargar con localStorage */
applySiteConfig();

/* ══════════════════════════════════════════════════════
   SINCRONIZACIÓN EN TIEMPO REAL — Firebase Realtime DB
   Lee la config publicada desde el admin y aplica cambios
   automáticamente SIN recargar la página.
══════════════════════════════════════════════════════ */
(function initCloudSync() {
  var RTDB = 'https://lafocacheria-default-rtdb.firebaseio.com/velvet';

  /* Aplica config de la nube al DOM y localStorage */
  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    var keys = ['general','hero','menu','services','testimonials','hours','social','gallery','colors','closedMsg'];
    keys.forEach(function(key) {
      if (data[key] !== undefined) {
        localStorage.setItem('velvet_' + key, JSON.stringify(data[key]));
      }
    });
    applySiteConfig();
  }

  /* Carga inicial desde la nube (sobreescribe localStorage con datos del admin) */
  fetch(RTDB + '.json')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) { if (data) applyFromCloud(data); })
    .catch(function() { /* Sin conexión: usa localStorage */ });

  /* Escucha cambios en tiempo real vía Server-Sent Events */
  try {
    var es = new EventSource(RTDB + '.json');
    es.addEventListener('put', function(e) {
      try {
        var payload = JSON.parse(e.data);
        /* 'put' con path '/' trae todo el objeto en payload.data */
        var cfg = (payload.path === '/') ? payload.data : null;
        if (cfg) applyFromCloud(cfg);
      } catch(err) {}
    });
    es.onerror = function() { es.close(); }; /* Cierra si falla, evita bucle */
  } catch(err) {}

  /* Fallback: localStorage storage event (misma pestaña del admin) */
  window.addEventListener('storage', function(e) {
    if (!e.key || e.key.startsWith('velvet_')) applySiteConfig();
  });
})();

/* ─── Navbar scroll ─── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
  document.getElementById('backTop').classList.toggle('visible', window.scrollY > 400);
});

/* ─── Hamburger ─── */
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

/* ─── Back to top ─── */
document.getElementById('backTop').addEventListener('click', () =>
  window.scrollTo({ top: 0, behavior: 'smooth' })
);

/* ─── Hero particles ─── */
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

/* ─── Intersection Observer (reveal) ─── */
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

/* ─── Menu tabs ─── */
document.querySelectorAll('.mtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

/* ─── Testimonials slider ─── */
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

/* ─── Gallery lightbox ─── */
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

/* ─── Reservation form ─── */
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

/* ─── Smooth anchor scroll with offset ─── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ─── Set min date for reservation ─── */
(function setMinDate() {
  const dateInput = document.querySelector('input[name="date"]');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }
})();
