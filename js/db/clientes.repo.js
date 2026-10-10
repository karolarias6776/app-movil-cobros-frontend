/* CRUD de clientes sobre IndexedDB.
   La UI nunca habla con IndexedDB directamente: solo con este módulo. */

import { conTransaccion, pedir, TIENDA_CLIENTES } from './database.js';
import { nuevoId } from '../utils/validadores.js';

const ahora = () => new Date().toISOString();

export function listar() {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', (store) => pedir(store.getAll()));
}

export function obtener(id) {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', (store) => pedir(store.get(id)));
}

export function obtenerPorDocumento(documento) {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', (store) =>
    pedir(store.index('documento').get(String(documento)))
  );
}

export function contar() {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', (store) => pedir(store.count()));
}

/** Crea un cliente. `origen`: 'manual' | 'csv'. */
export function crear(datos, origen = 'manual') {
  const registro = {
    ...datos,
    id: nuevoId(),
    origen,
    createdAt: ahora(),
    updatedAt: ahora()
  };

  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async (store) => {
    await pedir(store.add(registro));
    return registro;
  });
}

/** Actualiza campos de un cliente existente y conserva id/origen/createdAt. */
export function actualizar(id, cambios) {
  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async (store) => {
    const actual = await pedir(store.get(id));
    if (!actual) throw new Error('Ese cliente ya no existe.');

    const registro = {
      ...actual,
      ...cambios,
      id: actual.id,
      origen: actual.origen,
      createdAt: actual.createdAt,
      updatedAt: ahora()
    };

    await pedir(store.put(registro));
    return registro;
  });
}

export function eliminar(id) {
  return conTransaccion(TIENDA_CLIENTES, 'readwrite', (store) => pedir(store.delete(id)));
}

/**
 * Escribe muchos registros en una sola transacción.
 * `operaciones`: [{ tipo: 'crear'|'actualizar', datos }]
 */
export function guardarLote(operaciones) {
  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async (store) => {
    let creados = 0;
    let actualizados = 0;

    for (const operacion of operaciones) {
      if (operacion.tipo === 'crear') {
        await pedir(store.add({
          ...operacion.datos,
          id: operacion.datos.id || nuevoId(),
          origen: operacion.datos.origen || 'csv',
          createdAt: ahora(),
          updatedAt: ahora()
        }));
        creados++;
      } else {
        const actual = await pedir(store.get(operacion.datos.id));
        if (!actual) continue;
        await pedir(store.put({
          ...actual,
          ...operacion.datos,
          id: actual.id,
          origen: actual.origen,
          createdAt: actual.createdAt,
          updatedAt: ahora()
        }));
        actualizados++;
      }
    }

    return { creados, actualizados };
  });
}

/** Borra la cartera. Con `conservarManuales`, respeta los creados a mano. */
export function vaciar({ conservarManuales = true } = {}) {
  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async (store) => {
    if (!conservarManuales) {
      await pedir(store.clear());
      return;
    }

    const todos = await pedir(store.getAll());
    for (const cliente of todos) {
      if (cliente.origen !== 'manual') await pedir(store.delete(cliente.id));
    }
  });
}
