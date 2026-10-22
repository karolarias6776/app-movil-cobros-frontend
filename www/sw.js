/* Service Worker.
   Estrategia: red primero, caché como respaldo. Así siempre ves la
   última versión cuando hay internet, y la app abre igual sin señal.
   Sube VERSION cuando cambies archivos del shell. */

const VERSION = 'v13';
const CACHE = 'ruta-cobro-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/navegacion.js',
  './js/db/database.js',
  './js/db/clientes.repo.js',
  './js/services/config.js',
  './js/services/fechas.service.js',
  './js/services/ruta.service.js',
  './js/services/cobros.service.js',
  './js/services/csv.service.js',
  './js/services/importacion.service.js',
  './js/services/notificaciones.service.js',
  './js/services/calendario.service.js',
  './js/services/respaldo.service.js',
  './js/services/contacto.service.js',
  './js/views/ruta.view.js',
  './js/views/clientes.view.js',
  './js/views/cliente.view.js',
  './js/views/cliente-form.view.js',
  './js/views/importar.view.js',
  './js/views/ajustes.view.js',
  './js/utils/descargas.js',
  './js/utils/dom.js',
  './js/utils/validadores.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        // addAll falla entero si un archivo falta: los guardamos uno a uno.
        return Promise.all(SHELL.map(function (ruta) {
          return cache.add(ruta).catch(function () { /* se reintenta al navegar */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (claves) {
        return Promise.all(claves.map(function (clave) {
          return clave === CACHE ? null : caches.delete(clave);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  const peticion = evento.request;

  if (peticion.method !== 'GET' || peticion.url.indexOf(self.location.origin) !== 0) return;

  // Los APK publicados no se cachean: son megas que no sirven offline.
  if (peticion.url.indexOf('/descargas/') > -1) return;

  evento.respondWith(
    fetch(peticion)
      .then(function (respuesta) {
        if (respuesta && respuesta.ok && respuesta.type === 'basic') {
          const copia = respuesta.clone();
          caches.open(CACHE).then(function (cache) { cache.put(peticion, copia); });
        }
        return respuesta;
      })
      .catch(function () {
        return caches.match(peticion).then(function (cacheado) {
          if (cacheado) return cacheado;
          if (peticion.mode === 'navigate') return caches.match('./app.html');
          return new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
        });
      })
  );
});

/* Al tocar la notificación, abre la ficha del cliente. */
self.addEventListener('notificationclick', function (evento) {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || './app.html#/ruta';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ventanas) {
      for (let i = 0; i < ventanas.length; i++) {
        if ('focus' in ventanas[i]) {
          ventanas[i].navigate(destino);
          return ventanas[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});

self.addEventListener('message', function (evento) {
  if (evento.data === 'saltar-espera') self.skipWaiting();
});
