/* Preferencias globales de la cobradora.
   Viven en localStorage: son ajustes del dispositivo, no datos de la ruta. */

const CLAVE = 'ruta-cobro-config';

const POR_DEFECTO = {
  // Día del mes en que el sistema genera la factura del mes siguiente.
  diaFacturacion: 20,
  // Si el saldo del archivo ya trae sumada esa factura nueva.
  saldoIncluyeMesNuevo: true,
  // Minutos de anticipación del recordatorio, si no hay uno por cliente.
  anticipacionMin: 30,
  // Hora que se asume cuando el cliente no tiene hora de visita.
  horaPorDefecto: '08:00',
  // Indicativo del pais para armar el numero de WhatsApp.
  // 57 es Colombia; los telefonos del archivo vienen sin el.
  prefijoPais: '57'
};

export function leerConfig() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (!guardado) return Object.assign({}, POR_DEFECTO);
    return Object.assign({}, POR_DEFECTO, JSON.parse(guardado));
  } catch (error) {
    return Object.assign({}, POR_DEFECTO);
  }
}

export function guardarConfig(cambios) {
  const config = Object.assign(leerConfig(), cambios || {});
  try {
    localStorage.setItem(CLAVE, JSON.stringify(config));
  } catch (error) {
    console.warn('No se pudo guardar la configuración:', error);
  }
  return config;
}

export { POR_DEFECTO };
