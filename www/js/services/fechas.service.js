/* Manejo y formateo de fechas. Único lugar donde se hacen cuentas
   con días del mes, para no repetir la lógica de meses cortos. */

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function hoy() {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

export function diasEnMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

/**
 * El día que realmente toca cobrar en ese mes.
 * Si el cliente se cobra el 31 y el mes tiene 30, cae el 30.
 */
export function diaEfectivo(diaCobro, fecha) {
  const dia = parseInt(diaCobro, 10);
  if (!dia || dia < 1) return 0;
  const tope = diasEnMes(fecha.getFullYear(), fecha.getMonth());
  return dia > tope ? tope : dia;
}

/** '2026-10-04' -> Date local, sin saltos de zona horaria. */
export function desdeISO(iso) {
  if (!iso) return null;
  const partes = String(iso).split('-');
  if (partes.length < 3) return null;
  const fecha = new Date(
    parseInt(partes[0], 10),
    parseInt(partes[1], 10) - 1,
    parseInt(partes[2], 10)
  );
  return isNaN(fecha.getTime()) ? null : fecha;
}

export function aISO(fecha) {
  const mes = fecha.getMonth() + 1;
  const dia = fecha.getDate();
  return fecha.getFullYear() + '-' +
    (mes < 10 ? '0' + mes : mes) + '-' +
    (dia < 10 ? '0' + dia : dia);
}

/** ¿La fecha ISO cae en el mismo mes y año que la referencia? */
export function esMismoMes(iso, referencia) {
  const fecha = desdeISO(iso);
  if (!fecha) return false;
  return fecha.getFullYear() === referencia.getFullYear() &&
    fecha.getMonth() === referencia.getMonth();
}

export function formatearFecha(fecha) {
  if (!fecha) return '';
  return DIAS_SEMANA[fecha.getDay()] + ' ' + fecha.getDate() + ' de ' + MESES[fecha.getMonth()];
}

export function formatearFechaCorta(iso) {
  const fecha = desdeISO(iso);
  if (!fecha) return '';
  return fecha.getDate() + ' ' + MESES[fecha.getMonth()].slice(0, 3) + ' ' + fecha.getFullYear();
}

/** '14:30' -> '2:30 p. m.' */
export function formatearHora(hora) {
  if (!hora) return '';
  const partes = String(hora).split(':');
  let h = parseInt(partes[0], 10);
  const m = partes[1] || '00';
  if (isNaN(h)) return '';
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return h + ':' + m + ' ' + sufijo;
}

/** Combina un día del mes y una hora 'HH:mm' en un Date concreto. */
export function momentoDeVisita(fecha, dia, hora) {
  const partes = String(hora || '08:00').split(':');
  const h = parseInt(partes[0], 10) || 0;
  const m = parseInt(partes[1], 10) || 0;
  return new Date(fecha.getFullYear(), fecha.getMonth(), dia, h, m, 0, 0);
}

/** Días completos entre dos fechas (b - a). */
export function diasEntre(a, b) {
  const unDia = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / unDia);
}
