/* Las dos cosas que la cobradora hace en la puerta:
   decir que ya le pagaron este mes, o aplazar la visita a otro día.

   Ninguna de las dos toca el saldo: ese lo manda el archivo de
   facturación. Lo que se registra aquí es si hay que volver o no.

   Ojo con los campos: 'ultimoPago' y 'aplazadoHasta' no pasan por
   normalizarCliente() a propósito. Así, al reimportar el CSV o editar
   el cliente, no se borra lo que se marcó en la calle. */

import * as repo from '../db/clientes.repo.js';
import { hoy, aISO, desdeISO, esMismoMes, diasEnMes } from './fechas.service.js';

/** ¿Ya se cobró en el mes de esa fecha? */
export function yaCobrado(cliente, fecha) {
  return esMismoMes(cliente.ultimoPago, fecha || hoy());
}

/** La fecha a la que está aplazada la visita de ese mes, o null. */
export function aplazadoPara(cliente, fecha) {
  if (!cliente.aplazadoHasta) return null;
  const referencia = fecha || hoy();
  if (!esMismoMes(cliente.aplazadoHasta, referencia)) return null;
  return desdeISO(cliente.aplazadoHasta);
}

/**
 * Cada cobro es { fecha, monto }. Las primeras versiones guardaban solo
 * la fecha como texto, así que se acepta también ese formato viejo.
 */
function comoCobro(entrada) {
  if (typeof entrada === 'string') return { fecha: entrada, monto: null };
  return {
    fecha: (entrada && entrada.fecha) || '',
    monto: (entrada && typeof entrada.monto === 'number') ? entrada.monto : null
  };
}

function porFecha(a, b) {
  return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : 0);
}

/** Los cobros registrados, del más nuevo al más viejo. */
export function historialDeCobros(cliente) {
  return ((cliente && cliente.historialCobros) || [])
    .map(comoCobro)
    .filter(function (cobro) { return !!cobro.fecha; })
    .sort(porFecha)
    .reverse();
}

/** El historial sin las entradas del mes de esa fecha. */
function sinElMesDe(cliente, fecha) {
  return ((cliente && cliente.historialCobros) || [])
    .map(comoCobro)
    .filter(function (cobro) { return cobro.fecha && !esMismoMes(cobro.fecha, fecha); })
    .sort(porFecha);
}

/**
 * Queda cobrado el mes: no hay que volver hasta el mes siguiente.
 * `monto` es opcional y solo se anota: el saldo lo manda el archivo de
 * facturación, aquí no se resta nada.
 */
export function marcarCobrado(cliente, fecha, monto) {
  const dia = fecha || hoy();
  const anotado = (typeof monto === 'number' && isFinite(monto) && monto > 0) ? monto : null;

  return repo.actualizar(cliente.id, {
    ultimoPago: aISO(dia),
    // Si estaba aplazado, el aplazamiento ya no pinta nada.
    aplazadoHasta: '',
    historialCobros: sinElMesDe(cliente, dia)
      .concat({ fecha: aISO(dia), monto: anotado })
      .sort(porFecha)
  });
}

/**
 * Deshace la marca de este mes. Borra también su línea del historial, y
 * deja como último pago el del mes anterior, si lo hubo: así deshacer
 * una equivocación no borra lo que ya estaba bien.
 */
export function desmarcarCobrado(cliente, fecha) {
  const historial = sinElMesDe(cliente, fecha || hoy());

  return repo.actualizar(cliente.id, {
    ultimoPago: historial.length ? historial[historial.length - 1].fecha : '',
    historialCobros: historial
  });
}

/** Mueve la visita de este mes a otro día. */
export function aplazar(cliente, fecha) {
  return repo.actualizar(cliente.id, { aplazadoHasta: aISO(fecha) });
}

export function quitarAplazamiento(cliente) {
  return repo.actualizar(cliente.id, { aplazadoHasta: '' });
}

/**
 * Le cambia el día de cobro de aquí en adelante.
 * No hace falta aplazar nada: al cambiar el día, este mes ya cae ahí.
 */
export function cambiarDiaFijo(cliente, fecha) {
  return repo.actualizar(cliente.id, {
    diaCobro: fecha.getDate(),
    aplazadoHasta: ''
  });
}

/**
 * Los días a los que tiene sentido aplazar: los tres siguientes, sin
 * pasarse del mes. Para cualquier otro día está el selector de fecha.
 * Devuelve [{ fecha, iso, etiqueta }].
 */
export function diasParaAplazar(desde) {
  const base = desde || hoy();
  const ultimo = diasEnMes(base.getFullYear(), base.getMonth());
  const opciones = [];

  for (let suma = 1; suma <= 3; suma++) {
    const dia = base.getDate() + suma;
    if (dia > ultimo) break;

    const fecha = new Date(base.getFullYear(), base.getMonth(), dia);
    opciones.push({
      fecha: fecha,
      iso: aISO(fecha),
      etiqueta: suma === 1 ? 'Mañana' : 'En ' + suma + ' días'
    });
  }

  return opciones;
}
