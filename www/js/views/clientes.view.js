/* Lista de clientes: buscar, filtrar y ordenar.

   El buscador va arriba con un botón de filtros al lado, que despliega
   el panel. Los filtros se recuerdan mientras dure la sesión: volver de
   una ficha no debe obligar a elegirlos otra vez. */

import { el, vaciar, moneda } from '../utils/dom.js';
import { sinAcentos } from '../utils/validadores.js';
import * as repo from '../db/clientes.repo.js';
import { yaCobrado } from '../services/cobros.service.js';
import { hoy, formatearFechaCorta, desdeISO, diasEntre } from '../services/fechas.service.js';

const ORDENES = [
  { id: 'dia', texto: 'Día de cobro' },
  { id: 'nombre', texto: 'Nombre (A-Z)' },
  { id: 'saldo', texto: 'Saldo, del mayor' },
  { id: 'facturas', texto: 'Facturas debidas, de más a menos' },
  { id: 'pago-viejo', texto: 'Último pago, del más antiguo' },
  { id: 'pago-nuevo', texto: 'Último pago, del más reciente' }
];

const ESTADOS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'pendientes', texto: 'Falta cobrarles este mes' },
  { id: 'cobrados', texto: 'Ya cobrados este mes' }
];

const FACTURAS = [
  { id: 'todas', texto: 'Las que sea', minimo: 0 },
  { id: '1', texto: 'Deben 1 o más', minimo: 1 },
  { id: '2', texto: 'Deben 2 o más', minimo: 2 },
  { id: '3', texto: 'Deben 3 o más', minimo: 3 }
];

// Se conservan entre visitas a la lista, no entre arranques de la app.
let filtros = { texto: '', barrio: '', estado: 'todos', facturas: 'todas', orden: 'dia' };

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

function iconoFiltro() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const trazo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trazo.setAttribute('d', 'M3 5h18l-7 8v6l-4 2v-8z');
  svg.append(trazo);
  return svg;
}

/** Cuántos filtros hay puestos, sin contar el texto del buscador. */
function cuantosFiltros() {
  let total = 0;
  if (filtros.barrio) total++;
  if (filtros.estado !== 'todos') total++;
  if (filtros.facturas !== 'todas') total++;
  if (filtros.orden !== 'dia') total++;
  return total;
}

/** Días sin pagar, o null si nunca pagó. Sirve para ordenar y para mostrar. */
function diasSinPagar(cliente, fecha) {
  const pago = desdeISO(cliente.ultimoPago);
  return pago ? diasEntre(pago, fecha) : null;
}

export async function render(contenedor) {
  vaciar(contenedor);

  const clientes = await repo.listar();

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

  const fecha = hoy();

  // Los barrios que existen de verdad en la cartera, sin repetir.
  const barrios = [];
  clientes.forEach(function (cliente) {
    if (cliente.barrio && barrios.indexOf(cliente.barrio) === -1) barrios.push(cliente.barrio);
  });
  barrios.sort(function (a, b) { return a.localeCompare(b, 'es'); });

  // Si el barrio guardado ya no existe (cambió la cartera), se suelta.
  if (filtros.barrio && barrios.indexOf(filtros.barrio) === -1) filtros.barrio = '';

  const resumen = el('div', { class: 'resumen' });
  const lista = el('ul', { class: 'lista' });
  const panel = el('div', { class: 'panel-filtros', hidden: true });

  // ---------- Buscador y botón de filtros ----------

  const campoTexto = el('input', {
    type: 'search',
    placeholder: 'Buscar por nombre, referencia o barrio',
    'aria-label': 'Buscar cliente',
    value: filtros.texto,
    oninput: function (evento) {
      filtros.texto = evento.target.value;
      pintar();
    }
  });

  const marcaFiltros = el('span', { class: 'cuenta-filtros', hidden: true });

  const botonFiltros = el('button', {
    type: 'button',
    class: 'btn-filtros',
    'aria-expanded': 'false',
    'aria-label': 'Filtros',
    onclick: function () {
      const abierto = !panel.hidden;
      panel.hidden = abierto;
      botonFiltros.setAttribute('aria-expanded', abierto ? 'false' : 'true');
    }
  }, [iconoFiltro(), marcaFiltros]);

  const buscador = el('div', { class: 'buscador' }, [campoTexto, botonFiltros]);

  // ---------- Panel de filtros ----------

  function grupo(etiqueta, control) {
    return el('div', { class: 'campo-filtro' }, [
      el('label', { texto: etiqueta }),
      control
    ]);
  }

  function opciones(lista, seleccionado) {
    return lista.map(function (opcion) {
      return el('option', {
        value: opcion.id,
        texto: opcion.texto,
        selected: opcion.id === seleccionado
      });
    });
  }

  const selBarrio = el('select', {
    onchange: function (evento) { filtros.barrio = evento.target.value; pintar(); }
  }, [el('option', { value: '', texto: 'Todos los barrios' })].concat(
    barrios.map(function (barrio) {
      return el('option', { value: barrio, texto: barrio, selected: barrio === filtros.barrio });
    })
  ));

  const selEstado = el('select', {
    onchange: function (evento) { filtros.estado = evento.target.value; pintar(); }
  }, opciones(ESTADOS, filtros.estado));

  const selFacturas = el('select', {
    onchange: function (evento) { filtros.facturas = evento.target.value; pintar(); }
  }, opciones(FACTURAS, filtros.facturas));

  const selOrden = el('select', {
    onchange: function (evento) { filtros.orden = evento.target.value; pintar(); }
  }, opciones(ORDENES, filtros.orden));

  const botonLimpiar = el('button', {
    type: 'button', class: 'btn-tenue', texto: 'Quitar los filtros',
    onclick: function () {
      filtros = { texto: filtros.texto, barrio: '', estado: 'todos', facturas: 'todas', orden: 'dia' };
      selBarrio.value = '';
      selEstado.value = 'todos';
      selFacturas.value = 'todas';
      selOrden.value = 'dia';
      pintar();
    }
  });

  panel.append(
    grupo('Barrio', selBarrio),
    grupo('Estado del cobro', selEstado),
    grupo('Facturas debidas', selFacturas),
    grupo('Ordenar por', selOrden),
    el('div', { class: 'acciones', style: 'margin-top:4px' }, [botonLimpiar])
  );

  // ---------- Filtrar y ordenar ----------

  function coincide(cliente, aguja) {
    return sinAcentos(cliente.nombre).indexOf(aguja) > -1 ||
      cliente.referencia.indexOf(aguja) > -1 ||
      cliente.documento.indexOf(aguja) > -1 ||
      sinAcentos(cliente.barrio).indexOf(aguja) > -1 ||
      sinAcentos(cliente.direccion).indexOf(aguja) > -1;
  }

  function pasaLosFiltros(cliente) {
    if (filtros.barrio && cliente.barrio !== filtros.barrio) return false;

    if (filtros.estado !== 'todos') {
      const cobrado = yaCobrado(cliente, fecha);
      if (filtros.estado === 'cobrados' && !cobrado) return false;
      if (filtros.estado === 'pendientes' && cobrado) return false;
    }

    const minimo = (FACTURAS.filter(function (f) { return f.id === filtros.facturas; })[0] || {}).minimo || 0;
    if (minimo && (cliente.edad || 0) < minimo) return false;

    return true;
  }

  function ordenar(lista) {
    const porNombre = function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); };

    const criterios = {
      dia: function (a, b) {
        if (a.diaCobro !== b.diaCobro) return (a.diaCobro || 99) - (b.diaCobro || 99);
        return porNombre(a, b);
      },
      nombre: porNombre,
      saldo: function (a, b) { return (b.saldo || 0) - (a.saldo || 0) || porNombre(a, b); },
      facturas: function (a, b) { return (b.edad || 0) - (a.edad || 0) || porNombre(a, b); },
      // Quien nunca ha pagado va primero: es el caso más urgente.
      'pago-viejo': function (a, b) {
        const unA = a.ultimoPago || '';
        const unB = b.ultimoPago || '';
        if (unA === unB) return porNombre(a, b);
        if (!unA) return -1;
        if (!unB) return 1;
        return unA < unB ? -1 : 1;
      },
      'pago-nuevo': function (a, b) {
        const unA = a.ultimoPago || '';
        const unB = b.ultimoPago || '';
        if (unA === unB) return porNombre(a, b);
        if (!unA) return 1;
        if (!unB) return -1;
        return unA > unB ? -1 : 1;
      }
    };

    return lista.slice().sort(criterios[filtros.orden] || criterios.dia);
  }

  // ---------- Pintar ----------

  function pintar() {
    const aguja = sinAcentos(filtros.texto || '');

    const visibles = ordenar(clientes.filter(function (cliente) {
      if (!pasaLosFiltros(cliente)) return false;
      return aguja ? coincide(cliente, aguja) : true;
    }));

    const puestos = cuantosFiltros();
    marcaFiltros.hidden = puestos === 0;
    marcaFiltros.textContent = String(puestos);
    botonFiltros.classList.toggle('con-filtros', puestos > 0);

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
        el('p', {
          class: 'vacio',
          style: 'margin:0',
          texto: puestos ? 'Ningún cliente cumple esos filtros.' : 'Ningún cliente coincide.'
        })
      ]));
      return;
    }

    const miraElPago = filtros.orden === 'pago-viejo' || filtros.orden === 'pago-nuevo';

    visibles.forEach(function (cliente) {
      // Lo que se muestra debajo del nombre cambia con lo que se ordena:
      // si se mira el último pago, el día de cobro estorba.
      const detalle = miraElPago
        ? [
            cliente.ultimoPago
              ? 'Pagó el ' + formatearFechaCorta(cliente.ultimoPago)
              : 'Sin pagos registrados',
            cliente.barrio
          ].filter(Boolean).join(' · ')
        : [
            cliente.diaCobro ? 'Día ' + cliente.diaCobro : 'Sin día',
            cliente.barrio,
            cliente.direccion
          ].filter(Boolean).join(' · ');

      const dias = diasSinPagar(cliente, fecha);

      lista.append(el('li', {}, [
        el('a', { class: 'fila', href: '#/cliente/' + cliente.id }, [
          el('span', { class: 'nombre' }, [
            cliente.nombre,
            yaCobrado(cliente, fecha)
              ? el('span', { class: 'marca-cobrado-mini', texto: 'cobrado' })
              : null,
            cliente.edad > 0
              ? el('span', {
                  class: 'marca-facturas',
                  texto: cliente.edad + (cliente.edad === 1 ? ' factura' : ' facturas')
                })
              : null,
            cliente.origen === 'manual'
              ? el('span', { class: 'marca-manual', texto: 'manual' })
              : null
          ]),
          el('span', { class: 'detalle', texto: detalle }),
          el('span', {
            class: cliente.saldo > 0 ? 'saldo' : 'saldo cero',
            texto: moneda(cliente.saldo)
          }),
          miraElPago && dias !== null && dias > 45
            ? el('span', { class: 'detalle-dias', texto: 'hace ' + dias + ' días' })
            : null
        ])
      ]));
    });
  }

  pintar();
  contenedor.append(buscador, panel, resumen, lista);
}
