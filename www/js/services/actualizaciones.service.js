/* Avisa cuando hay una version nueva del APK publicada.

   La app instalada no se actualiza sola: Android no lo permite fuera de
   Play Store. Lo que si podemos es mirar un archivo en el sitio y
   decirle a la cobradora que hay una version nueva, con el enlace para
   bajarla. Sin internet, esto simplemente no hace nada. */

import { VERSION_APP } from '../version.js';
import { esNativo } from './notificaciones.service.js';

// Donde vive la version publicada. Tiene que ser el dominio completo:
// dentro del APK una ruta relativa apunta al propio telefono, no al sitio.
// Es un Worker con assets, no Pages, de ahi el .workers.dev.
const SITIO = 'https://app-movil-cobros-frontend.karolarias6776.workers.dev';

const CLAVE_AVISADA = 'ruta-cobro-version-avisada';

export function versionInstalada() {
  return VERSION_APP;
}

/**
 * Devuelve { nombre, url, notas } si hay una version mas nueva,
 * o null si estamos al dia, si no hay red o si no es la app de Android.
 */
export async function buscarActualizacion() {
  // En la web no hay APK que actualizar: el navegador ya trae lo ultimo.
  if (!esNativo()) return null;
  if (!navigator.onLine) return null;

  let datos;
  try {
    const respuesta = await fetch(SITIO + '/version.json', { cache: 'no-store' });
    if (!respuesta.ok) return null;
    datos = await respuesta.json();
  } catch (error) {
    return null; // sin señal o sitio caido: no es un problema
  }

  if (!datos || typeof datos.versionCode !== 'number') return null;
  if (datos.versionCode <= VERSION_APP.codigo) return null;

  return {
    nombre: datos.versionName || String(datos.versionCode),
    url: SITIO + '/' + String(datos.apk || '').replace(/^\//, ''),
    notas: datos.notas || ''
  };
}

/** ¿Ya le avisamos de esta version? Para no repetir en cada apertura. */
export function yaAvisada(nombre) {
  try {
    return localStorage.getItem(CLAVE_AVISADA) === nombre;
  } catch (error) {
    return false;
  }
}

export function marcarAvisada(nombre) {
  try {
    localStorage.setItem(CLAVE_AVISADA, nombre);
  } catch (error) { /* sin localStorage, avisara otra vez: no pasa nada */ }
}
