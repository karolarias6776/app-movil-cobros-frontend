/* Enlaces para contactar al cliente: WhatsApp y llamada.

   WhatsApp exige el numero en formato internacional sin signos
   (573157481234), pero en la cartera los telefonos se guardan como
   vienen del archivo: solo digitos locales. Aqui se arma uno a partir
   del otro, con el prefijo del pais que esta en Ajustes. */

import { leerConfig } from './config.js';
import { moneda } from '../utils/dom.js';
import { formatearHora } from './fechas.service.js';

/**
 * '3157481234' -> '573157481234' (con prefijo 57).
 * Si el numero ya trae el prefijo, no lo repite.
 * Devuelve '' si no parece un numero utilizable.
 */
export function aInternacional(telefono, prefijo) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (digitos.length < 7) return '';

  const pais = String(prefijo || leerConfig().prefijoPais || '').replace(/\D/g, '');
  if (!pais) return digitos;

  // Ya viene con prefijo: 57 + 10 digitos en Colombia, por ejemplo.
  if (digitos.indexOf(pais) === 0 && digitos.length > 10) return digitos;

  return pais + digitos;
}

/** El primer telefono que sirva para WhatsApp. */
export function telefonoPrincipal(cliente) {
  const lista = (cliente && cliente.telefonos) || [];
  for (let i = 0; i < lista.length; i++) {
    const numero = aInternacional(lista[i]);
    if (numero) return numero;
  }
  return '';
}

/** Cierra la frase con un punto, sin duplicarlo: '8:30 a. m.' ya trae uno. */
function conPunto(frase) {
  return /\.$/.test(frase) ? frase : frase + '.';
}

/** Mensaje de recordatorio, listo para que ella lo revise y envie. */
export function mensajeRecordatorio(cliente, config) {
  const ajustes = config || leerConfig();
  const nombre = String(cliente.nombre || '').trim().split(' ')[0];
  const partes = [conPunto('Buen día' + (nombre ? ', ' + nombre : ''))];

  if (cliente.saldo > 0) {
    partes.push(conPunto('Le recuerdo su saldo pendiente de ' + moneda(cliente.saldo)));
  }

  if (cliente.diaCobro) {
    const hora = formatearHora(cliente.horaCobro);
    partes.push(conPunto('Paso a cobrar el día ' + cliente.diaCobro +
      (hora ? ' sobre las ' + hora : '')));
  }

  partes.push('Gracias.');
  return partes.join(' ');
}

/**
 * Enlace de WhatsApp con el mensaje ya escrito.
 * wa.me solo abre el chat: no envia nada hasta que ella toque enviar.
 */
export function enlaceWhatsApp(cliente, config) {
  const numero = telefonoPrincipal(cliente);
  if (!numero) return '';
  return 'https://wa.me/' + numero +
    '?text=' + encodeURIComponent(mensajeRecordatorio(cliente, config));
}

export function enlaceLlamada(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  return digitos ? 'tel:' + digitos : '';
}
