/* Formulario de cliente: sirve para crear y para editar. */

import { el, vaciar, avisar, confirmar } from '../utils/dom.js';
import { normalizarCliente, validarCliente, FRECUENCIAS, DIAS } from '../utils/validadores.js';
import * as repo from '../db/clientes.repo.js';

const ETIQUETAS_DIA = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo'
};

const ETIQUETAS_FRECUENCIA = {
  diario: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual'
};

function campo(nombre, etiqueta, control) {
  control.id = `campo-${nombre}`;
  control.name = nombre;

  return el('div', { class: 'campo', dataset: { campo: nombre } }, [
    el('label', { for: control.id, texto: etiqueta }),
    control
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

  const valor = (clave, porDefecto = '') => (cliente ? cliente[clave] ?? porDefecto : porDefecto);

  const formulario = el('form', { novalidate: true }, [
    campo('documento', 'Documento', el('input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'off',
      value: valor('documento'), required: true
    })),

    campo('nombre', 'Nombre completo', el('input', {
      type: 'text', autocomplete: 'name', value: valor('nombre'), required: true
    })),

    el('div', { class: 'par' }, [
      campo('telefono', 'Teléfono', el('input', {
        type: 'tel', inputmode: 'tel', value: valor('telefono')
      })),
      campo('diaCobro', 'Día de cobro', el('select', {}, [
        el('option', { value: '', texto: 'Sin definir' }),
        ...DIAS.map((dia) => el('option', {
          value: dia, texto: ETIQUETAS_DIA[dia], selected: valor('diaCobro') === dia
        }))
      ]))
    ]),

    campo('direccion', 'Dirección', el('input', {
      type: 'text', autocomplete: 'street-address', value: valor('direccion')
    })),

    el('div', { class: 'par' }, [
      campo('montoTotal', 'Monto total', el('input', {
        type: 'text', inputmode: 'decimal', value: valor('montoTotal', '')
      })),
      campo('saldo', 'Saldo pendiente', el('input', {
        type: 'text', inputmode: 'decimal', value: valor('saldo', '')
      }))
    ]),

    el('div', { class: 'par' }, [
      campo('cuota', 'Valor de la cuota', el('input', {
        type: 'text', inputmode: 'decimal', value: valor('cuota', '')
      })),
      campo('frecuencia', 'Frecuencia', el('select', {}, FRECUENCIAS.map((frecuencia) =>
        el('option', {
          value: frecuencia,
          texto: ETIQUETAS_FRECUENCIA[frecuencia],
          selected: valor('frecuencia', 'diario') === frecuencia
        })
      )))
    ]),

    campo('notas', 'Notas', el('textarea', { rows: 3 }, valor('notas'))),

    el('div', { class: 'acciones' }, [
      el('button', { type: 'button', class: 'btn-secundario', texto: 'Cancelar', onclick: () => history.back() }),
      el('button', { type: 'submit', class: 'btn-primario', texto: editando ? 'Guardar cambios' : 'Guardar cliente' })
    ]),

    editando
      ? el('div', { class: 'acciones' }, [
          el('button', {
            type: 'button', class: 'btn-peligro', texto: 'Eliminar cliente',
            onclick: async () => {
              const seguro = await confirmar(`¿Eliminar a ${cliente.nombre} de la ruta?`, 'Eliminar');
              if (!seguro) return;
              await repo.eliminar(cliente.id);
              avisar('Cliente eliminado', 'exito');
              location.hash = '#/clientes';
            }
          })
        ])
      : null
  ]);

  function limpiarErrores() {
    formulario.querySelectorAll('.error-campo').forEach((nodo) => nodo.remove());
    formulario.querySelectorAll('[aria-invalid]').forEach((nodo) => nodo.removeAttribute('aria-invalid'));
  }

  function mostrarErrores(errores) {
    for (const [nombre, mensaje] of Object.entries(errores)) {
      const bloque = formulario.querySelector(`[data-campo="${nombre}"]`);
      if (!bloque) continue;
      bloque.querySelector('input, select, textarea')?.setAttribute('aria-invalid', 'true');
      bloque.append(el('p', { class: 'error-campo', texto: mensaje }));
    }
    formulario.querySelector('[aria-invalid="true"]')?.focus();
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarErrores();

    const datos = Object.fromEntries(new FormData(formulario).entries());
    const candidato = normalizarCliente(datos);
    const errores = validarCliente(candidato);

    const repetido = await repo.obtenerPorDocumento(candidato.documento);
    if (repetido && repetido.id !== id) {
      errores.documento = `Ese documento ya está en la ruta (${repetido.nombre}).`;
    }

    if (Object.keys(errores).length) {
      mostrarErrores(errores);
      return;
    }

    try {
      if (editando) {
        await repo.actualizar(cliente.id, candidato);
        avisar('Cambios guardados', 'exito');
      } else {
        await repo.crear(candidato, 'manual');
        avisar('Cliente agregado', 'exito');
      }
      location.hash = '#/clientes';
    } catch (error) {
      avisar(error.message || 'No se pudo guardar.', 'error');
    }
  });

  contenedor.append(formulario);
}
