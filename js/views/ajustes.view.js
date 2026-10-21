/* Ajustes: permisos, recordatorios y reglas de facturación. */

import { el, vaciar, avisar } from '../utils/dom.js';
import { leerConfig, guardarConfig } from '../services/config.js';
import * as notificaciones from '../services/notificaciones.service.js';
import { descargarICS } from '../services/calendario.service.js';

const TEXTO_PERMISO = {
  'granted': 'Permitidas',
  'denied': 'Bloqueadas en este navegador',
  'default': 'Sin decidir',
  'no-soportado': 'Este navegador no las soporta'
};

export async function render(contenedor) {
  vaciar(contenedor);

  const config = leerConfig();

  // ----- Recordatorios -----
  const estadoPermiso = el('strong', { texto: TEXTO_PERMISO[notificaciones.permisoActual()] });

  const botonPermiso = el('button', {
    type: 'button', class: 'btn-primario', texto: 'Permitir notificaciones',
    onclick: async function () {
      const resultado = await notificaciones.pedirPermiso();
      estadoPermiso.textContent = TEXTO_PERMISO[resultado] || resultado;

      if (resultado === 'granted') {
        const aviso = await notificaciones.programarHoy();
        avisar(aviso.programadas + ' aviso(s) programado(s) para hoy', 'exito');
      } else if (resultado === 'denied') {
        avisar('Actívalas desde el candado junto a la dirección', 'error');
      }
    }
  });

  const anticipacion = el('input', {
    id: 'anticipacion',
    type: 'number', inputmode: 'numeric', min: 0, max: 720,
    value: config.anticipacionMin
  });

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Recordatorios' }),
    el('p', { style: 'margin:0 0 10px;font-size:14.5px' }, ['Estado: ', estadoPermiso]),

    el('div', { class: 'campo' }, [
      el('label', { for: 'anticipacion', texto: 'Avisarme antes de cada visita (minutos)' }),
      anticipacion
    ]),

    el('p', {
      style: 'margin:0 0 12px;font-size:13.5px;color:var(--tinta-suave)',
      texto: 'Con la app abierta el aviso sale solo. Con la app cerrada, usa el calendario.'
    }),

    el('div', { class: 'acciones', style: 'margin-top:0' }, [
      botonPermiso,
      el('button', {
        type: 'button', class: 'btn-secundario', texto: 'Probar aviso',
        onclick: async function () {
          if (notificaciones.permisoActual() !== 'granted') {
            avisar('Primero permite las notificaciones', 'error');
            return;
          }
          await notificaciones.probar();
        }
      })
    ])
  ]));

  // ----- Calendario -----
  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Calendario del celular' }),
    el('p', {
      style: 'margin:0 0 12px;font-size:14.5px',
      texto: 'Descarga tus cobros como eventos mensuales con alarma. Ábrelo con la app de ' +
        'Calendario y te avisará aunque la app esté cerrada y sin internet.'
    }),
    el('div', { class: 'acciones', style: 'margin-top:0' }, [
      el('button', {
        type: 'button', class: 'btn-primario', texto: 'Enviar la ruta al calendario',
        onclick: async function () {
          try {
            const total = await descargarICS();
            avisar(total + ' cobro(s) exportado(s)', 'exito');
          } catch (error) {
            avisar(error.message, 'error');
          }
        }
      })
    ])
  ]));

  // ----- Facturación -----
  const diaFacturacion = el('input', {
    id: 'diaFacturacion',
    type: 'number', inputmode: 'numeric', min: 1, max: 31,
    value: config.diaFacturacion
  });

  const incluye = el('input', { type: 'checkbox', checked: config.saldoIncluyeMesNuevo });

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Facturación' }),

    el('div', { class: 'campo' }, [
      el('label', { for: 'diaFacturacion', texto: 'Día en que se genera la factura del mes siguiente' }),
      diaFacturacion
    ]),

    el('label', { class: 'opcion' }, [
      incluye,
      el('span', { class: 'texto' }, [
        'El saldo del archivo ya incluye esa factura',
        el('small', {
          texto: 'Si está marcado, después de ese día se descuenta una tarifa del monto a cobrar.'
        })
      ])
    ])
  ]));

  contenedor.append(el('div', { class: 'acciones' }, [
    el('button', {
      type: 'button', class: 'btn-primario', texto: 'Guardar ajustes',
      onclick: async function () {
        guardarConfig({
          anticipacionMin: Math.max(0, parseInt(anticipacion.value, 10) || 0),
          diaFacturacion: Math.min(31, Math.max(1, parseInt(diaFacturacion.value, 10) || 20)),
          saldoIncluyeMesNuevo: incluye.checked
        });

        if (notificaciones.permisoActual() === 'granted') {
          await notificaciones.programarHoy();
        }

        avisar('Ajustes guardados', 'exito');
        location.hash = '#/ruta';
      }
    })
  ]));
}
