/* Modelo del cliente y sus validaciones.
   Único lugar donde se decide qué es un cliente válido:
   si agregas campos nuevos, se tocan aquí y en el formulario. */

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
 * Un único separador con exactamente 3 dígitos detrás es de miles:
 * en cobros "500.000" son quinientos mil, no medio.
 */
export function aNumero(valor) {
  if (typeof valor === 'number') return isFinite(valor) ? valor : 0;

  const crudo = String(valor === null || valor === undefined ? '' : valor).trim();
  if (!crudo) return 0;

  const negativo = crudo.charAt(0) === '-';
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
    const detras = texto.length - texto.lastIndexOf(simbolo) - 1;
    if (cantidad === 1 && detras !== 3) decimal = simbolo;
  }

  if (decimal === ',') texto = texto.replace(/\./g, '').replace(',', '.');
  else if (decimal === '.') texto = texto.replace(/,/g, '');
  else texto = texto.replace(/[.,]/g, '');

  const numero = parseFloat(texto);
  if (!isFinite(numero)) return 0;
  return negativo ? -numero : numero;
}

export function soloDigitos(valor) {
  return String(valor === null || valor === undefined ? '' : valor).replace(/\D/g, '');
}

/** "21/09/2026" o "2026-09-21" -> "2026-09-21". Si no entiende, cadena vacía. */
export function aFecha(valor) {
  const texto = String(valor === null || valor === undefined ? '' : valor).trim();
  if (!texto) return '';

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];

  const partes = texto.split(/[\/\-.]/);
  if (partes.length < 3) return '';

  let dia = parseInt(partes[0], 10);
  let mes = parseInt(partes[1], 10);
  let anio = parseInt(partes[2], 10);
  if (!dia || !mes || !anio) return '';

  if (anio < 100) anio += 2000;
  if (mes > 12) { const cambio = mes; mes = dia; dia = cambio; }
  if (mes > 12 || dia > 31) return '';

  const dd = dia < 10 ? '0' + dia : String(dia);
  const mm = mes < 10 ? '0' + mes : String(mes);
  return anio + '-' + mm + '-' + dd;
}

/** "3157481, 3204455" -> ['3157481', '3204455'] */
export function aTelefonos(valor) {
  if (Array.isArray(valor)) valor = valor.join(',');
  const texto = String(valor === null || valor === undefined ? '' : valor);

  return texto
    .split(/[,;/|]+/)
    .map(function (parte) { return soloDigitos(parte); })
    .filter(function (parte) { return parte.length >= 7; });
}

/** Deja el registro en la forma canónica que se guarda en IndexedDB. */
export function normalizarCliente(datos) {
  const origen = datos || {};
  const dia = parseInt(aNumero(origen.diaCobro), 10);

  return {
    referencia: soloDigitos(origen.referencia),
    documento: soloDigitos(origen.documento),
    nombre: String(origen.nombre || '').trim().replace(/\s+/g, ' '),
    barrio: String(origen.barrio || '').trim(),
    direccion: String(origen.direccion || '').trim(),
    telefonos: aTelefonos(origen.telefonos),
    campania: String(origen.campania || '').trim(),
    tarifa: aNumero(origen.tarifa),
    cuota: aNumero(origen.cuota),
    saldo: aNumero(origen.saldo),
    edad: aNumero(origen.edad),
    diaCobro: dia >= 1 && dia <= 31 ? dia : 0,
    ultimoPago: aFecha(origen.ultimoPago),
    notas: String(origen.notas || '').trim()
  };
}

/** Devuelve { campo: mensaje }. Objeto vacío = cliente válido. */
export function validarCliente(cliente) {
  const errores = {};

  if (!cliente.referencia) {
    errores.referencia = 'Escribe la referencia de pago.';
  } else if (cliente.referencia.length < 5) {
    errores.referencia = 'La referencia debe tener al menos 5 dígitos.';
  }

  if (!cliente.nombre) {
    errores.nombre = 'Escribe el nombre del cliente.';
  } else if (cliente.nombre.length < 3) {
    errores.nombre = 'El nombre debe tener al menos 3 letras.';
  }

  if (cliente.documento && cliente.documento.length < 5) {
    errores.documento = 'El documento debe tener al menos 5 dígitos.';
  }

  if (cliente.tarifa < 0) errores.tarifa = 'La tarifa no puede ser negativa.';
  if (cliente.cuota < 0) errores.cuota = 'La cuota no puede ser negativa.';
  if (cliente.saldo < 0) errores.saldo = 'El saldo no puede ser negativo.';

  return errores;
}

export function nuevoId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
