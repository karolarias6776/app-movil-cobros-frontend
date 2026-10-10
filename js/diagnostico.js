/* Diagnóstico temporal. Script clásico, NO es un módulo.
   Importa los módulos uno por uno, en orden de dependencia:
   el primero que falle es el archivo con el problema.
   Borra este archivo y su <script> en index.html cuando todo funcione. */

(function () {
  var vista = document.getElementById('vista');

  var MODULOS = [
    './js/utils/validadores.js',
    './js/utils/dom.js',
    './js/services/config.js',
    './js/services/fechas.service.js',
    './js/db/database.js',
    './js/db/clientes.repo.js',
    './js/services/ruta.service.js',
    './js/services/csv.service.js',
    './js/services/importacion.service.js',
    './js/services/notificaciones.service.js',
    './js/services/calendario.service.js',
    './js/views/ruta.view.js',
    './js/views/clientes.view.js',
    './js/views/cliente-form.view.js',
    './js/views/importar.view.js',
    './js/views/ajustes.view.js',
    './js/app.js'
  ];

  var errorGlobal = '';
  window.addEventListener('error', function (evento) {
    errorGlobal = evento.message || ('No cargó ' + (evento.target && evento.target.src));
  }, true);

  function pintar(lineas) {
    var html = '<div style="padding:16px;font-size:14px;line-height:1.55">' +
      '<p style="font-weight:700;font-size:17px;margin:0 0 10px">Diagnóstico</p>';
    for (var i = 0; i < lineas.length; i++) {
      html += '<div style="word-break:break-word;font-family:ui-monospace,monospace;' +
        'font-size:12.5px;padding:6px 0;border-bottom:1px solid #CFD8E0">' + lineas[i] + '</div>';
    }
    vista.innerHTML = html + '</div>';
  }

  // import() envuelto en Function: si el navegador no lo soporta,
  // lo sabemos sin romper este script.
  var importar;
  try {
    importar = new Function('ruta', 'return import(ruta);');
  } catch (error) {
    importar = null;
  }

  function revisar() {
    if (!importar) {
      pintar(['✗ Este navegador no soporta import() dinámico.',
              'El WebView de la vista previa es muy antiguo: abre la URL en Chrome.']);
      return;
    }

    var lineas = errorGlobal ? ['⚠ ' + errorGlobal] : [];
    var indice = 0;

    function siguiente() {
      if (indice >= MODULOS.length) {
        lineas.push('Todos los módulos cargaron: el problema no es de sintaxis.');
        pintar(lineas);
        return;
      }

      var ruta = MODULOS[indice++];
      importar(new URL(ruta, document.baseURI).href).then(function () {
        lineas.push('✓ ' + ruta);
        siguiente();
      }).catch(function (error) {
        lineas.push('✗ ' + ruta);
        lineas.push('<b>' + (error && error.message ? error.message : String(error)) + '</b>');
        lineas.push('Revisa ese archivo en Spck: mira si quedó cortado o pegado dos veces.');
        pintar(lineas);
      });
    }

    siguiente();
  }

  // 4 segundos: más tarde que el diagnóstico viejo del index, para pisarlo.
  setTimeout(function () { if (!window.__appLista) revisar(); }, 4000);
})();
