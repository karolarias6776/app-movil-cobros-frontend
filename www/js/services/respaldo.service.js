/* Respaldo de la cartera completa.
   El CSV de facturación no sirve de respaldo: no trae los clientes
   creados a mano, ni las notas, horas de visita o anticipaciones que
   puso la cobradora. Esto guarda y devuelve los registros tal cual,
   con su id y sus fechas, para poder cambiar de celular sin perder nada. */

import * as repo from '../db/clientes.repo.js';
import { leerConfig, guardarConfig } from './config.js';
import { descargarArchivo, selloDeHoy } from '../utils/descargas.js';

const FORMATO = 'ruta-cobro-respaldo';
const VERSION = 1;

/** Arma el objeto del respaldo con la cartera y los ajustes. */
export async function construirRespaldo() {
  const clientes = await repo.listar();

  return {
    formato: FORMATO,
    version: VERSION,
    creado: new Date().toISOString(),
    config: leerConfig(),
    clientes: clientes
  };
}

export async function descargarRespaldo() {
  const respaldo = await construirRespaldo();

  if (respaldo.clientes.length === 0) {
    throw new Error('No hay clientes que respaldar.');
  }

  descargarArchivo(
    'ruta-de-cobro-respaldo-' + selloDeHoy() + '.json',
    JSON.stringify(respaldo, null, 2),
    'application/json;charset=utf-8'
  );

  return respaldo.clientes.length;
}

export function leerArchivo(archivo) {
  return new Promise(function (resolver, rechazar) {
    const lector = new FileReader();
    lector.onload = function () { resolver(String(lector.result)); };
    lector.onerror = function () { rechazar(new Error('No se pudo leer el archivo.')); };
    lector.readAsText(archivo, 'UTF-8');
  });
}

/**
 * Revisa el archivo sin tocar la base.
 * Devuelve { clientes, config, creado, total }. Lanza si no sirve.
 */
export function revisarRespaldo(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (error) {
    throw new Error('Ese archivo no es un respaldo: no se pudo leer como JSON.');
  }

  if (!datos || datos.formato !== FORMATO) {
    throw new Error('Ese archivo no es un respaldo de Ruta de cobro.');
  }

  if (datos.version > VERSION) {
    throw new Error('El respaldo viene de una versión más nueva de la app. Actualízala primero.');
  }

  if (!Array.isArray(datos.clientes) || datos.clientes.length === 0) {
    throw new Error('El respaldo no tiene clientes.');
  }

  // La referencia es la clave única: si viene repetida, la base entera
  // se rechazaría a mitad de camino. Mejor avisar antes de borrar nada.
  const vistas = {};
  datos.clientes.forEach(function (cliente, indice) {
    if (!cliente || !cliente.id || !cliente.referencia || !cliente.nombre) {
      throw new Error('El respaldo está dañado: el registro ' + (indice + 1) +
        ' no tiene id, referencia o nombre.');
    }
    if (vistas[cliente.referencia]) {
      throw new Error('El respaldo está dañado: la referencia ' +
        cliente.referencia + ' aparece dos veces.');
    }
    vistas[cliente.referencia] = true;
  });

  return {
    clientes: datos.clientes,
    config: datos.config || null,
    creado: datos.creado || '',
    total: datos.clientes.length
  };
}

/**
 * Deja la cartera igual que en el respaldo. Borra lo que haya.
 * Con `restaurarConfig`, devuelve también los ajustes guardados.
 */
export async function restaurarRespaldo(revisado, opciones) {
  const config = opciones || {};

  const total = await repo.reemplazarTodo(revisado.clientes);

  if (config.restaurarConfig !== false && revisado.config) {
    guardarConfig(revisado.config);
  }

  return total;
}
