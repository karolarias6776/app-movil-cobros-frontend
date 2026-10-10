/* Arranque: registro del Service Worker, estado de red y enrutador por hash. */

import { el, vaciar, avisar } from './utils/dom.js';
import * as vistaClientes from './views/clientes.view.js';
import * as vistaFormulario from './views/cliente-form.view.js';
import * as vistaImportar from './views/importar.view.js';

const contenedor = document.getElementById('vista');
const titulo = document.getElementById('titulo-vista');
const indicadorRed = document.getElementById('indicador-red');

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
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

// --- Rutas ---
const RUTAS = [
  {
    patron: /^#\/clientes$/,
    titulo: 'Clientes',
    nav: 'clientes',
  {
    patron: /^#\/importar$/,
    titulo: 'Importar clientes',
    nav: 'importar',
    render: (destino) => vistaImportar.render(destino)
  }
];

function marcarNavegacion(nav) {
  document.querySelectorAll('[data-nav]').forEach((enlace) => {
    if (enlace.dataset.nav === nav) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  });
}

async function enrutar() {
  const hash = location.hash || '#/clientes';

  for (const ruta of RUTAS) {
    const coincidencia = hash.match(ruta.patron);
    if (!coincidencia) continue;

    titulo.textContent = ruta.titulo;
    document.title = `${ruta.titulo} · Ruta de cobro`;
    marcarNavegacion(ruta.nav);
    contenedor.focus({ preventScroll: true });
    window.scrollTo(0, 0);

    try {
      await ruta.render(contenedor, coincidencia);
    } catch (error) {
      console.error(error);
      vaciar(contenedor).append(el('div', { class: 'vacio' }, [
        el('p', { texto: 'No se pudo abrir la base de datos en este navegador.' }),
        el('p', { style: 'font-size:14px', texto: error.message || '' })
      ]));
      avisar('Ocurrió un error al cargar la vista.', 'error');
    }
    return;
  }

  location.replace('#/clientes');
}

window.addEventListener('hashchange', enrutar);

if (!location.hash) location.replace('#/clientes');
enrutar();
