/* Parser de CSV sin dependencias.
   Se escribe a mano en vez de usar papaparse por CDN: la app debe
   funcionar sin red desde el primer arranque y sin compilación.
   Soporta comillas dobles, saltos de línea dentro de comillas, BOM
   y separador , ; o tabulación detectado automáticamente. */

const CAMPOS = {
  referencia: ['referencia pago', 'referencia de pago', 'referencia', 'ref', 'ref pago'],
  documento: ['documento', 'cedula', 'cc', 'identificacion', 'nit', 'doc'],
  nombre: ['nombre', 'nombres', 'cliente', 'nombre completo', 'suscriptor'],
  barrio: ['barrio', 'zona', 'sector'],
  direccion: ['direccion', 'dir', 'domicilio', 'ubicacion'],
  telefonos: ['telefonos', 'telefono', 'tel', 'celular', 'celulares', 'movil', 'contacto'],
  campania: ['campana', 'plan', 'servicio', 'producto', 'paquete'],
  tarifa: ['tarifa', 'valor plan', 'valor tarifa', 'mensualidad', 'valor mensual'],
  saldo: ['saldo', 'deuda', 'pendiente', 'saldo pendiente', 'total'],
  cuota: ['cuota', 'valor cuota', 'abono', 'pago habitual'],
  edad: ['edad', 'facturas', 'facturas pendientes', 'edad deuda'],
  ultimoPago: ['ultimo pago', 'fecha ultimo pago', 'ultimo abono', 'fecha pago'],
  diaCobro: ['dia de cobro', 'dia cobro', 'dia', 'dia del mes'],
  horaCobro: ['hora de cobro', 'hora cobro', 'hora', 'hora de visita'],
  notas: ['notas', 'nota', 'observacion', 'observaciones', 'comentario']
};

function normalizar(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectarSeparador(primeraLinea) {
  const fuera = primeraLinea.replace(/"[^"]*"/g, '');
  const puntoYComa = (fuera.match(/;/g) || []).length;
  const coma = (fuera.match(/,/g) || []).length;
  const tab = (fuera.match(/\t/g) || []).length;

  if (tab > puntoYComa && tab > coma) return '\t';
  return puntoYComa > coma ? ';' : ',';
}

/** Texto CSV -> matriz de filas. */
export function parsearFilas(texto) {
  const limpio = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const separador = detectarSeparador(limpio.split('\n')[0] || '');

  const filas = [];
  let fila = [];
  let celda = '';
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const caracter = limpio.charAt(i);

    if (enComillas) {
      if (caracter === '"') {
        if (limpio.charAt(i + 1) === '"') { celda += '"'; i++; }
        else enComillas = false;
      } else {
        celda += caracter;
      }
      continue;
    }

    if (caracter === '"') { enComillas = true; continue; }
    if (caracter === separador) { fila.push(celda.trim()); celda = ''; continue; }

    if (caracter === '\n') {
      fila.push(celda.trim());
      if (fila.some(function (valor) { return valor !== ''; })) filas.push(fila);
      fila = [];
      celda = '';
      continue;
    }

    celda += caracter;
  }

  fila.push(celda.trim());
  if (fila.some(function (valor) { return valor !== ''; })) filas.push(fila);

  return filas;
}

/** Empareja cada encabezado del archivo con un campo conocido. */
export function mapearEncabezados(encabezados) {
  const mapa = {};
  const sinReconocer = [];
  const usados = [];

  encabezados.forEach(function (encabezado, indice) {
    const limpio = normalizar(encabezado);
    let encontrado = null;

    for (const campo in CAMPOS) {
      if (CAMPOS[campo].indexOf(limpio) > -1) { encontrado = campo; break; }
    }

    if (!encontrado) {
      for (const campo in CAMPOS) {
        const coincide = CAMPOS[campo].some(function (alias) {
          return limpio.indexOf(alias) === 0 || alias.indexOf(limpio) === 0;
        });
        if (coincide) { encontrado = campo; break; }
      }
    }

    // Sin campo, o el campo ya lo ocupó una columna anterior: se ignora,
    // pero se reporta. Antes la columna repetida desaparecía en silencio.
    if (!encontrado || usados.indexOf(encontrado) > -1) {
      sinReconocer.push(encabezado);
      return;
    }

    mapa[indice] = encontrado;
    usados.push(encontrado);
  });

  return { mapa: mapa, sinReconocer: sinReconocer, reconocidos: usados };
}

/**
 * Texto CSV -> { registros, sinReconocer, faltantes }
 * `registros`: [{ fila, datos }] en crudo, sin normalizar todavía.
 */
export function parsearClientes(texto) {
  const filas = parsearFilas(texto);
  if (filas.length === 0) {
    return { registros: [], sinReconocer: [], faltantes: ['referencia', 'nombre'] };
  }

  const encabezados = filas[0];
  const cuerpo = filas.slice(1);
  const resultado = mapearEncabezados(encabezados);

  const faltantes = ['referencia', 'nombre'].filter(function (campo) {
    return resultado.reconocidos.indexOf(campo) === -1;
  });

  const registros = cuerpo.map(function (fila, indice) {
    const datos = {};
    for (const posicion in resultado.mapa) {
      const valor = fila[Number(posicion)];
      datos[resultado.mapa[posicion]] = valor === undefined ? '' : valor;
    }
    return { fila: indice + 2, datos: datos }; // +2: encabezado y base 1
  });

  return { registros: registros, sinReconocer: resultado.sinReconocer, faltantes: faltantes };
}

export function leerArchivo(archivo) {
  return new Promise(function (resolver, rechazar) {
    const lector = new FileReader();
    lector.onload = function () { resolver(String(lector.result)); };
    lector.onerror = function () { rechazar(new Error('No se pudo leer el archivo.')); };
    lector.readAsText(archivo, 'UTF-8');
  });
}
