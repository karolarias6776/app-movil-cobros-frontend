/* Notificaciones locales mientras la app está abierta.
   Limitación real: no existe forma confiable de programar una
   notificación con la app cerrada en una PWA. Para eso se exporta
   la ruta al calendario del celular (calendario.service.js). */

import { cargarRuta } from './ruta.service.js';
import { formatearHora } from './fechas.service.js';

let temporizadores = [];

export function soportadas() {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

export function permisoActual() {
  if (typeof Notification === 'undefined') return 'no-soportado';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function pedirPermiso() {
  if (typeof Notification === 'undefined') return 'no-soportado';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch (error) {
    return Notification.permission;
  }
}

/** En Android, la notificación tiene que salir del Service Worker. */
async function mostrar(titulo, opciones) {
  const registro = navigator.serviceWorker
    ? await navigator.serviceWorker.getRegistration()
    : null;

  if (registro && registro.showNotification) {
    return registro.showNotification(titulo, opciones);
  }

  // Respaldo para escritorio, donde sí se permite sin Service Worker.
  new Notification(titulo, opciones);
}

export function cancelarProgramadas() {
  temporizadores.forEach(function (id) { clearTimeout(id); });
  temporizadores = [];
}

/**
 * Programa los avisos de las visitas de hoy que aún no han pasado.
 * Devuelve { programadas, motivo }.
 */
export async function programarHoy() {
  cancelarProgramadas();

  if (permisoActual() !== 'granted') {
    return { programadas: 0, motivo: 'Faltan permisos de notificación.' };
  }

  const ruta = await cargarRuta();
  const ahora = Date.now();

  ruta.deHoy.forEach(function (item) {
    if (!item.momento) return;

    const propia = item.cliente.anticipacionMin;
    const minutos = (propia === null || propia === undefined)
      ? ruta.config.anticipacionMin
      : propia;

    const espera = item.momento.getTime() - (minutos * 60000) - ahora;
    if (espera <= 0) return;

    const id = setTimeout(function () {
      const direccion = [item.cliente.barrio, item.cliente.direccion]
        .filter(Boolean).join(' · ');

      mostrar(item.cliente.nombre, {
        body: (formatearHora(item.cliente.horaCobro) || 'Hoy') +
          (direccion ? ' · ' + direccion : ''),
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        tag: 'cobro-' + item.cliente.id,
        requireInteraction: true,
        data: { url: './index.html#/cliente/' + item.cliente.id }
      });
    }, espera);

    temporizadores.push(id);
  });

  return { programadas: temporizadores.length, motivo: '' };
}

export function probar() {
  return mostrar('Así se verá el aviso', {
    body: 'Nombre del cliente · Barrio · Dirección',
    icon: './assets/icons/icon-192.png',
    tag: 'prueba'
  });
}
