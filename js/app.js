/* Arranque: Service Worker, estado de red y enrutador por hash.
   El enrutador parte el hash por '/' en vez de usar expresiones regulares. */

import { el, vaciar, avisar } from './utils/dom.js';
import * as vistaClientes from './views/clientes.view.js';
import * as vistaFormulario from './views/cliente-form.view.js';
import * as vistaImportar from './views/importar.view.js';

// Señal para el diagnóstico de index.html: los módulos sí cargaron.
window.__appLista = true;

const contenedor = document.getElementById('vista');
const titulo = document.getElementById('titulo-vista');
const indicadorRed = document.getElementById('indicador-red');

// --- Service Worker ---
// --- Service Worker (desactivado mientras depuramos) ---
if (false) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.warn('No se registró el Service Worker:', error);
    });
  });
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

  // '#/cliente/abc' -> ['cliente', 'abc']
  const partes = hash.slice(2).split('/');
  const seccion = partes[0];
  const parametro = partes[1] || '';

  try {
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

    if (seccion === 'cliente' && parametro) {
      prepararVista('Editar cliente', '');
      await vistaFormulario.render(contenedor, parametro);
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

  location.replace('#/clientes');
}

window.addEventListener('hashchange', enrutar);

if (location.hash) enrutar();
else location.replace('#/clientes');