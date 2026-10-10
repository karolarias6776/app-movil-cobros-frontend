/* Conexión a IndexedDB.
   Para agregar campos nuevos: sube DB_VERSION y añade un bloque
   `if (versionAnterior < N)` en migrar(). Los datos existentes se conservan. */

const DB_NOMBRE = 'ruta-cobro';
const DB_VERSION = 1;

export const TIENDA_CLIENTES = 'clientes';

let conexion = null;

function migrar(db, versionAnterior) {
  if (versionAnterior < 1) {
    const clientes = db.createObjectStore(TIENDA_CLIENTES, { keyPath: 'id' });
    clientes.createIndex('documento', 'documento', { unique: true });
    clientes.createIndex('nombre', 'nombre', { unique: false });
    clientes.createIndex('diaCobro', 'diaCobro', { unique: false });
    clientes.createIndex('origen', 'origen', { unique: false });
  }
}

export function abrirDB() {
  if (conexion) return conexion;

  conexion = new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);

    solicitud.onupgradeneeded = (evento) => {
      migrar(solicitud.result, evento.oldVersion);
    };

    solicitud.onsuccess = () => {
      const db = solicitud.result;
      db.onversionchange = () => db.close();
      resolver(db);
    };

    solicitud.onerror = () => rechazar(solicitud.error);
    solicitud.onblocked = () => rechazar(new Error('Cierra las otras pestañas de la app para actualizar la base.'));
  });

  return conexion;
}

/** Convierte una IDBRequest en promesa. */
export function pedir(solicitud) {
  return new Promise((resolver, rechazar) => {
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

/**
 * Ejecuta `trabajo(store)` dentro de una transacción y resuelve
 * cuando la transacción termina de escribir en disco.
 */
export async function conTransaccion(tienda, modo, trabajo) {
  const db = await abrirDB();

  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(tienda, modo);
    const store = transaccion.objectStore(tienda);
    let resultado;

    transaccion.oncomplete = () => resolver(resultado);
    transaccion.onerror = () => rechazar(transaccion.error);
    transaccion.onabort = () => rechazar(transaccion.error || new Error('Transacción cancelada.'));

    Promise.resolve(trabajo(store, transaccion))
      .then((valor) => { resultado = valor; })
      .catch((error) => {
        try { transaccion.abort(); } catch (_) { /* ya estaba abortada */ }
        rechazar(error);
      });
  });
}
