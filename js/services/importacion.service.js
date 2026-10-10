/* Reglas de importación de CSV.
   Decide qué entra, qué choca con lo que ya existe y qué se respeta. */

import { parsearClientes } from './csv.service.js';
import * as repo from '../db/clientes.repo.js';
import { normalizarCliente, validarCliente } from '../utils/validadores.js';

/**
 * Lee el CSV y lo contrasta con la base, sin escribir nada.
 * Devuelve el informe que se muestra antes de confirmar.
 */
export async function previsualizar(texto) {
  const { registros, sinReconocer, faltantes } = parsearClientes(texto);

  if (faltantes.length) {
    return {
      bloqueado: true,
      faltantes,
      sinReconocer,
      nuevos: [],
      repetidos: [],
      choquesManuales: [],
      invalidos: []
    };
  }

  const existentes = await repo.listar();
  const porDocumento = new Map(existentes.map((cliente) => [cliente.documento, cliente]));
  const vistosEnArchivo = new Map();

  const nuevos = [];
  const repetidos = [];        // ya existen y vienen de CSV: se actualizan
  const choquesManuales = [];  // ya existen y fueron creados a mano
  const invalidos = [];

  for (const registro of registros) {
    const cliente = normalizarCliente(registro.datos);
    const errores = validarCliente(cliente);

    if (Object.keys(errores).length) {
      invalidos.push({ fila: registro.fila, motivo: Object.values(errores)[0] });
      continue;
    }

    if (vistosEnArchivo.has(cliente.documento)) {
      invalidos.push({
        fila: registro.fila,
        motivo: `Documento ${cliente.documento} repetido en el archivo (fila ${vistosEnArchivo.get(cliente.documento)}).`
      });
      continue;
    }
    vistosEnArchivo.set(cliente.documento, registro.fila);

    const existente = porDocumento.get(cliente.documento);

    if (!existente) {
      nuevos.push({ fila: registro.fila, cliente });
    } else if (existente.origen === 'manual') {
      choquesManuales.push({ fila: registro.fila, cliente, existente });
    } else {
      repetidos.push({ fila: registro.fila, cliente, existente });
    }
  }

  return {
    bloqueado: false,
    faltantes: [],
    sinReconocer,
    nuevos,
    repetidos,
    choquesManuales,
    invalidos,
    totalFilas: registros.length
  };
}

/**
 * Aplica la importación.
 * modo: 'fusionar' mantiene la cartera actual; 'reemplazar' la borra antes.
 * sobrescribirManuales: si es false, los clientes creados a mano se respetan.
 */
export async function aplicar(informe, { modo = 'fusionar', sobrescribirManuales = false } = {}) {
  if (informe.bloqueado) throw new Error('El archivo no tiene las columnas obligatorias.');

  if (modo === 'reemplazar') {
    await repo.vaciar({ conservarManuales: !sobrescribirManuales });
  }

  const operaciones = [];
  let respetados = 0;

  for (const item of informe.nuevos) {
    operaciones.push({ tipo: 'crear', datos: { ...item.cliente, origen: 'csv' } });
  }

  for (const item of informe.repetidos) {
    if (modo === 'reemplazar') {
      operaciones.push({ tipo: 'crear', datos: { ...item.cliente, origen: 'csv' } });
    } else {
      operaciones.push({ tipo: 'actualizar', datos: { ...item.cliente, id: item.existente.id } });
    }
  }

  for (const item of informe.choquesManuales) {
    if (sobrescribirManuales) {
      operaciones.push({ tipo: 'actualizar', datos: { ...item.cliente, id: item.existente.id } });
    } else {
      respetados++;
    }
  }

  const resultado = await repo.guardarLote(operaciones);

  return {
    ...resultado,
    respetados,
    descartados: informe.invalidos.length
  };
}
