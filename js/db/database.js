/* Conexión a IndexedDB.
   Para agregar campos: sube DB_VERSION y añade un bloque
   `if (versionAnterior < N)` en migrar(). */

const DB_NOMBRE = 'ruta-cobro';
const DB_VERSION = 2;

export const TIENDA_CLIENTES = 'clientes';

let conexion = null;

function crearTiendaClientes(db) {
  const clientes = db.createObjectStore(TIENDA_CLIENTES, { keyPath: 'id' });
  clientes.createIndex('referencia', 'referencia', { unique: true });
  clientes.createIndex('documento', 'documento', { unique: false });
  clientes.createIndex('nombre', 'nombre', { unique: false });
  clientes.createIndex('barrio', 'barrio', { unique: false });
  clientes.createIndex('diaCobro', 'diaCobro', { unique: false });
  clientes.createIndex('origen', 'origen', { unique: false });
}

function migrar(db, versionAnterior) {
  // v2 cambió la clave única de documento a referencia de pago.
  // La v1 nunca llegó a tener datos reales, así que se rehace la tienda.
  if (versionAnterior < 2) {
    if (db.objectStoreNames.contains(TIENDA_CLIENTES)) {
      db.deleteObjectStore(TIENDA_CLIENTES);
    }
    crearTiendaClientes(db);
  }
}

export function abrirDB() {
  if (conexion) return conexion;

}

/** Convierte una IDBRequest en promesa. */
export function pedir(solicitud) {
  return new Promise(function (resolver, rechazar) {
    solicitud.onsuccess = function () { resolver(solicitud.result); };
    solicitud.onerror = function () { rechazar(solicitud.error); };
  });
}

/** Ejecuta `trabajo(store)` y resuelve cuando la transacción termina. */
export async function conTransaccion(tienda, modo, trabajo) {
  const db = await abrirDB();

  return new Promise(function (resolver, rechazar) {
    const transaccion = db.transaction(tienda, modo);
    const store = transaccion.objectStore(tienda);
    let resultado;

    transaccion.oncomplete = function () { resolver(resultado); };
    transaccion.onerror = function () { rechazar(transaccion.error); };
    transaccion.onabort = function () {
      rechazar(transaccion.error || new Error('Transacción cancelada.'));
    };

    Promise.resolve(trabajo(store, transaccion))
      .then(function (valor) { resultado = valor; })
      .catch(function (error) {
        try { transaccion.abort(); } catch (ignorado) { /* ya abortada */ }
        rechazar(error);
      });
  });
}
