/* Ajustes: permisos, recordatorios y reglas de facturación. */

import { el, vaciar, avisar, confirmar } from '../utils/dom.js';
import { leerConfig, guardarConfig } from '../services/config.js';
import * as notificaciones from '../services/notificaciones.service.js';
import { descargarICS } from '../services/calendario.service.js';
import * as respaldo from '../services/respaldo.service.js';
import { formatearFechaCorta } from '../services/fechas.service.js';

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
  const estadoPermiso = el('strong', { texto: TEXTO_PERMISO[await notificaciones.permisoActual()] });

  const botonPermiso = el('button', {
    type: 'button', class: 'btn-primario', texto: 'Permitir notificaciones',
    onclick: async function () {
      const resultado = await notificaciones.pedirPermiso();
      estadoPermiso.textContent = TEXTO_PERMISO[resultado] || resultado;

      if (resultado === 'granted') {
        const aviso = await notificaciones.programarAvisos();
        avisar(aviso.programadas + ' aviso(s) programado(s)' +
          (aviso.dias > 1 ? ' para los próximos ' + aviso.dias + ' días' : ' para hoy'), 'exito');
        await pintarAvisoAlarmas();
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

  // Android 12+ puede retrasar las alarmas si falta este permiso aparte.
  const avisoAlarmas = el('div');

  async function pintarAvisoAlarmas() {
    vaciar(avisoAlarmas);
    if (!notificaciones.esNativo() || await notificaciones.alarmasExactas()) return;

    avisoAlarmas.append(el('div', { class: 'aviso-factura' }, [
      el('strong', { texto: 'Las alarmas exactas están desactivadas.' }),
      el('span', { texto: ' Android puede retrasar los avisos. Actívalas para que suenen a la hora.' }),
      el('div', { class: 'acciones', style: 'margin-top:10px' }, [
        el('button', {
          type: 'button', class: 'btn-secundario', texto: 'Activar alarmas exactas',
          onclick: async function () { await notificaciones.abrirAjusteAlarmas(); }
        })
      ])
    ]));
  }

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Recordatorios' }),
    el('p', { style: 'margin:0 0 10px;font-size:14.5px' }, ['Estado: ', estadoPermiso]),
    avisoAlarmas,

    el('div', { class: 'campo' }, [
      el('label', { for: 'anticipacion', texto: 'Avisarme antes de cada visita (minutos)' }),
      anticipacion
    ]),

    el('p', {
      style: 'margin:0 0 12px;font-size:13.5px;color:var(--tinta-suave)',
      texto: notificaciones.esNativo()
        ? 'Los avisos los programa el teléfono: suenan con la app cerrada y sin internet.'
        : 'Con la app abierta el aviso sale solo. Con la app cerrada, usa el calendario.'
    }),

    el('div', { class: 'acciones', style: 'margin-top:0' }, [
      botonPermiso,
      el('button', {
        type: 'button', class: 'btn-secundario', texto: 'Probar aviso',
        onclick: async function () {
          if (await notificaciones.permisoActual() !== 'granted') {
            avisar('Primero permite las notificaciones', 'error');
            return;
          }
          await notificaciones.probar();
        }
      })
    ])
  ]));

  pintarAvisoAlarmas();

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

  const prefijoPais = el('input', {
    id: 'prefijoPais',
    type: 'text', inputmode: 'numeric', maxlength: 4,
    value: config.prefijoPais
  });

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

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'WhatsApp' }),
    el('div', { class: 'campo' }, [
      el('label', { for: 'prefijoPais', texto: 'Indicativo del país' }),
      prefijoPais
    ]),
    el('p', {
      style: 'margin:0;font-size:13.5px;color:var(--tinta-suave)',
      texto: 'Se antepone a los teléfonos del archivo para abrir el chat. 57 es Colombia.'
    })
  ]));

  contenedor.append(el('div', { class: 'acciones' }, [
    el('button', {
      type: 'button', class: 'btn-primario', texto: 'Guardar ajustes',
      onclick: async function () {
        guardarConfig({
          anticipacionMin: Math.max(0, parseInt(anticipacion.value, 10) || 0),
          diaFacturacion: Math.min(31, Math.max(1, parseInt(diaFacturacion.value, 10) || 20)),
          saldoIncluyeMesNuevo: incluye.checked,
          prefijoPais: prefijoPais.value.replace(/\D/g, '')
        });

        if (await notificaciones.permisoActual() === 'granted') {
          await notificaciones.programarAvisos();
        }

        avisar('Ajustes guardados', 'exito');
        location.hash = '#/ruta';
      }
    })
  ]));

  // ----- Respaldo -----
  // El CSV de facturación no alcanza: no trae los clientes creados a
  // mano, ni notas, horas de visita o anticipaciones. Esto guarda todo.
  const entradaRespaldo = el('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onchange: async function (evento) {
      const archivo = evento.target.files && evento.target.files[0];
      evento.target.value = '';
      if (!archivo) return;

      try {
        const revisado = respaldo.revisarRespaldo(await respaldo.leerArchivo(archivo));
        const dia = revisado.creado ? formatearFechaCorta(revisado.creado.slice(0, 10)) : '';

        const seguro = await confirmar(
          'El respaldo tiene ' + revisado.total +
          (revisado.total === 1 ? ' cliente' : ' clientes') +
          (dia ? ', del ' + dia : '') +
          '. Al restaurarlo se borra la cartera que tienes ahora. ¿Continuar?',
          'Restaurar'
        );
        if (!seguro) return;

        const total = await respaldo.restaurarRespaldo(revisado);
        avisar(total + (total === 1 ? ' cliente restaurado' : ' clientes restaurados'), 'exito');
        location.hash = '#/clientes';
      } catch (error) {
        avisar(error.message || 'No se pudo restaurar el respaldo.', 'error');
      }
    }
  });

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Respaldo' }),
    el('p', {
      style: 'margin:0 0 12px;font-size:14.5px',
      texto: 'Los datos viven solo en este celular. Descarga un respaldo y guárdalo ' +
        'en otro lado: si borras los datos del navegador o cambias de teléfono, es la ' +
        'única forma de recuperar tu cartera con las notas y horas que agregaste.'
    }),
    entradaRespaldo,
    el('div', { class: 'acciones', style: 'margin-top:0' }, [
      el('button', {
        type: 'button', class: 'btn-primario', texto: 'Descargar respaldo',
        onclick: async function () {
          try {
            const total = await respaldo.descargarRespaldo();
            avisar(total + (total === 1 ? ' cliente guardado' : ' clientes guardados'), 'exito');
          } catch (error) {
            avisar(error.message, 'error');
          }
        }
      }),
      el('button', {
        type: 'button', class: 'btn-secundario', texto: 'Restaurar respaldo',
        onclick: function () { entradaRespaldo.click(); }
      })
    ])
  ]));
}
