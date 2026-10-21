/* Exporta los cobros como archivo .ics.
   Esta es la vía que sí avisa con la app cerrada: las alarmas las
   da el calendario del celular, sin internet y sin servidor. */

import * as repo from '../db/clientes.repo.js';
import { leerConfig } from './config.js';

function escapar(texto) {
  return String(texto || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function dosDigitos(numero) {
  return numero < 10 ? '0' + numero : String(numero);
}

function selloUTC(fecha) {
  return fecha.getUTCFullYear() +
    dosDigitos(fecha.getUTCMonth() + 1) +
    dosDigitos(fecha.getUTCDate()) + 'T' +
    dosDigitos(fecha.getUTCHours()) +
    dosDigitos(fecha.getUTCMinutes()) + '00Z';
}

function selloLocal(fecha) {
  return fecha.getFullYear() +
    dosDigitos(fecha.getMonth() + 1) +
    dosDigitos(fecha.getDate()) + 'T' +
    dosDigitos(fecha.getHours()) +
    dosDigitos(fecha.getMinutes()) + '00';
}

/**
 * Regla de repetición mensual que respeta los meses cortos, igual que
 * diaEfectivo(): quien cobra el 31 cae el 30 en abril y el 28 en febrero.
 * BYSETPOS=-1 toma el último día de la lista que exista en ese mes.
 */
export function reglaMensual(diaCobro) {
  if (diaCobro <= 28) return 'FREQ=MONTHLY;BYMONTHDAY=' + diaCobro;

  const dias = [];
  for (let dia = 28; dia <= diaCobro; dia++) dias.push(dia);
  return 'FREQ=MONTHLY;BYMONTHDAY=' + dias.join(',') + ';BYSETPOS=-1';
}

/** Primera fecha de cobro a partir de hoy, respetando el día del cliente. */
function primeraOcurrencia(diaCobro, hora) {
  const partes = String(hora || '08:00').split(':');
  const h = parseInt(partes[0], 10) || 8;
  const m = parseInt(partes[1], 10) || 0;

  const ahora = new Date();
  let anio = ahora.getFullYear();
  let mes = ahora.getMonth();

  if (diaCobro < ahora.getDate()) {
    mes += 1;
    if (mes > 11) { mes = 0; anio += 1; }
  }

  const tope = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(diaCobro, tope), h, m, 0, 0);
}

/** Devuelve el texto del archivo .ics con un evento mensual por cliente. */
export async function construirICS() {
  const config = leerConfig();
  const clientes = await repo.listar();
  const conDia = clientes.filter(function (cliente) { return cliente.diaCobro > 0; });

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ruta de cobro//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Ruta de cobro'
  ];

  const creado = selloUTC(new Date());

  conDia.forEach(function (cliente) {
    const inicio = primeraOcurrencia(cliente.diaCobro, cliente.horaCobro);
    const fin = new Date(inicio.getTime() + 20 * 60000);

    const propia = cliente.anticipacionMin;
    const minutos = (propia === null || propia === undefined)
      ? config.anticipacionMin
      : propia;

    const lugar = [cliente.direccion, cliente.barrio].filter(Boolean).join(', ');
    const descripcion = [
      cliente.campania,
      cliente.saldo ? 'Saldo: ' + cliente.saldo : '',
      cliente.telefonos && cliente.telefonos.length ? 'Tel: ' + cliente.telefonos.join(' / ') : '',
      'Ref: ' + cliente.referencia
    ].filter(Boolean).join('\n');

    lineas.push(
      'BEGIN:VEVENT',
      'UID:' + cliente.id + '@ruta-cobro',
      'DTSTAMP:' + creado,
      'DTSTART:' + selloLocal(inicio),
      'DTEND:' + selloLocal(fin),
      'RRULE:' + reglaMensual(cliente.diaCobro),
      'SUMMARY:Cobro ' + escapar(cliente.nombre),
      'LOCATION:' + escapar(lugar),
      'DESCRIPTION:' + escapar(descripcion),
      'BEGIN:VALARM',
      'TRIGGER:-PT' + Math.max(0, Math.round(minutos)) + 'M',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + escapar('Cobro ' + cliente.nombre),
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lineas.push('END:VCALENDAR');

  return { texto: lineas.join('\r\n'), eventos: conDia.length };
}

/** Genera el archivo y lo entrega al celular para abrirlo o guardarlo. */
export async function descargarICS() {
  const resultado = await construirICS();

  if (resultado.eventos === 0) {
    throw new Error('Ningún cliente tiene día de cobro asignado.');
  }

  const blob = new Blob([resultado.texto], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'ruta-de-cobro.ics';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

  return resultado.eventos;
}
