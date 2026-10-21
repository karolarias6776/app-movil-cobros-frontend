/* Reglas de negocio de la ruta de cobro.
   Aquí vive la regla del día de facturación: después de ese día el
   sistema ya generó la factura del mes siguiente, y esa parte del
   saldo todavía no se cobra. */

import * as repo from '../db/clientes.repo.js';
import { leerConfig } from './config.js';
import { hoy, diaEfectivo, esMismoMes, momentoDeVisita } from './fechas.service.js';

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

/** ¿Quedó pendiente de un día anterior de este mes? */
function estaAtrasado(cliente, fecha) {
  if (!cliente.saldo || cliente.saldo <= 0) return false;

  const dia = diaEfectivo(cliente.diaCobro, fecha);
  if (!dia || dia >= fecha.getDate()) return false;

  // Si ya pagó algo este mes, no lo contamos como atrasado.
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

  clientes.forEach(function (cliente) {
    const diaCliente = diaEfectivo(cliente.diaCobro, dia);
    const item = {
      cliente: cliente,
      dia: diaCliente,
      desglose: desglosarSaldo(cliente, dia, config),
      momento: diaCliente ? momentoDeVisita(dia, diaCliente, cliente.horaCobro) : null
    };

    if (diaCliente === dia.getDate()) deHoy.push(item);
    else if (estaAtrasado(cliente, dia)) atrasados.push(item);
  });

  deHoy.sort(porHora);
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
    totalHoy: sumar(deHoy),
    totalAtrasado: sumar(atrasados),
    hayFacturaNueva: dia.getDate() >= config.diaFacturacion
  };
}
