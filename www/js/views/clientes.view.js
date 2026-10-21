/* Lista de clientes con búsqueda. */

import { el, vaciar, moneda } from '../utils/dom.js';
import { sinAcentos } from '../utils/validadores.js';
import * as repo from '../db/clientes.repo.js';

function enlace(texto, href, clase) {
  return el('a', {
    href: href,
    role: 'button',
    class: clase,
    texto: texto,
    style: 'display:block;text-align:center;padding:13px;border-radius:3px;text-decoration:none;' +
      (clase === 'btn-primario'
        ? 'background:var(--azul);color:#fff'
        : 'background:var(--papel-alto);border:1px solid var(--linea);color:var(--tinta)')
  });
}

export async function render(contenedor) {
  vaciar(contenedor);

  const clientes = await repo.listar();
  clientes.sort(function (a, b) {
    if (a.diaCobro !== b.diaCobro) return (a.diaCobro || 99) - (b.diaCobro || 99);
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  if (clientes.length === 0) {
    contenedor.append(el('div', { class: 'vacio' }, [
      el('p', { texto: 'Todavía no hay clientes en esta ruta.' }),
      el('div', { class: 'acciones' }, [
        enlace('Importar CSV', '#/importar', 'btn-secundario'),
        enlace('Agregar cliente', '#/cliente/nuevo', 'btn-primario')
      ])
    ]));
    return;
  }

  const resumen = el('div', { class: 'resumen' });
  const lista = el('ul', { class: 'lista' });

  const buscador = el('div', { class: 'buscador' }, [
    el('input', {
      type: 'search',
      placeholder: 'Buscar por nombre, referencia o barrio',
      'aria-label': 'Buscar cliente',
      oninput: function (evento) { pintar(evento.target.value); }
    })
  ]);

  function coincide(cliente, aguja) {
    return sinAcentos(cliente.nombre).indexOf(aguja) > -1 ||
      cliente.referencia.indexOf(aguja) > -1 ||
      cliente.documento.indexOf(aguja) > -1 ||
      sinAcentos(cliente.barrio).indexOf(aguja) > -1;
  }

  function pintar(filtro) {
    const aguja = sinAcentos(filtro || '');
    const visibles = aguja
      ? clientes.filter(function (cliente) { return coincide(cliente, aguja); })
      : clientes;

    const porCobrar = visibles.reduce(function (suma, cliente) {
      return suma + (cliente.saldo || 0);
    }, 0);

    vaciar(resumen).append(
      el('span', { texto: visibles.length + (visibles.length === 1 ? ' cliente' : ' clientes') }),
      el('strong', { texto: 'Por cobrar ' + moneda(porCobrar) })
    );

    vaciar(lista);

    if (visibles.length === 0) {
      lista.append(el('li', {}, [
        el('p', { class: 'vacio', style: 'margin:0', texto: 'Ningún cliente coincide.' })
      ]));
      return;
    }

    visibles.forEach(function (cliente) {
      const detalle = [
        cliente.diaCobro ? 'Día ' + cliente.diaCobro : 'Sin día',
        cliente.barrio,
        cliente.direccion
      ].filter(Boolean).join(' · ');

      lista.append(el('li', {}, [
        el('a', { class: 'fila', href: '#/cliente/' + cliente.id }, [
          el('span', { class: 'nombre' }, [
            cliente.nombre,
            cliente.origen === 'manual'
              ? el('span', { class: 'marca-manual', texto: 'manual' })
              : null
          ]),
          el('span', { class: 'detalle', texto: detalle }),
          el('span', {
            class: cliente.saldo > 0 ? 'saldo' : 'saldo cero',
            texto: moneda(cliente.saldo)
          })
        ])
      ]));
    });
  }

  pintar('');
  contenedor.append(buscador, resumen, lista);
}
