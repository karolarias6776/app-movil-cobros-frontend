/* Avisos de las visitas del día.

   Dos mundos:
   - En la app de Android (Capacitor), las alarmas las programa el
     sistema: suenan con la app cerrada, sin internet y a la hora exacta.
     Por eso se programan varios días por adelantado.
   - En el navegador no existe forma de despertar la app, así que solo
     se puede avisar de lo de hoy y mientras la pestaña siga viva.

   Los plugins se leen de window.Capacitor en tiempo de ejecución, no con
   import: así el código web sigue sin necesitar compilación. */

import { cargarRuta } from './ruta.service.js';
import { formatearHora, hoy } from './fechas.service.js';

// En Android se programa una semana; el sistema las guarda aunque la app
// no se abra. En web solo tiene sentido lo de hoy.
const DIAS_NATIVO = 7;

let temporizadores = [];
let programadosEnWeb = [];
let escuchando = false;

/** El plugin nativo, o null si corremos en el navegador. */
function plugin() {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
  return (cap.Plugins && cap.Plugins.LocalNotifications) || null;
}

export function esNativo() {
  return !!plugin();
}

export function soportadas() {
  return esNativo() || (typeof Notification !== 'undefined' && 'serviceWorker' in navigator);
}

/** 'granted' | 'denied' | 'default' | 'no-soportado' */
export async function permisoActual() {
  const nativo = plugin();
  if (nativo) {
    const estado = await nativo.checkPermissions();
    return estado.display === 'prompt' ? 'default' : estado.display;
  }
  if (typeof Notification === 'undefined') return 'no-soportado';
  return Notification.permission;
}

export async function pedirPermiso() {
  const nativo = plugin();
  if (nativo) {
    const estado = await nativo.requestPermissions();
    return estado.display === 'prompt' ? 'default' : estado.display;
  }

  if (typeof Notification === 'undefined') return 'no-soportado';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch (error) {
    return Notification.permission;
  }
}

/**
 * Android 12+ exige un permiso aparte para que la alarma sea exacta.
 * Sin él, el sistema la retrasa lo que quiera.
 * Devuelve true si está concedido o si la pregunta no aplica.
 */
export async function alarmasExactas() {
  const nativo = plugin();
  if (!nativo || typeof nativo.checkExactNotificationSetting !== 'function') return true;
  try {
    const estado = await nativo.checkExactNotificationSetting();
    return estado.exact_alarm === 'granted';
  } catch (error) {
    return true;
  }
}

/** Abre la pantalla de Android donde se habilitan las alarmas exactas. */
export async function abrirAjusteAlarmas() {
  const nativo = plugin();
  if (nativo && typeof nativo.changeExactNotificationSetting === 'function') {
    await nativo.changeExactNotificationSetting();
  }
}

/** Minutos de anticipación: los del cliente, o el global. */
function anticipacionDe(cliente, config) {
  const propia = cliente.anticipacionMin;
  return (propia === null || propia === undefined) ? config.anticipacionMin : propia;
}

function cuerpoDelAviso(cliente) {
  const direccion = [cliente.barrio, cliente.direccion].filter(Boolean).join(' · ');
  return (formatearHora(cliente.horaCobro) || 'Hoy') + (direccion ? ' · ' + direccion : '');
}

/**
 * Cuándo debe sonar el aviso, o null si ya no tiene sentido.
 * Si la hora del aviso quedó atrás pero la visita todavía no, avisa
 * enseguida: alguien que acaba de anotar una visita para dentro de un
 * rato espera que le avise, no que lo descarte en silencio.
 */
function momentoDelAviso(item, config, ahora) {
  if (!item.momento) return null;

  const visita = item.momento.getTime();
  if (visita <= ahora) return null;

  const aviso = visita - anticipacionDe(item.cliente, config) * 60000;
  return new Date(Math.max(aviso, ahora + 10000));
}

/** Qué hay programado ahora mismo: para mostrarlo en Ajustes. */
export async function avisosPendientes() {
  const nativo = plugin();

  if (nativo) {
    const pendientes = await nativo.getPending();
    const lista = (pendientes.notifications || [])
      .filter(function (n) { return n.schedule && n.schedule.at; })
      .map(function (n) { return { titulo: n.title, cuando: new Date(n.schedule.at) }; })
      .sort(function (a, b) { return a.cuando - b.cuando; });
    return lista;
  }

  return programadosEnWeb.slice().sort(function (a, b) { return a.cuando - b.cuando; });
}

// ---------- Navegador ----------

async function mostrarEnWeb(titulo, opciones) {
  const registro = navigator.serviceWorker
    ? await navigator.serviceWorker.getRegistration()
    : null;

  if (registro && registro.showNotification) {
    return registro.showNotification(titulo, opciones);
  }
  new Notification(titulo, opciones);
}

async function programarEnWeb() {
  const ruta = await cargarRuta(hoy());
  const ahora = Date.now();

  ruta.deHoy.forEach(function (item) {
    const cuando = momentoDelAviso(item, ruta.config, ahora);
    if (!cuando) return;

    const id = setTimeout(function () {
      mostrarEnWeb(item.cliente.nombre, {
        body: cuerpoDelAviso(item.cliente),
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        tag: 'cobro-' + item.cliente.id,
        requireInteraction: true,
        data: { url: './app.html#/cliente/' + item.cliente.id }
      });
    }, cuando.getTime() - ahora);

    temporizadores.push(id);
    programadosEnWeb.push({ titulo: item.cliente.nombre, cuando: cuando });
  });

  return temporizadores.length;
}

// ---------- Android ----------

async function programarEnAndroid(nativo) {
  // Android conserva las alarmas aunque la app se cierre: hay que borrar
  // las de la tanda anterior o se duplican con cada apertura.
  const pendientes = await nativo.getPending();
  if (pendientes.notifications && pendientes.notifications.length) {
    await nativo.cancel({
      notifications: pendientes.notifications.map(function (n) { return { id: n.id }; })
    });
  }

  const avisos = [];
  const ahora = Date.now();
  const base = hoy();

  for (let dia = 0; dia < DIAS_NATIVO; dia++) {
    const fecha = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dia);
    const ruta = await cargarRuta(fecha);

    ruta.deHoy.forEach(function (item) {
      const cuando = momentoDelAviso(item, ruta.config, ahora);
      if (!cuando) return;

      avisos.push({
        id: avisos.length + 1,
        title: item.cliente.nombre,
        body: cuerpoDelAviso(item.cliente),
        schedule: { at: cuando, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon',
        extra: { clienteId: item.cliente.id }
      });
    });
  }

  if (avisos.length) await nativo.schedule({ notifications: avisos });
  return avisos.length;
}

// ---------- Público ----------

export function cancelarProgramadas() {
  temporizadores.forEach(function (id) { clearTimeout(id); });
  temporizadores = [];
  programadosEnWeb = [];
}

/**
 * Deja programados los avisos pendientes.
 * Devuelve { programadas, dias, motivo }.
 */
export async function programarAvisos() {
  cancelarProgramadas();

  if (await permisoActual() !== 'granted') {
    return { programadas: 0, dias: 0, motivo: 'Faltan permisos de notificación.' };
  }

  const nativo = plugin();
  const programadas = nativo ? await programarEnAndroid(nativo) : await programarEnWeb();

  return { programadas: programadas, dias: nativo ? DIAS_NATIVO : 1, motivo: '' };
}

/** Al tocar la notificación en Android, abre la ficha del cliente. */
export function escucharToques() {
  const nativo = plugin();
  if (!nativo || escuchando) return;
  escuchando = true;

  nativo.addListener('localNotificationActionPerformed', function (evento) {
    const id = evento && evento.notification && evento.notification.extra &&
      evento.notification.extra.clienteId;
    if (id) location.hash = '#/cliente/' + id;
  });
}

export async function probar() {
  const nativo = plugin();

  if (nativo) {
    return nativo.schedule({
      notifications: [{
        id: 999999,
        title: 'Así se verá el aviso',
        body: 'Nombre del cliente · Barrio · Dirección',
        schedule: { at: new Date(Date.now() + 2000) },
        smallIcon: 'ic_stat_icon'
      }]
    });
  }

  return mostrarEnWeb('Así se verá el aviso', {
    body: 'Nombre del cliente · Barrio · Dirección',
    icon: './assets/icons/icon-192.png',
    tag: 'prueba'
  });
}
