/* Reglas de importación del CSV:
   qué entra, qué choca con lo guardado y qué se respeta.
   La clave para comparar es la referencia de pago. */

import { parsearClientes } from './csv.service.js';
import * as repo from '../db/clientes.repo.js';
import { normalizarCliente, validarCliente } from '../utils/validadores.js';

/** Lee el CSV y lo contrasta con la base, sin escribir nada. */
export async function previsualizar(texto) {
  const lectura = parsearClientes(texto);

  if (lectura.faltantes.length) {
    return {
      bloqueado: true,
      faltantes: lectura.faltantes,
      sinReconocer: lectura.sinReconocer,
      nuevos: [],
      repetidos: [],
      choquesManuales: [],
      invalidos: [],
      totalFilas: 0
    };
  }

  const existentes = await repo.listar();
  const porReferencia = {};
  existentes.forEach(function (cliente) {
    porReferencia[cliente.referencia] = cliente;
  });

  const vistos = {};
  const nuevos = [];
  const repetidos = [];       // ya existen y vienen de CSV: se actualizan
  const choquesManuales = []; // ya existen y fueron creados a mano
  const invalidos = [];

  lectura.registros.forEach(function (registro) {
    const cliente = normalizarCliente(registro.datos);
    const errores = validarCliente(cliente);
    const primerError = Object.keys(errores)[0];

    if (primerError) {
      invalidos.push({ fila: registro.fila, motivo: errores[primerError] });
      return;
    }

    if (vistos[cliente.referencia]) {
      invalidos.push({
        fila: registro.fila,
        motivo: 'Referencia ' + cliente.referencia + ' repetida en el archivo (fila ' +
          vistos[cliente.referencia] + ').'
      });
      return;
    }
    vistos[cliente.referencia] = registro.fila;

    const existente = porReferencia[cliente.referencia];

    if (!existente) {
      nuevos.push({ fila: registro.fila, cliente: cliente });
    } else if (existente.origen === 'manual') {
      choquesManuales.push({ fila: registro.fila, cliente: cliente, existente: existente });
    } else {
      repetidos.push({ fila: registro.fila, cliente: cliente, existente: existente });
    }
  });

  return {
    bloqueado: false,
    faltantes: [],
    sinReconocer: lectura.sinReconocer,
    nuevos: nuevos,
    repetidos: repetidos,
    choquesManuales: choquesManuales,
    invalidos: invalidos,
    totalFilas: lectura.registros.length
  };
}

/**
 * Aplica la importación.
 * modo: 'fusionar' mantiene la cartera; 'reemplazar' la borra antes.
 * sobrescribirManuales: si es false, los clientes creados a mano se respetan.
 */
export async function aplicar(informe, opciones) {
  if (informe.bloqueado) throw new Error('El archivo no tiene las columnas obligatorias.');

  const config = opciones || {};
  const modo = config.modo || 'fusionar';
  const sobrescribirManuales = config.sobrescribirManuales === true;

  const reemplazar = modo === 'reemplazar';
  const operaciones = [];
  let respetados = 0;

  informe.nuevos.forEach(function (item) {
    operaciones.push({
      tipo: 'crear',
      datos: Object.assign({}, item.cliente, { origen: 'csv' })
    });
  });

  informe.repetidos.forEach(function (item) {
    if (reemplazar) {
      operaciones.push({
        tipo: 'crear',
        datos: Object.assign({}, item.cliente, { origen: 'csv' })
      });
    } else {
      operaciones.push({
        tipo: 'actualizar',
        datos: Object.assign({}, item.cliente, { id: item.existente.id })
      });
    }
  });

  informe.choquesManuales.forEach(function (item) {
    if (!sobrescribirManuales) {
      respetados++;
      return;
    }

    // Al reemplazar, la cartera se borra entera: el manual ya no existe,
    // así que se vuelve a crear en vez de intentar actualizarlo.
    if (reemplazar) {
      operaciones.push({
        tipo: 'crear',
        datos: Object.assign({}, item.cliente, { origen: 'csv' })
      });
    } else {
      operaciones.push({
        tipo: 'actualizar',
        datos: Object.assign({}, item.cliente, { id: item.existente.id })
      });
    }
  });

  // El borrado va dentro de la misma transacción que la escritura:
  // si algo falla, la cartera anterior sigue intacta.
  const resultado = await repo.guardarLote(operaciones, reemplazar
    ? { vaciarAntes: { conservarManuales: !sobrescribirManuales } }
    : null);

  return {
    creados: resultado.creados,
    actualizados: resultado.actualizados,
    respetados: respetados,
    descartados: informe.invalidos.length
  };
}
