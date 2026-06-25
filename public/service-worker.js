const SW_VERSION = 'luro-pwa-cachefix-20260414-2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/acceder.html',
  '/descargar.html',
  '/app.html',
  '/manifest.webmanifest',
  '/assets/saas/css/landing.css?v=20260414-landing-ecosistema-2',
  '/assets/saas/js/landing.js?v=20260412-1200',
  '/assets/saas/js/access.js?v=20260306-1205',
  '/assets/css/styles.css?v=20260413-hotfix-1',
  '/assets/js/app.js?v=20260413-hotfix-1',
  '/assets/js/cloud-bridge.js?v=20260413-hotfix-1',
  '/assets/brand/logo-luro.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data) return;
  const type = typeof data === 'string' ? data : data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((resp) => {
          const copy = resp.clone();
          caches.open(SW_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(async () => (await caches.match(req)) || caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(SW_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req))
  );
});


