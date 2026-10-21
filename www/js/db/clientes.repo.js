/* CRUD de clientes sobre IndexedDB.
   La UI nunca habla con IndexedDB directamente: solo con este módulo. */

import { conTransaccion, pedir, TIENDA_CLIENTES } from './database.js';
import { nuevoId } from '../utils/validadores.js';

function ahora() {
  return new Date().toISOString();
}

export function listar() {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', function (store) {
    return pedir(store.getAll());
  });
}

export function obtener(id) {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', function (store) {
    return pedir(store.get(id));
  });
}

export function obtenerPorReferencia(referencia) {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', function (store) {
    return pedir(store.index('referencia').get(String(referencia)));
  });
}

export function contar() {
  return conTransaccion(TIENDA_CLIENTES, 'readonly', function (store) {
    return pedir(store.count());
  });
}

/** Crea un cliente. `origen`: 'manual' | 'csv'. */
export function crear(datos, origen) {
  const registro = Object.assign({}, datos, {
    id: nuevoId(),
    origen: origen || 'manual',
    createdAt: ahora(),
    updatedAt: ahora()
  });

  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async function (store) {
    await pedir(store.add(registro));
    return registro;
  });
}

/** Actualiza un cliente conservando id, origen y fecha de creación. */
export function actualizar(id, cambios) {
  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async function (store) {
    const actual = await pedir(store.get(id));
    if (!actual) throw new Error('Ese cliente ya no existe.');

    const registro = Object.assign({}, actual, cambios, {
      id: actual.id,
      origen: actual.origen,
      createdAt: actual.createdAt,
      updatedAt: ahora()
    });

    await pedir(store.put(registro));
    return registro;
  });
}

export function eliminar(id) {
  return conTransaccion(TIENDA_CLIENTES, 'readwrite', function (store) {
    return pedir(store.delete(id));
  });
}

/** Borra la cartera dentro de una transacción ya abierta. */
async function borrarTodo(store, conservarManuales) {
  if (!conservarManuales) {
    await pedir(store.clear());
    return;
  }

  const todos = await pedir(store.getAll());
  for (const cliente of todos) {
    if (cliente.origen !== 'manual') await pedir(store.delete(cliente.id));
  }
}

/**
 * Escribe muchos registros en una sola transacción.
 * `operaciones`: [{ tipo: 'crear'|'actualizar', datos }]
 * `opciones.vaciarAntes`: { conservarManuales } borra la cartera en esta
 * misma transacción, para que un fallo al escribir no deje la base vacía.
 */
export function guardarLote(operaciones, opciones) {
  const previo = opciones && opciones.vaciarAntes;

  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async function (store) {
    let creados = 0;
    let actualizados = 0;

    if (previo) {
      await borrarTodo(store, previo.conservarManuales !== false);
    }

    for (const operacion of operaciones) {
      if (operacion.tipo === 'crear') {
        await pedir(store.add(Object.assign({}, operacion.datos, {
          id: operacion.datos.id || nuevoId(),
          origen: operacion.datos.origen || 'csv',
          createdAt: ahora(),
          updatedAt: ahora()
        })));
        creados++;
      } else {
        const actual = await pedir(store.get(operacion.datos.id));

        // Si el registro ya no está (lo borró 'vaciarAntes' u otra pestaña)
        // se guarda igual: perderlo en silencio dejaría filas del CSV fuera.
        await pedir(store.put(Object.assign({}, actual || {}, operacion.datos, {
          id: (actual && actual.id) || operacion.datos.id || nuevoId(),
          origen: (actual && actual.origen) || operacion.datos.origen || 'csv',
          createdAt: (actual && actual.createdAt) || ahora(),
          updatedAt: ahora()
        })));

        if (actual) actualizados++;
        else creados++;
      }
    }

    return { creados: creados, actualizados: actualizados };
  });
}

/**
 * Deja la tienda exactamente con estos registros, tal como vienen.
 * No toca id, origen ni fechas: es para restaurar un respaldo, donde
 * los datos deben quedar idénticos a como se guardaron.
 * Borra y escribe en una sola transacción: si algo falla, no se pierde nada.
 */
export function reemplazarTodo(clientes) {
  return conTransaccion(TIENDA_CLIENTES, 'readwrite', async function (store) {
    await pedir(store.clear());
    for (const cliente of clientes) {
      await pedir(store.add(cliente));
    }
    return clientes.length;
  });
}

/** Borra la cartera. Con `conservarManuales`, respeta los creados a mano. */
export function vaciar(opciones) {
  const conservar = !opciones || opciones.conservarManuales !== false;

  return conTransaccion(TIENDA_CLIENTES, 'readwrite', function (store) {
    return borrarTodo(store, conservar);
  });
}
