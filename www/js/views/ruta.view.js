/* Pantalla principal: a quién visito hoy. */

import { el, vaciar, moneda } from '../utils/dom.js';
import { cargarRuta } from '../services/ruta.service.js';
import { formatearFecha, formatearHora, hoy } from '../services/fechas.service.js';

function filaCliente(item, mostrarDia) {
  const cliente = item.cliente;
  const desglose = item.desglose;

  const detalle = [
    mostrarDia ? 'Era el ' + item.dia : formatearHora(cliente.horaCobro) || 'Sin hora',
    cliente.barrio,
    cliente.direccion
  ].filter(Boolean).join(' · ');

  const montos = [
    el('span', { class: 'saldo', texto: moneda(desglose.vencido) })
  ];

  if (desglose.mesNuevo > 0) {
    montos.push(el('span', {
      class: 'mes-nuevo',
      texto: '+ ' + moneda(desglose.mesNuevo) + ' mes nuevo'
    }));
  }

  return el('li', {}, [
    el('a', { class: 'fila fila-ruta', href: '#/cliente/' + cliente.id }, [
      el('span', { class: 'nombre', texto: cliente.nombre }),
      el('span', { class: 'detalle', texto: detalle }),
      el('span', { class: 'montos' }, montos)
    ])
  ]);
}

function bloque(titulo, total, items, mostrarDia, vacio) {
  const lista = el('ul', { class: 'lista' });

  if (items.length === 0) {
    lista.append(el('li', {}, [
      el('p', { class: 'vacio', style: 'margin:0', texto: vacio })
    ]));
  } else {
    items.forEach(function (item) { lista.append(filaCliente(item, mostrarDia)); });
  }

  return el('section', { style: 'margin-bottom:22px' }, [
    el('div', { class: 'resumen' }, [
      el('span', { texto: titulo + ' (' + items.length + ')' }),
      items.length ? el('strong', { texto: moneda(total) }) : null
    ]),
    lista
  ]);
}

export async function render(contenedor) {
  vaciar(contenedor);
  contenedor.append(el('p', { class: 'vacio', texto: 'Armando la ruta…' }));

  const ruta = await cargarRuta(hoy());
  vaciar(contenedor);

  contenedor.append(el('div', { class: 'cabecera-ruta' }, [
    el('span', { texto: formatearFecha(ruta.fecha) }),
    el('a', { href: '#/ajustes', texto: 'Ajustes' })
  ]));

  if (ruta.hayFacturaNueva) {
    contenedor.append(el('div', { class: 'aviso-factura' }, [
      el('strong', { texto: 'Ya pasó el día ' + ruta.config.diaFacturacion + '.' }),
      el('span', {
        texto: ' La factura del mes siguiente ya se generó: el monto grande es lo vencido, ' +
          'y aparte se marca lo que todavía no corresponde cobrar.'
      })
    ]));
  }

  contenedor.append(
    bloque('Para hoy', ruta.totalHoy, ruta.deHoy, false, 'Hoy no tienes visitas programadas.'),
    bloque('Quedaron pendientes', ruta.totalAtrasado, ruta.atrasados, true,
      'No hay cobros atrasados este mes.')
  );

  if (ruta.deHoy.length === 0 && ruta.atrasados.length === 0) {
    contenedor.append(el('div', { class: 'vacio' }, [
      el('p', { texto: 'Si falta gente, revisa que tengan día de cobro asignado.' }),
      el('a', { href: '#/clientes', texto: 'Ver todos los clientes' })
    ]));
  }
}
