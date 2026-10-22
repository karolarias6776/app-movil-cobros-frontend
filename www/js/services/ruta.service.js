/* Reglas de negocio de la ruta de cobro.
   Aquí vive la regla del día de facturación: después de ese día el
   sistema ya generó la factura del mes siguiente, y esa parte del
   saldo todavía no se cobra. */

import * as repo from '../db/clientes.repo.js';
import { leerConfig } from './config.js';
import { hoy, diaEfectivo, esMismoMes, momentoDeVisita } from './fechas.service.js';
import { yaCobrado, aplazadoPara } from './cobros.service.js';

/**
 * Parte el saldo de un cliente en lo vencido y lo recién facturado.
 * Devuelve { facturado, mesNuevo, vencido, total }.
 */
export function desglosarSaldo(cliente, fecha, config) {
  const ajustes = config || leerConfig();
  const total = cliente.saldo || 0;
  const facturado = fecha.getDate() >= ajustes.diaFacturacion;

  if (!facturado || !ajustes.saldoIncluyeMesNuevo || !cliente.tarifa) {
    return { facturado: facturado, mesNuevo: 0, vencido: total, total: total };
  }

  const mesNuevo = Math.min(cliente.tarifa, total);
  return {
    facturado: true,
    mesNuevo: mesNuevo,
    vencido: Math.max(0, total - mesNuevo),
    total: total
  };
}

/**
 * El día de este mes en que toca visitarlo: el aplazado si lo hay, y si
 * no, el suyo de siempre (corrido si el mes es corto).
 */
export function diaDeVisita(cliente, fecha) {
  const aplazado = aplazadoPara(cliente, fecha);
  if (aplazado) return aplazado.getDate();
  return diaEfectivo(cliente.diaCobro, fecha);
}

/** ¿Quedó pendiente de un día anterior de este mes? */
function estaAtrasado(cliente, fecha, dia) {
  if (!cliente.saldo || cliente.saldo <= 0) return false;
  if (!dia || dia >= fecha.getDate()) return false;

  // Si ya se cobró este mes, no hay nada atrasado.
  return !esMismoMes(cliente.ultimoPago, fecha);
}

function porHora(a, b) {
  const horaA = a.cliente.horaCobro || '99:99';
  const horaB = b.cliente.horaCobro || '99:99';
  if (horaA !== horaB) return horaA < horaB ? -1 : 1;
  return a.cliente.nombre.localeCompare(b.cliente.nombre, 'es');
}

/**
 * Arma la ruta de un día.
 * Devuelve { fecha, config, deHoy, atrasados, totalHoy, totalAtrasado }
 */
export async function cargarRuta(fecha) {
  const dia = fecha || hoy();
  const config = leerConfig();
  const clientes = await repo.listar();

  const deHoy = [];
  const atrasados = [];
  const cobrados = [];

  clientes.forEach(function (cliente) {
    const diaCliente = diaDeVisita(cliente, dia);
    const aplazado = aplazadoPara(cliente, dia);

    const item = {
      cliente: cliente,
      dia: diaCliente,
      diaOriginal: diaEfectivo(cliente.diaCobro, dia),
      aplazado: aplazado,
      cobrado: yaCobrado(cliente, dia),
      desglose: desglosarSaldo(cliente, dia, config),
      momento: diaCliente ? momentoDeVisita(dia, diaCliente, cliente.horaCobro) : null
    };

    // Ya cobrado este mes: no hay que volver, pero se deja ver.
    if (item.cobrado) {
      if (diaCliente === dia.getDate()) cobrados.push(item);
      return;
    }

    if (diaCliente === dia.getDate()) deHoy.push(item);
    else if (estaAtrasado(cliente, dia, diaCliente)) atrasados.push(item);
  });

  deHoy.sort(porHora);
  cobrados.sort(porHora);
  atrasados.sort(function (a, b) { return a.dia - b.dia; });

  function sumar(lista) {
    return lista.reduce(function (suma, item) {
      return suma + item.desglose.vencido;
    }, 0);
  }

  return {
    fecha: dia,
    config: config,
    deHoy: deHoy,
    atrasados: atrasados,
    cobrados: cobrados,
    totalHoy: sumar(deHoy),
    totalAtrasado: sumar(atrasados),
    hayFacturaNueva: dia.getDate() >= config.diaFacturacion
  };
}
