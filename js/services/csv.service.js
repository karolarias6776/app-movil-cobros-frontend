/* Parser de CSV sin dependencias.
   Se escribe a mano en vez de usar papaparse por CDN: la app debe funcionar
   sin red desde el primer arranque y sin proceso de compilación.
   Soporta: comillas dobles, saltos de línea dentro de comillas, BOM,
   separador , o ; detectado automáticamente. */

const CAMPOS = {
  documento: ['documento', 'cedula', 'cc', 'identificacion', 'nit', 'id', 'doc'],
  nombre: ['nombre', 'nombres', 'cliente', 'nombre completo', 'razon social'],
  telefono: ['telefono', 'tel', 'celular', 'movil', 'contacto', 'whatsapp'],
  direccion: ['direccion', 'dir', 'domicilio', 'barrio', 'ubicacion'],
  montoTotal: ['monto total', 'monto', 'total', 'valor', 'prestamo', 'credito', 'deuda'],
  saldo: ['saldo', 'saldo pendiente', 'pendiente', 'resta', 'restante'],
  cuota: ['cuota', 'valor cuota', 'abono', 'pago diario'],
  frecuencia: ['frecuencia', 'periodicidad', 'modalidad'],
  diaCobro: ['dia de cobro', 'dia cobro', 'dia', 'dia de pago'],
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

/** Texto CSV -> matriz de filas (arrays de strings). */
export function parsearFilas(texto) {
  const limpio = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const separador = detectarSeparador(limpio.split('\n')[0] || '');

  const filas = [];
  let fila = [];
  let celda = '';
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const caracter = limpio[i];

    if (enComillas) {
      if (caracter === '"') {
        if (limpio[i + 1] === '"') { celda += '"'; i++; }
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
      if (fila.some((valor) => valor !== '')) filas.push(fila);
      fila = [];
      celda = '';
      continue;
    }

    celda += caracter;
  }

  fila.push(celda.trim());
  if (fila.some((valor) => valor !== '')) filas.push(fila);

  return filas;
}

/** Empareja cada encabezado del archivo con un campo conocido. */
export function mapearEncabezados(encabezados) {
  const mapa = {};
  const sinReconocer = [];

  encabezados.forEach((encabezado, indice) => {
    const limpio = normalizar(encabezado);
    let campoEncontrado = null;

    for (const [campo, alias] of Object.entries(CAMPOS)) {
      if (alias.includes(limpio)) { campoEncontrado = campo; break; }
    }

    if (!campoEncontrado) {
      for (const [campo, alias] of Object.entries(CAMPOS)) {
        if (alias.some((a) => limpio.startsWith(a) || a.startsWith(limpio))) {
          campoEncontrado = campo;
          break;
        }
      }
    }

    if (campoEncontrado && !Object.values(mapa).includes(campoEncontrado)) {
      mapa[indice] = campoEncontrado;
    } else if (!campoEncontrado) {
      sinReconocer.push(encabezado);
    }
  });

  return { mapa, sinReconocer };
}

/**
 * Texto CSV -> { registros, sinReconocer, faltantes }
 * `registros`: [{ fila, datos }] con datos en crudo (sin normalizar aún).
 */
export function parsearClientes(texto) {
  const filas = parsearFilas(texto);
  if (filas.length === 0) {
    return { registros: [], sinReconocer: [], faltantes: ['documento', 'nombre'] };
  }

  const [encabezados, ...cuerpo] = filas;
  const { mapa, sinReconocer } = mapearEncabezados(encabezados);
  const reconocidos = Object.values(mapa);

  const faltantes = ['documento', 'nombre'].filter((campo) => !reconocidos.includes(campo));

  const registros = cuerpo.map((fila, indice) => {
    const datos = {};
    for (const [posicion, campo] of Object.entries(mapa)) {
      datos[campo] = fila[Number(posicion)] === undefined ? '' : fila[Number(posicion)];
    }
    return { fila: indice + 2, datos }; // +2: encabezado + base 1
  });

  return { registros, sinReconocer, faltantes };
}

export function leerArchivo(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo, 'UTF-8');
  });
}
