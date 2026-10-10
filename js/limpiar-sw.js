/* Temporal: quita el Service Worker y borra sus cachés.
   Se usa mientras depuramos, porque un SW viejo puede interceptar
   las peticiones y hacer que todos los archivos fallen.
   Borra este archivo y su <script> cuando la app ya funcione. */

(function () {
  if (!('serviceWorker' in navigator)) return;

  function yaRecargada() {
    try { return sessionStorage.getItem('sw-limpiado') === '1'; }
    catch (error) { return true; }
  }

  function marcarRecarga() {
    try { sessionStorage.setItem('sw-limpiado', '1'); }
    catch (error) { /* sin sessionStorage, no recargamos */ }
  }

  navigator.serviceWorker.getRegistrations()
    .then(function (registros) {
      var habia = registros.length > 0;

      var quitados = registros.map(function (registro) {
        return registro.unregister();
      });

      return Promise.all(quitados).then(function () {
        if (!window.caches) return habia;
        return caches.keys().then(function (claves) {
          return Promise.all(claves.map(function (clave) {
            return caches.delete(clave);
          }));
        }).then(function () { return habia; });
      });
    })
    .then(function (habia) {
      console.log(habia ? 'Service Worker eliminado.' : 'No había Service Worker.');
      if (habia && !yaRecargada()) {
        marcarRecarga();
        location.reload();
      }
    })
    .catch(function (error) {
      console.warn('No se pudo limpiar el Service Worker:', error);
    });
})();
