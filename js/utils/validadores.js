/* Normalización y validación de un cliente.
   Es el único lugar donde se decide qué es un cliente válido:
   cuando definas campos nuevos, se agregan aquí y en el formulario. */

export const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual'];

export const DIAS = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
];

export function sinAcentos(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Lee montos escritos de cualquier forma:
 * "$ 1.200.000" -> 1200000 | "1,250,000" -> 1250000 | "20000,50" -> 20000.5
 * Regla: un único separador con exactamente 3 dígitos detrás es de miles,
 * no decimal (en cobros "500.000" son quinientos mil, no medio).
 */
export function aNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

  const crudo = String(valor === null || valor === undefined ? '' : valor).trim();

  if (!crudo) return 0;

  const negativo = crudo.startsWith('-') || /^\(.*\)$/.test(crudo);
  let texto = crudo.replace(/[^\d.,]/g, '');
  if (!texto) return 0;

  const comas = (texto.match(/,/g) || []).length;
  const puntos = (texto.match(/\./g) || []).length;
  let decimal = null;

  if (comas && puntos) {
    decimal = texto.lastIndexOf(',') > texto.lastIndexOf('.') ? ',' : '.';
  } else if (comas || puntos) {
    const simbolo = comas ? ',' : '.';
    const cantidad = comas || puntos;
    const digitosDetras = texto.length - texto.lastIndexOf(simbolo) - 1;
    if (cantidad === 1 && digitosDetras !== 3) decimal = simbolo;
  }

  if (decimal === ',') texto = texto.replace(/\./g, '').replace(',', '.');
  else if (decimal === '.') texto = texto.replace(/,/g, '');
  else texto = texto.replace(/[.,]/g, '');

  const numero = parseFloat(texto);
  if (!Number.isFinite(numero)) return 0;
  return negativo ? -numero : numero;
}

export function soloDigitos(valor) {
  return String(valor === null || valor === undefined ? '' : valor).replace(/\D/g, '');
}

/** Deja el registro en la forma canónica que se guarda en IndexedDB. */
export function normalizarCliente(datos = {}) {
  const montoTotal = aNumero(datos.montoTotal);
  const saldoCrudo = datos.saldo === '' || datos.saldo === undefined || datos.saldo === null
    ? montoTotal
    : aNumero(datos.saldo);

  const frecuencia = sinAcentos(datos.frecuencia);
  const diaCobro = sinAcentos(datos.diaCobro);

  return {
    documento: soloDigitos(datos.documento),
    nombre: String(datos.nombre || '').trim().replace(/\s+/g, ' '),
    telefono: soloDigitos(datos.telefono),
    direccion: String(datos.direccion || '').trim(),
    montoTotal,
    saldo: saldoCrudo,
    cuota: aNumero(datos.cuota),
    frecuencia: FRECUENCIAS.includes(frecuencia) ? frecuencia : 'diario',
    diaCobro: DIAS.includes(diaCobro) ? diaCobro : '',
    notas: String(datos.notas || '').trim()
  };
}

/** Devuelve { campo: mensaje }. Vacío = válido. */
export function validarCliente(cliente) {
  const errores = {};

  if (!cliente.documento) {
    errores.documento = 'Escribe el número de documento.';
  } else if (cliente.documento.length < 5) {
    errores.documento = 'El documento debe tener al menos 5 dígitos.';
  }

  if (!cliente.nombre) {
    errores.nombre = 'Escribe el nombre del cliente.';
  } else if (cliente.nombre.length < 3) {
    errores.nombre = 'El nombre debe tener al menos 3 letras.';
  }

  if (cliente.telefono && cliente.telefono.length < 7) {
    errores.telefono = 'El teléfono debe tener al menos 7 dígitos.';
  }

  if (cliente.montoTotal < 0) errores.montoTotal = 'El monto no puede ser negativo.';
  if (cliente.saldo < 0) errores.saldo = 'El saldo no puede ser negativo.';
  if (cliente.cuota < 0) errores.cuota = 'La cuota no puede ser negativa.';

  if (cliente.montoTotal > 0 && cliente.saldo > cliente.montoTotal) {
    errores.saldo = 'El saldo no puede superar el monto total.';
  }

  return errores;
}

export function nuevoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
