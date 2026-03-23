const SW_VERSION = 'luro-pwa-rollback-20260320-restore3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/css/styles.css?v=20260320-1905',
  '/assets/js/app.js?v=20260320-rollback-fix1',
  '/assets/js/cloud-bridge.js?v=20260313-2038',
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((resp) => {
        const url = new URL(req.url);
        if (url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(SW_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => {
        if (req.mode === 'navigate') return caches.match('/index.html');
        return caches.match(req);
      })
  );
});


