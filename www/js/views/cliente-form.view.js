/* Formulario de cliente: sirve para crear y para editar. */

import { el, vaciar, avisar, confirmar } from '../utils/dom.js';
import { normalizarCliente, validarCliente } from '../utils/validadores.js';
import * as repo from '../db/clientes.repo.js';

function campo(nombre, etiqueta, control, ayuda) {
  control.id = 'campo-' + nombre;
  control.name = nombre;

  return el('div', { class: 'campo', dataset: { campo: nombre } }, [
    el('label', { for: control.id, texto: etiqueta }),
    control,
    ayuda ? el('small', { style: 'color:var(--tinta-suave);font-size:13px', texto: ayuda }) : null
  ]);
}

export async function render(contenedor, id) {
  vaciar(contenedor);

  const editando = Boolean(id) && id !== 'nuevo';
  const cliente = editando ? await repo.obtener(id) : null;

  if (editando && !cliente) {
    contenedor.append(el('div', { class: 'vacio' }, [
      el('p', { texto: 'Ese cliente ya no está en la base.' }),
      el('a', { href: '#/clientes', texto: 'Volver a la lista' })
    ]));
    return;
  }

  function valor(clave, porDefecto) {
    const respaldo = porDefecto === undefined ? '' : porDefecto;
    if (!cliente) return respaldo;
    const dato = cliente[clave];
    if (dato === null || dato === undefined || dato === 0) return respaldo;
    return dato;
  }

  const formulario = el('form', { novalidate: true }, [
    campo('referencia', 'Referencia de pago', el('input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'off',
      value: valor('referencia'), required: true
    })),

    campo('nombre', 'Nombre completo', el('input', {
      type: 'text', autocomplete: 'name', value: valor('nombre'), required: true
    })),

    campo('documento', 'Documento', el('input', {
      type: 'text', inputmode: 'numeric', value: valor('documento')
    }), 'Opcional'),

    el('div', { class: 'par' }, [
      campo('barrio', 'Barrio', el('input', {
        type: 'text', value: valor('barrio')
      })),
      campo('diaCobro', 'Día de cobro', el('input', {
        type: 'number', inputmode: 'numeric', min: 1, max: 31,
        value: valor('diaCobro')
      }))
    ]),
    el('div', { class: 'par' }, [
      campo('horaCobro', 'Hora de visita', el('input', {
        type: 'time', value: valor('horaCobro')
      }), 'Opcional'),
      campo('anticipacionMin', 'Avisarme antes (min)', el('input', {
        type: 'number', inputmode: 'numeric', min: 0, max: 720,
        value: cliente && cliente.anticipacionMin !== null && cliente.anticipacionMin !== undefined
          ? cliente.anticipacionMin : ''
      }), 'Vacío usa el global')
    ]),

    campo('direccion', 'Dirección', el('input', {
      type: 'text', autocomplete: 'street-address', value: valor('direccion')
    })),

    campo('telefonos', 'Teléfonos', el('input', {
      type: 'text', inputmode: 'tel',
      value: cliente && cliente.telefonos ? cliente.telefonos.join(', ') : ''
    }), 'Separados por coma si hay varios'),

    campo('campania', 'Campaña o plan', el('input', {
      type: 'text', value: valor('campania')
    })),

    el('div', { class: 'par' }, [
      campo('tarifa', 'Tarifa mensual', el('input', {
        type: 'text', inputmode: 'decimal', value: valor('tarifa')
      })),
      campo('cuota', 'Cuota que suele pagar', el('input', {
        type: 'text', inputmode: 'decimal', value: valor('cuota')
      }))
    ]),

    el('div', { class: 'par' }, [
      campo('saldo', 'Saldo pendiente', el('input', {
        type: 'text', inputmode: 'decimal', value: valor('saldo')
      })),
      campo('edad', 'Facturas debidas', el('input', {
        type: 'text', inputmode: 'decimal', value: valor('edad')
      }))
    ]),

    campo('ultimoPago', 'Último pago', el('input', {
      type: 'date', value: valor('ultimoPago')
    })),

    campo('notas', 'Notas', el('textarea', { rows: 3 }, valor('notas'))),

    el('div', { class: 'acciones' }, [
      el('button', {
        type: 'button', class: 'btn-secundario', texto: 'Cancelar',
        onclick: function () { history.back(); }
      }),
      el('button', {
        type: 'submit', class: 'btn-primario',
        texto: editando ? 'Guardar cambios' : 'Guardar cliente'
      })
    ]),

    editando ? el('div', { class: 'acciones' }, [
      el('button', {
        type: 'button', class: 'btn-peligro', texto: 'Eliminar cliente',
        onclick: async function () {
          const seguro = await confirmar('¿Eliminar a ' + cliente.nombre + ' de la ruta?', 'Eliminar');
          if (!seguro) return;
          await repo.eliminar(cliente.id);
          avisar('Cliente eliminado', 'exito');
          location.hash = '#/clientes';
        }
      })
    ]) : null
  ]);

  function limpiarErrores() {
    const marcas = formulario.querySelectorAll('.error-campo');
    for (let i = 0; i < marcas.length; i++) marcas[i].remove();

    const invalidos = formulario.querySelectorAll('[aria-invalid]');
    for (let i = 0; i < invalidos.length; i++) invalidos[i].removeAttribute('aria-invalid');
  }

  function mostrarErrores(errores) {
    for (const nombre in errores) {
      const bloque = formulario.querySelector('[data-campo="' + nombre + '"]');
      if (!bloque) continue;
      const control = bloque.querySelector('input, select, textarea');
      if (control) control.setAttribute('aria-invalid', 'true');
      bloque.append(el('p', { class: 'error-campo', texto: errores[nombre] }));
    }
    const primero = formulario.querySelector('[aria-invalid="true"]');
    if (primero) primero.focus();
  }

  formulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    limpiarErrores();

    const datos = {};
    new FormData(formulario).forEach(function (dato, nombre) { datos[nombre] = dato; });

    const candidato = normalizarCliente(datos);
    const errores = validarCliente(candidato);

    const repetido = await repo.obtenerPorReferencia(candidato.referencia);
    if (repetido && repetido.id !== id) {
      errores.referencia = 'Esa referencia ya está en la ruta (' + repetido.nombre + ').';
    }

    if (Object.keys(errores).length) {
      mostrarErrores(errores);
      return;
    }

    try {
      if (editando) {
        await repo.actualizar(cliente.id, candidato);
        avisar('Cambios guardados', 'exito');
        location.hash = '#/cliente/' + cliente.id;
      } else {
        const creado = await repo.crear(candidato, 'manual');
        avisar('Cliente agregado', 'exito');
        location.hash = '#/cliente/' + creado.id;
      }
    } catch (error) {
      avisar(error.message || 'No se pudo guardar.', 'error');
    }
  });

  contenedor.append(formulario);
}
