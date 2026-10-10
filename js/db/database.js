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
  // La v1 no llegó a tener datos reales, así que se rehace la tienda.
  if (versionAnterior < 2) {
    if (db.objectStoreNames.contains(TIENDA_CLIENTES)) {
      db.deleteObjectStore(TIENDA_CLIENTES);
    }
    crearTiendaClientes(db);
  }
}

export function abrirDB() {
  if (conexion) return conexion;

  conexion = new Promise(function (resolver, rechazar) {
    if (!window.indexedDB) {
      rechazar(new Error('Este navegador no permite guardar datos locales. ' +
        'Si estás en modo incógnito, abre la app en una pestaña normal.'));
      return;
    }

    let solicitud;
    try {
      solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);
    } catch (error) {
      rechazar(new Error('No se pudo abrir la base: ' + error.message));
      return;
    }

    solicitud.onupgradeneeded = function (evento) {
      try {
        migrar(solicitud.result, evento.oldVersion);
      } catch (error) {
        rechazar(new Error('Falló la migración a la versión ' + DB_VERSION + ': ' + error.message));
      }
    };

    solicitud.onsuccess = function () {
      const db = solicitud.result;
      if (!db) {
        rechazar(new Error('La base abrió vacía. Borra los datos del sitio y recarga.'));
        return;
      }
      db.onversionchange = function () { db.close(); conexion = null; };
      resolver(db);
    };

    solicitud.onerror = function () {
      const detalle = solicitud.error ? solicitud.error.message : 'motivo desconocido';
      rechazar(new Error('No se pudo abrir la base: ' + detalle));
    };

    solicitud.onblocked = function () {
      rechazar(new Error('Hay otra pestaña de la app abierta con la versión anterior. ' +
        'Ciérralas todas y vuelve a entrar.'));
    };
  });

  // Si falla, no dejamos la promesa rota cacheada: el próximo intento reabre.
  conexion.catch(function () { conexion = null; });

  return conexion;
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

  if (!db || typeof db.transaction !== 'function') {
    throw new Error('La base de datos no está disponible en este navegador.');
  }

  if (!db.objectStoreNames.contains(tienda)) {
    throw new Error('Falta la tabla "' + tienda + '". Borra los datos del sitio y recarga.');
  }

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
