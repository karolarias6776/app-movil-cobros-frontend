/* Arranque: Service Worker, estado de red y enrutador por hash.
   El enrutador parte el hash por '/' en vez de usar expresiones regulares. */

import { el, vaciar, avisar } from './utils/dom.js';
import * as vistaClientes from './views/clientes.view.js';
import * as vistaFormulario from './views/cliente-form.view.js';
import * as vistaCliente from './views/cliente.view.js';
import * as vistaImportar from './views/importar.view.js';
import * as vistaRuta from './views/ruta.view.js';
import * as vistaAjustes from './views/ajustes.view.js';
import { programarAvisos, escucharToques, esNativo } from './services/notificaciones.service.js';

const contenedor = document.getElementById('vista');
const titulo = document.getElementById('titulo-vista');
const indicadorRed = document.getElementById('indicador-red');

// --- Service Worker ---
// Solo en la web. Dentro de la app de Android los archivos ya viajan en
// el APK, y un Service Worker ahí solo serviría versiones viejas tras
// actualizar la app.
if ('serviceWorker' in navigator && !esNativo()) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.warn('No se registró el Service Worker:', error);
    });
  });
}

// --- Almacenamiento ---
// Sin esto, el navegador puede borrar la base si al celular le falta
// espacio. No sustituye al respaldo: no protege de borrar los datos
// del sitio ni de cambiar de telefono.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then(function (yaEsta) { return yaEsta || navigator.storage.persist(); })
    .catch(function () { /* el navegador no lo permite: seguimos igual */ });
}

// --- Estado de red ---
function pintarRed() {
  indicadorRed.hidden = navigator.onLine;
}

window.addEventListener('online', pintarRed);
window.addEventListener('offline', pintarRed);
pintarRed();

// --- Enrutador ---

function marcarNavegacion(nav) {
  const enlaces = document.querySelectorAll('[data-nav]');
  for (let i = 0; i < enlaces.length; i++) {
    if (enlaces[i].dataset.nav === nav) enlaces[i].setAttribute('aria-current', 'page');
    else enlaces[i].removeAttribute('aria-current');
  }
}

function prepararVista(tituloVista, nav) {
  vaciar(contenedor);
  titulo.textContent = tituloVista;
  document.title = tituloVista + ' · Ruta de cobro';
  marcarNavegacion(nav);
  contenedor.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function mostrarFallo(error) {
  console.error(error);
  vaciar(contenedor);
  contenedor.append(el('div', { class: 'vacio' }, [
    el('p', { texto: 'No se pudo cargar esta vista.' }),
    el('p', { style: 'font-size:14px', texto: error && error.message ? error.message : '' })
  ]));
  avisar('Ocurrió un error al cargar la vista.', 'error');
}

async function enrutar() {
  const hash = location.hash || '#/clientes';

  // '#/cliente/abc/editar' -> ['cliente', 'abc', 'editar']
  const partes = hash.slice(2).split('/');
  const seccion = partes[0];
  const parametro = partes[1] || '';
  const accion = partes[2] || '';

  try {
    if (seccion === 'ruta') {
      prepararVista('Ruta de hoy', 'ruta');
      await vistaRuta.render(contenedor);
      return;
    }
    if (seccion === 'clientes') {
      prepararVista('Clientes', 'clientes');
      await vistaClientes.render(contenedor);
      return;
    }

    if (seccion === 'cliente' && parametro === 'nuevo') {
      prepararVista('Nuevo cliente', 'nuevo');
      await vistaFormulario.render(contenedor, 'nuevo');
      return;
    }

    if (seccion === 'cliente' && parametro && accion === 'editar') {
      prepararVista('Editar cliente', '');
      await vistaFormulario.render(contenedor, parametro);
      return;
    }

    if (seccion === 'cliente' && parametro) {
      prepararVista('Cliente', '');
      await vistaCliente.render(contenedor, parametro);
      return;
    }
    if (seccion === 'ajustes') {
      prepararVista('Ajustes', 'ajustes');
      await vistaAjustes.render(contenedor);
      return;
    }
    if (seccion === 'importar') {
      prepararVista('Importar clientes', 'importar');
      await vistaImportar.render(contenedor);
      return;
    }
  } catch (error) {
    mostrarFallo(error);
    return;
  }

  location.replace('#/ruta');
}
// Reprograma los avisos del día al abrir y al volver a la app.
// visibilitychange en vez de focus: en el celular es el evento que de
// verdad marca que la app volvió al frente, y no se repite por cada clic.
function reprogramar() {
  programarAvisos().catch(function (error) { console.warn(error); });
}

// En Android, tocar el aviso abre la ficha de ese cliente.
escucharToques();

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') reprogramar();
});

reprogramar();

window.addEventListener('hashchange', enrutar);

if (location.hash) enrutar();
else location.replace('#/ruta');