/* ClapperQR PWA — Service Worker.
   Hace que la app funcione SIN CONEXIÓN (crítico en rodaje con mala cobertura).
   Estrategia:
   - App shell precacheado en la instalación.
   - HTML/navegación: red primero, cache de reserva → recibes actualizaciones
     cuando hay internet, pero abre igual sin conexión.
   - Resto de recursos: cache primero, red de reserva.
   Para forzar que todos actualicen tras un cambio, sube el número de CACHE. */

const CACHE = 'clapperqr-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Solo GET del mismo origen (ignora POST, analytics, etc.).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  const isHTML = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Red primero para recibir la versión más nueva; si no hay red, cache.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
    );
    return;
  }

  // Recursos: cache primero, red de reserva (y guarda lo nuevo).
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
