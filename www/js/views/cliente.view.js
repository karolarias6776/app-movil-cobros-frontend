/* Ficha del cliente: lo que la cobradora necesita ver en la puerta.
   Desde aqui se le escribe por WhatsApp, se le llama y se edita. */

import { el, vaciar, moneda, avisar, confirmar } from '../utils/dom.js';
import * as repo from '../db/clientes.repo.js';
import { leerConfig } from '../services/config.js';
import { desglosarSaldo } from '../services/ruta.service.js';
import { hoy, formatearHora, formatearFechaCorta, diaEfectivo, desdeISO, aISO, mesYAnio } from '../services/fechas.service.js';
import { enlaceWhatsApp, enlaceLlamada, telefonoPrincipal } from '../services/contacto.service.js';
import * as cobros from '../services/cobros.service.js';
import { programarAvisos } from '../services/notificaciones.service.js';

function dato(etiqueta, valor) {
  if (!valor && valor !== 0) return null;
  return el('div', { class: 'dato' }, [
    el('span', { class: 'dato-etiqueta', texto: etiqueta }),
    el('span', { class: 'dato-valor', texto: String(valor) })
  ]);
}

/** Boton-enlace que sale de la app: WhatsApp o el marcador. */
function enlaceExterno(texto, href, clase) {
  return el('a', {
    class: 'btn-enlace ' + clase,
    href: href,
    target: '_blank',
    rel: 'noopener',
    texto: texto
  });
}

export async function render(contenedor, id) {
  vaciar(contenedor);

  const cliente = await repo.obtener(id);

  if (!cliente) {
    contenedor.append(el('div', { class: 'vacio' }, [
      el('p', { texto: 'Ese cliente ya no está en la base.' }),
      el('a', { href: '#/clientes', texto: 'Volver a la lista' })
    ]));
    return;
  }

  const config = leerConfig();
  const fecha = hoy();

  // Repinta la ficha entera: lo mas simple y no hay nada que perder.
  async function recargar() {
    await programarAvisos();
    await render(contenedor, id);
  }
  const desglose = desglosarSaldo(cliente, fecha, config);
  const diaMes = diaEfectivo(cliente.diaCobro, fecha);

  // --- Encabezado: nombre y lo que hay que cobrar ---
  const montos = [
    el('strong', { class: 'saldo-grande', texto: moneda(desglose.vencido) })
  ];

  if (desglose.mesNuevo > 0) {
    montos.push(el('span', {
      class: 'mes-nuevo',
      texto: '+ ' + moneda(desglose.mesNuevo) + ' del mes nuevo, aún no se cobra'
    }));
  }

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: cliente.nombre }),
    el('p', {
      class: 'detalle',
      texto: [cliente.barrio, cliente.direccion].filter(Boolean).join(' · ') || 'Sin dirección'
    }),
    el('div', { class: 'montos-ficha' }, montos)
  ]));

  // --- Lo que se hace en la puerta ---
  const cobrado = cobros.yaCobrado(cliente, fecha);
  const aplazado = cobros.aplazadoPara(cliente, fecha);
  const bloqueAcciones = el('div', { class: 'bloque' });

  if (cobrado) {
    bloqueAcciones.append(
      el('div', { class: 'marca-cobrado' }, [
        el('strong', { texto: '✓ Cobrado este mes' }),
        el('span', { texto: ' · ' + formatearFechaCorta(cliente.ultimoPago) })
      ]),
      el('p', {
        style: 'margin:10px 0 0;font-size:13.5px;color:var(--tinta-suave)',
        texto: 'No aparece en la ruta hasta el mes que viene.'
      }),
      el('div', { class: 'acciones' }, [
        el('button', {
          type: 'button', class: 'btn-secundario', texto: 'No, todavía no pagó',
          onclick: async function () {
            await cobros.desmarcarCobrado(cliente);
            avisar('Vuelve a la ruta', 'exito');
            await recargar();
          }
        })
      ])
    );
  } else {
    const botones = [
      el('button', {
        type: 'button', class: 'btn-cobrado', texto: 'Ya pagó este mes',
        onclick: async function () {
          await cobros.marcarCobrado(cliente, fecha);
          avisar('Listo, no hay que volver este mes', 'exito');
          await recargar();
        }
      })
    ];

    if (cliente.diaCobro) {
      botones.push(el('button', {
        type: 'button', class: 'btn-secundario',
        texto: aplazado ? 'Cambiar el día' : 'Aplazar',
        onclick: function () { pedirDiaParaAplazar(); }
      }));
    }

    bloqueAcciones.append(el('div', { class: 'acciones', style: 'margin-top:0' }, botones));

    if (aplazado) {
      bloqueAcciones.append(
        el('p', {
          style: 'margin:12px 0 0;font-size:14.5px',
          texto: 'Aplazado: en vez del ' + diaMes + ', se visita el ' + aplazado.getDate() + '.'
        }),
        el('div', { class: 'acciones', style: 'margin-top:10px' }, [
          el('button', {
            type: 'button', class: 'btn-secundario', texto: 'Quitar el aplazamiento',
            onclick: async function () {
              await cobros.quitarAplazamiento(cliente);
              avisar('Vuelve a su día de siempre', 'exito');
              await recargar();
            }
          })
        ])
      );
    }
  }

  contenedor.append(bloqueAcciones);

  /** Diálogo para mover la visita: por esta vez, o de aquí en adelante. */
  function pedirDiaParaAplazar() {
    const opciones = cobros.diasParaAplazar(fecha);

    if (opciones.length === 0) {
      avisar('Ya no quedan días este mes para aplazar', 'error');
      return;
    }

    const soloEsteMes = el('input', { type: 'radio', name: 'alcance', checked: true });
    const paraSiempre = el('input', { type: 'radio', name: 'alcance' });

    // Mueve la visita al día elegido, según lo que haya marcado.
    async function mover(nueva) {
      if (paraSiempre.checked) {
        await cobros.cambiarDiaFijo(cliente, nueva);
        avisar('Ahora se cobra el ' + nueva.getDate() + ' de cada mes', 'exito');
      } else {
        await cobros.aplazar(cliente, nueva);
        avisar('Solo este mes: se visita el ' + nueva.getDate(), 'exito');
      }
      await recargar();
    }

    const finDeMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);

    const elegida = el('input', {
      type: 'date',
      min: opciones[0].iso,
      max: aISO(finDeMes),
      value: opciones[0].iso
    });

    const dialogo = el('dialog', {}, [
      el('p', { style: 'margin:0 0 14px;font-weight:650', texto: '¿Qué día lo visitas?' }),

      el('label', { class: 'opcion' }, [
        soloEsteMes,
        el('span', { class: 'texto' }, [
          'Solo por esta vez',
          el('small', {
            texto: 'El mes que viene vuelve al día ' + cliente.diaCobro + ', como siempre.'
          })
        ])
      ]),
      el('label', { class: 'opcion' }, [
        paraSiempre,
        el('span', { class: 'texto' }, [
          'De ahora en adelante',
          el('small', { texto: 'Le cambia el día de cobro para todos los meses.' })
        ])
      ]),

      el('div', { class: 'dias-aplazar', style: 'margin-top:16px' }, opciones.map(function (opcion) {
        return el('button', {
          type: 'button', class: 'btn-secundario', texto: opcion.etiqueta,
          onclick: async function () {
            dialogo.close();
            await mover(opcion.fecha);
          }
        });
      })),

      el('div', { class: 'campo', style: 'margin-top:16px' }, [
        el('label', { texto: 'O elige la fecha' }),
        elegida
      ]),

      el('div', { class: 'acciones', style: 'margin-top:12px' }, [
        el('button', {
          type: 'button', class: 'btn-secundario', texto: 'Cancelar',
          onclick: function () { dialogo.close(); }
        }),
        el('button', {
          type: 'button', class: 'btn-primario', texto: 'Mover al día elegido',
          onclick: async function () {
            const nueva = desdeISO(elegida.value);
            if (!nueva) { avisar('Esa fecha no sirve', 'error'); return; }
            dialogo.close();
            await mover(nueva);
          }
        })
      ])
    ]);

    dialogo.addEventListener('close', function () { dialogo.remove(); });
    document.body.append(dialogo);
    dialogo.showModal();
  }

  // --- Contacto ---
  const numeroWhatsApp = telefonoPrincipal(cliente);
  const acciones = [];

  if (numeroWhatsApp) {
    acciones.push(enlaceExterno('Escribir por WhatsApp', enlaceWhatsApp(cliente, config), 'btn-whatsapp'));
  }
  if (cliente.telefonos && cliente.telefonos.length) {
    acciones.push(enlaceExterno('Llamar', enlaceLlamada(cliente.telefonos[0]), 'btn-secundario'));
  }

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Contacto' }),
    cliente.telefonos && cliente.telefonos.length
      ? el('p', { class: 'detalle', texto: cliente.telefonos.join(' · ') })
      : el('p', { class: 'detalle', texto: 'Este cliente no tiene teléfono guardado.' }),
    acciones.length ? el('div', { class: 'acciones', style: 'margin-top:12px' }, acciones) : null,
    numeroWhatsApp
      ? el('p', {
          style: 'margin:10px 0 0;font-size:13px;color:var(--tinta-suave)',
          texto: 'WhatsApp abre el chat con el mensaje escrito: no se envía hasta que lo revises y toques enviar.'
        })
      : null
  ]));

  // --- Datos de la cuenta ---
  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'La cuenta' }),
    dato('Referencia de pago', cliente.referencia),
    dato('Documento', cliente.documento),
    dato('Campaña', cliente.campania),
    dato('Tarifa mensual', cliente.tarifa ? moneda(cliente.tarifa) : ''),
    dato('Cuota que suele pagar', cliente.cuota ? moneda(cliente.cuota) : ''),
    dato('Saldo total', moneda(cliente.saldo)),
    dato('Facturas debidas', cliente.edad || ''),
    dato('Último pago', formatearFechaCorta(cliente.ultimoPago) || 'Sin registrar')
  ]));

  // --- Cuándo se visita ---
  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'La visita' }),
    dato('Día de cobro', cliente.diaCobro
      ? ('el ' + cliente.diaCobro + (diaMes !== cliente.diaCobro ? ' (este mes, el ' + diaMes + ')' : ''))
      : 'Sin día asignado'),
    dato('Hora', formatearHora(cliente.horaCobro) || 'Sin hora'),
    dato('Avisarme antes', cliente.anticipacionMin === null || cliente.anticipacionMin === undefined
      ? config.anticipacionMin + ' min (el global)'
      : cliente.anticipacionMin + ' min'),
    cliente.notas ? dato('Notas', cliente.notas) : null
  ]));

  // --- Histórico ---
  // Una línea por mes cobrado. El mes que falta es un mes que no pagó.
  const historial = cobros.historialDeCobros(cliente);

  contenedor.append(el('div', { class: 'bloque' }, [
    el('h2', { texto: 'Histórico de cobros' }),
    historial.length
      ? el('ul', { class: 'historial' }, historial.map(function (iso) {
          const esDeEsteMes = cobros.yaCobrado({ ultimoPago: iso }, fecha);
          return el('li', {}, [
            el('span', { class: 'historial-mes', texto: mesYAnio(iso) }),
            el('span', {
              class: 'historial-dia',
              texto: 'cobrado el ' + (desdeISO(iso) ? desdeISO(iso).getDate() : '') +
                (esDeEsteMes ? ' · este mes' : '')
            })
          ]);
        }))
      : el('p', {
          class: 'detalle',
          style: 'margin:0',
          texto: 'Todavía no has marcado ningún cobro de este cliente.'
        }),
    el('p', {
      style: 'margin:12px 0 0;font-size:13px;color:var(--tinta-suave)',
      texto: 'Son los cobros que marcaste en la app. Un mes que no aparece es un mes que no se cobró.'
    })
  ]));

  contenedor.append(el('div', { class: 'acciones' }, [
    el('a', {
      class: 'btn-enlace btn-secundario',
      href: '#/clientes',
      texto: 'Volver'
    }),
    el('a', {
      class: 'btn-enlace btn-primario',
      href: '#/cliente/' + cliente.id + '/editar',
      texto: 'Editar'
    })
  ]));
}
