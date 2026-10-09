const CACHE_NAME = 'cobros-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
  // Aquí agregaremos tus archivos CSS y JS más adelante
];

// Instalar el Service Worker y guardar en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Interceptar peticiones para que funcione offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
