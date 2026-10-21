/* Ficha del cliente: lo que la cobradora necesita ver en la puerta.
   Desde aqui se le escribe por WhatsApp, se le llama y se edita. */

import { el, vaciar, moneda } from '../utils/dom.js';
import * as repo from '../db/clientes.repo.js';
import { leerConfig } from '../services/config.js';
import { desglosarSaldo } from '../services/ruta.service.js';
import { hoy, formatearHora, formatearFechaCorta, diaEfectivo } from '../services/fechas.service.js';
import { enlaceWhatsApp, enlaceLlamada, telefonoPrincipal } from '../services/contacto.service.js';

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
