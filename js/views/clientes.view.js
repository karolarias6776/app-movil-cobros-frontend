/* Lista de clientes con búsqueda. */

import { el, vaciar, moneda } from '../utils/dom.js';
import { sinAcentos } from '../utils/validadores.js';
import * as repo from '../db/clientes.repo.js';

export async function render(contenedor) {
  vaciar(contenedor);

  const clientes = (await repo.listar()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (clientes.length === 0) {
    contenedor.append(
      el('div', { class: 'vacio' }, [
        el('p', { texto: 'Todavía no hay clientes en esta ruta.' }),
        el('div', { class: 'acciones' }, [
          el('a', { class: 'btn-secundario', href: '#/importar', role: 'button', style: 'display:block;text-align:center;padding:13px;border-radius:3px;border:1px solid var(--linea);text-decoration:none', texto: 'Importar CSV' }),
          el('a', { class: 'btn-primario', href: '#/cliente/nuevo', role: 'button', style: 'display:block;text-align:center;padding:13px;border-radius:3px;background:var(--azul);color:#fff;text-decoration:none', texto: 'Agregar cliente' })
        ])
      ])
    );
    return;
  }

  const resumen = el('div', { class: 'resumen' });
  const lista = el('ul', { class: 'lista' });

  const buscador = el('div', { class: 'buscador' }, [
    el('input', {
      type: 'search',
      placeholder: 'Buscar por nombre o documento',
      'aria-label': 'Buscar cliente',
      oninput: (evento) => pintar(evento.target.value)
    })
  ]);

  function pintar(filtro = '') {
    const aguja = sinAcentos(filtro);
    const visibles = aguja
      ? clientes.filter((cliente) =>
          sinAcentos(cliente.nombre).includes(aguja) || cliente.documento.includes(aguja))
      : clientes;

    const porCobrar = visibles.reduce((suma, cliente) => suma + (cliente.saldo || 0), 0);

    vaciar(resumen).append(
      el('span', { texto: `${visibles.length} ${visibles.length === 1 ? 'cliente' : 'clientes'}` }),
      el('strong', { texto: `Por cobrar ${moneda(porCobrar)}` })
    );

    vaciar(lista);

    if (visibles.length === 0) {
      lista.append(el('li', {}, [
        el('p', { class: 'vacio', style: 'margin:0', texto: 'Ningún cliente coincide con esa búsqueda.' })
      ]));
      return;
    }

    for (const cliente of visibles) {
      const detalle = [cliente.documento, cliente.direccion].filter(Boolean).join(' · ');

      lista.append(el('li', {}, [
        el('a', { class: 'fila', href: `#/cliente/${cliente.id}` }, [
          el('span', { class: 'nombre' }, [
            cliente.nombre,
            cliente.origen === 'manual'
              ? el('span', { class: 'marca-manual', texto: 'manual' })
              : null
          ]),
          el('span', { class: 'detalle', texto: detalle || 'Sin datos de contacto' }),
          el('span', {
            class: `saldo${cliente.saldo > 0 ? '' : ' cero'}`,
            texto: moneda(cliente.saldo)
          })
        ])
      ]));
    }
  }

  pintar();
  contenedor.append(buscador, resumen, lista);
}
