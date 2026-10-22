/* Ficha del cliente: lo que la cobradora necesita en la puerta.

   Arriba, sin tener que bajar: a quién visita, qué le cobra, las notas
   de la casa y los botones que de verdad usa. Lo demás —los datos de la
   cuenta y el historial— va en pestañas, para que no estorbe. */

import { el, vaciar, moneda, avisar } from '../utils/dom.js';
import { aNumero } from '../utils/validadores.js';
import * as repo from '../db/clientes.repo.js';
import { leerConfig } from '../services/config.js';
import { desglosarSaldo } from '../services/ruta.service.js';
import { hoy, formatearHora, formatearFechaCorta, diaEfectivo, desdeISO, aISO } from '../services/fechas.service.js';
import { enlaceWhatsApp, enlaceLlamada, telefonoPrincipal } from '../services/contacto.service.js';
import * as cobros from '../services/cobros.service.js';
import { programarAvisos } from '../services/notificaciones.service.js';

// Qué pestaña estaba abierta, para no saltar a la primera al repintar
// después de marcar un cobro. Solo vale para el cliente que se miraba.
let ultimaPestana = { id: null, cual: 'datos' };

function dato(etiqueta, valor) {
  if (!valor && valor !== 0) return null;
  return el('div', { class: 'dato' }, [
    el('span', { class: 'dato-etiqueta', texto: etiqueta }),
    el('span', { class: 'dato-valor', texto: String(valor) })
  ]);
}

/** Enlace que sale de la app: WhatsApp o el marcador del teléfono. */
function enlaceExterno(texto, href, clase) {
  return el('a', {
    class: 'btn-enlace ' + clase,
    href: href,
    target: '_blank',
    rel: 'noopener',
    texto: texto
  });
}

function iconoLapiz() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const trazo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trazo.setAttribute('d', 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z');
  svg.append(trazo);
  return svg;
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
  const desglose = desglosarSaldo(cliente, fecha, config);
  const diaMes = diaEfectivo(cliente.diaCobro, fecha);
  const cobrado = cobros.yaCobrado(cliente, fecha);
  const aplazado = cobros.aplazadoPara(cliente, fecha);

  /** Repinta la ficha entera: lo más simple y no hay nada que perder. */
  async function recargar() {
    await programarAvisos();
    await render(contenedor, id);
  }

  // ---------- Cabecera: lo que se mira en la puerta ----------

  const cabecera = el('div', { class: 'ficha-cabecera' }, [
    el('div', { class: 'ficha-titulo' }, [
      el('div', {}, [
        el('h2', { texto: cliente.nombre }),
        el('p', {
          class: 'detalle',
          texto: [cliente.barrio, cliente.direccion].filter(Boolean).join(' · ') || 'Sin dirección'
        })
      ]),
      el('a', {
        class: 'btn-icono',
        href: '#/cliente/' + cliente.id + '/editar',
        title: 'Editar cliente',
        'aria-label': 'Editar cliente'
      }, [iconoLapiz()])
    ])
  ]);

  // El saldo, salvo que ya esté cobrado: entonces manda la marca verde.
  if (cobrado) {
    cabecera.append(el('div', { class: 'marca-cobrado' }, [
      el('strong', { texto: '✓ Cobrado este mes' }),
      el('span', { texto: ' · ' + formatearFechaCorta(cliente.ultimoPago) })
    ]));
  } else {
    const montos = [el('strong', { class: 'saldo-grande', texto: moneda(desglose.vencido) })];
    if (desglose.mesNuevo > 0) {
      montos.push(el('span', {
        class: 'mes-nuevo',
        texto: '+ ' + moneda(desglose.mesNuevo) + ' del mes nuevo, aún no se cobra'
      }));
    }
    cabecera.append(el('div', { class: 'montos-ficha' }, montos));
  }

  // Las notas son lo que hay que saber ANTES de tocar la puerta.
  if (cliente.notas) {
    cabecera.append(el('p', { class: 'ficha-notas', texto: cliente.notas }));
  }

  if (aplazado && !cobrado) {
    cabecera.append(el('p', {
      class: 'ficha-aplazado',
      texto: 'Aplazado: en vez del ' + diaMes + ', se visita el ' + aplazado.getDate() + '.'
    }));
  }

  contenedor.append(cabecera);

  // ---------- Lo que se hace ----------

  const acciones = el('div', { class: 'ficha-acciones' });

  if (cobrado) {
    acciones.append(el('button', {
      type: 'button', class: 'btn-secundario', texto: 'No, todavía no pagó',
      onclick: async function () {
        await cobros.desmarcarCobrado(cliente, fecha);
        avisar('Vuelve a la ruta', 'exito');
        await recargar();
      }
    }));
  } else {
    acciones.append(el('button', {
      type: 'button', class: 'btn-cobrado', texto: 'Ya pagó',
      onclick: function () { pedirMonto(); }
    }));

    if (cliente.diaCobro) {
      acciones.append(el('button', {
        type: 'button', class: 'btn-secundario',
        texto: aplazado ? 'Cambiar el día' : 'Aplazar',
        onclick: function () { pedirDiaParaAplazar(); }
      }));
    }
  }

  contenedor.append(acciones);

  if (aplazado && !cobrado) {
    contenedor.append(el('div', { class: 'ficha-acciones' }, [
      el('button', {
        type: 'button', class: 'btn-tenue', texto: 'Quitar el aplazamiento',
        onclick: async function () {
          await cobros.quitarAplazamiento(cliente);
          avisar('Vuelve a su día de siempre', 'exito');
          await recargar();
        }
      })
    ]));
  }

  // ---------- Contacto ----------

  const numero = telefonoPrincipal(cliente);

  if (cliente.telefonos && cliente.telefonos.length) {
    const contacto = el('div', { class: 'ficha-acciones' });
    if (numero) {
      contacto.append(enlaceExterno('WhatsApp', enlaceWhatsApp(cliente, config), 'btn-secundario'));
    }
    contacto.append(enlaceExterno('Llamar', enlaceLlamada(cliente.telefonos[0]), 'btn-secundario'));
    contenedor.append(contacto);
  }

  // ---------- Pestañas ----------

  const historial = cobros.historialDeCobros(cliente);

  const panelDatos = el('div', { class: 'bloque', id: 'panel-datos', role: 'tabpanel' }, [
    el('h2', { texto: 'La cuenta' }),
    dato('Referencia de pago', cliente.referencia),
    dato('Documento', cliente.documento),
    dato('Campaña', cliente.campania),
    dato('Tarifa mensual', cliente.tarifa ? moneda(cliente.tarifa) : ''),
    dato('Cuota que suele pagar', cliente.cuota ? moneda(cliente.cuota) : ''),
    dato('Saldo total', moneda(cliente.saldo)),
    dato('Facturas debidas', cliente.edad || ''),
    dato('Último pago', formatearFechaCorta(cliente.ultimoPago) || 'Sin registrar'),
    el('h2', { style: 'margin-top:20px', texto: 'La visita' }),
    dato('Teléfonos', (cliente.telefonos || []).join(' · ')),
    dato('Día de cobro', cliente.diaCobro
      ? ('el ' + cliente.diaCobro + (diaMes !== cliente.diaCobro ? ' (este mes, el ' + diaMes + ')' : ''))
      : 'Sin día asignado'),
    dato('Hora', formatearHora(cliente.horaCobro) || 'Sin hora'),
    dato('Avisarme antes', cliente.anticipacionMin === null || cliente.anticipacionMin === undefined
      ? config.anticipacionMin + ' min (el global)'
      : cliente.anticipacionMin + ' min')
  ]);

  const panelCobros = el('div', { class: 'bloque', id: 'panel-cobros', role: 'tabpanel' }, [
    historial.length
      ? el('ul', { class: 'historial' }, historial.map(function (cobro) {
          return el('li', {}, [
            el('span', { class: 'historial-fecha', texto: formatearFechaCorta(cobro.fecha) }),
            el('span', { class: 'historial-derecha' }, [
              cobros.yaCobrado({ ultimoPago: cobro.fecha }, fecha)
                ? el('span', { class: 'historial-marca', texto: 'este mes' })
                : null,
              cobro.monto
                ? el('strong', { class: 'historial-monto', texto: moneda(cobro.monto) })
                : el('span', { class: 'historial-sinmonto', texto: 'sin monto' })
            ])
          ]);
        }))
      : el('p', {
          class: 'detalle',
          style: 'margin:0',
          texto: 'Todavía no has marcado ningún cobro de este cliente.'
        }),
    el('p', {
      style: 'margin:12px 0 0;font-size:13px;color:var(--tinta-suave)',
      texto: 'Es el día en que marcaste el cobro, no la factura que se pagó: ' +
        'eso no viene en el archivo.'
    })
  ]);

  const pestanas = [
    { cual: 'datos', texto: 'Datos', panel: panelDatos },
    { cual: 'cobros', texto: 'Cobros' + (historial.length ? ' (' + historial.length + ')' : ''), panel: panelCobros }
  ];

  const barra = el('div', { class: 'pestanas', role: 'tablist' });

  function mostrar(cual) {
    ultimaPestana = { id: cliente.id, cual: cual };

    pestanas.forEach(function (pestana) {
      const activa = pestana.cual === cual;
      pestana.boton.setAttribute('aria-selected', activa ? 'true' : 'false');
      pestana.panel.hidden = !activa;
    });
  }

  pestanas.forEach(function (pestana) {
    pestana.boton = el('button', {
      type: 'button',
      class: 'pestana',
      role: 'tab',
      texto: pestana.texto,
      'aria-controls': pestana.panel.id,
      onclick: function () { mostrar(pestana.cual); }
    });
    barra.append(pestana.boton);
  });

  contenedor.append(barra, panelDatos, panelCobros);

  mostrar(ultimaPestana.id === cliente.id ? ultimaPestana.cual : 'datos');

  contenedor.append(el('div', { class: 'acciones' }, [
    el('a', { class: 'btn-enlace btn-secundario', href: '#/clientes', texto: 'Volver a la lista' })
  ]));

  // ---------- Diálogos ----------

  /**
   * Pregunta cuánto pagó antes de marcar el cobro. El monto es opcional
   * y solo se anota: el saldo sigue viniendo del archivo.
   */
  function pedirMonto() {
    const monto = el('input', {
      type: 'text', inputmode: 'decimal',
      placeholder: cliente.cuota ? String(cliente.cuota) : ''
    });

    async function guardar(valor) {
      await cobros.marcarCobrado(cliente, fecha, valor);
      avisar(valor
        ? 'Anotado: ' + moneda(valor) + '. No hay que volver este mes'
        : 'Listo, no hay que volver este mes', 'exito');
      await recargar();
    }

    const dialogo = el('dialog', {}, [
      el('p', { style: 'margin:0 0 4px;font-weight:650', texto: '¿Cuánto pagó?' }),
      el('p', {
        style: 'margin:0 0 14px;font-size:13.5px;color:var(--tinta-suave)',
        texto: 'Queda anotado en el historial. El saldo no cambia: ese lo trae el archivo.'
      }),
      el('div', { class: 'campo' }, [monto]),
      el('div', { class: 'acciones' }, [
        el('button', {
          type: 'button', class: 'btn-secundario', texto: 'Sin anotar monto',
          onclick: async function () { dialogo.close(); await guardar(null); }
        }),
        el('button', {
          type: 'button', class: 'btn-cobrado', texto: 'Guardar',
          onclick: async function () {
            const valor = aNumero(monto.value);
            dialogo.close();
            await guardar(valor > 0 ? valor : null);
          }
        })
      ])
    ]);

    dialogo.addEventListener('close', function () { dialogo.remove(); });
    document.body.append(dialogo);
    dialogo.showModal();
    monto.focus();
  }

  /** Diálogo para mover la visita: por esta vez, o de aquí en adelante. */
  function pedirDiaParaAplazar() {
    const opciones = cobros.diasParaAplazar(fecha);

    if (opciones.length === 0) {
      avisar('Ya no quedan días este mes para aplazar', 'error');
      return;
    }

    const soloEsteMes = el('input', { type: 'radio', name: 'alcance', checked: true });
    const paraSiempre = el('input', { type: 'radio', name: 'alcance' });

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
}
