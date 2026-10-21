/* Ajustes: permisos, recordatorios y reglas de facturación. */

import { el, vaciar, avisar, confirmar } from '../utils/dom.js';
import { leerConfig, guardarConfig } from '../services/config.js';
import * as notificaciones from '../services/notificaciones.service.js';
import { descargarICS } from '../services/calendario.service.js';
import * as respaldo from '../services/respaldo.service.js';
import * as actualizaciones from '../services/actualizaciones.service.js';
import { formatearFechaCorta, formatearHora, aISO } from '../services/fechas.service.js';

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
        await pintarAvisos();
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

  // Que hay realmente programado: sin esto no hay forma de saber si
  // los avisos quedaron puestos o no.
  const listaAvisos = el('div', { style: 'margin:0 0 10px' });

  function cuandoTexto(fecha) {
    const dia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const hoyDia = new Date();
    const diferencia = Math.round(
      (dia - new Date(hoyDia.getFullYear(), hoyDia.getMonth(), hoyDia.getDate())) / 86400000);
    const hora = formatearHora(
      (fecha.getHours() < 10 ? '0' : '') + fecha.getHours() + ':' +
      (fecha.getMinutes() < 10 ? '0' : '') + fecha.getMinutes());

    if (diferencia === 0) return 'hoy a las ' + hora;
    if (diferencia === 1) return 'mañana a las ' + hora;
    return 'el ' + formatearFechaCorta(aISO(fecha)) + ' a las ' + hora;
  }

  async function pintarAvisos() {
    vaciar(listaAvisos);

    if (await notificaciones.permisoActual() !== 'granted') {
      listaAvisos.append(el('p', {
        class: 'detalle',
        style: 'margin:0',
        texto: 'Sin permiso, no hay avisos programados.'
      }));
      return;
    }

    const pendientes = await notificaciones.avisosPendientes();

    if (pendientes.length === 0) {
      listaAvisos.append(el('p', {
        class: 'detalle',
        style: 'margin:0',
        texto: 'No hay avisos pendientes. Revisa que tus clientes tengan día y hora de visita.'
      }));
      return;
    }

    listaAvisos.append(el('p', {
      style: 'margin:0;font-size:14.5px',
      texto: pendientes.length + (pendientes.length === 1 ? ' aviso programado' : ' avisos programados') +
        '. El próximo, ' + cuandoTexto(pendientes[0].cuando) + ': ' + pendientes[0].titulo + '.'
    }));
  }

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
    listaAvisos,
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
  pintarAvisos();

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
        await notificaciones.programarAvisos();
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

  // ----- Version -----
  const bloqueVersion = el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Versión' }),
    el('p', {
      style: 'margin:0;font-size:14.5px',
      texto: 'Tienes la versión ' + actualizaciones.versionInstalada().nombre + '.'
    })
  ]);

  contenedor.append(bloqueVersion);

  // Si hay una mas nueva publicada, se ofrece el enlace para bajarla.
  actualizaciones.buscarActualizacion().then(function (nueva) {
    if (!nueva) return;

    bloqueVersion.append(
      el('p', {
        style: 'margin:10px 0 0;font-size:14.5px',
        texto: 'Hay una versión nueva: la ' + nueva.nombre + '.' +
          (nueva.notas ? ' ' + nueva.notas : '')
      }),
      el('div', { class: 'acciones', style: 'margin-top:12px' }, [
        el('a', {
          class: 'btn-enlace btn-primario',
          href: nueva.url,
          target: '_blank',
          rel: 'noopener',
          texto: 'Descargar la ' + nueva.nombre
        })
      ]),
      el('p', {
        style: 'margin:10px 0 0;font-size:13px;color:var(--tinta-suave)',
        texto: 'Instálala encima de la que tienes: no se pierden los clientes.'
      })
    );
  });
}
