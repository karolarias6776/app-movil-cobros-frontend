/* A dónde se vuelve desde cada pantalla.

   El problema que resuelve: en Android, el gesto de volver llega a la
   WebView y si no hay nada detrás, cierra la app. Pasaba estando dentro
   de una ficha o del historial, que es justo cuando no se quiere salir.

   Dos reglas:
   - Si hay pantallas apiladas en esta sesión, se vuelve a la anterior.
   - Si no, se sube a la pantalla de la que cuelga esta (sin apilar, para
     no dar vueltas). Solo desde la ruta de hoy se sale de la app. */

const INICIO = '#/ruta';

// Cada entrada del historial guarda su profundidad; así se sabe si hay
// algo propio detrás o si esta es la primera pantalla de la sesión.
let profundidad = 0;

/** La pantalla de la que cuelga esta, o null si es la inicial. */
export function pantallaPadre(hash) {
  const partes = String(hash || '').replace(/^#\//, '').split('/');
  const seccion = partes[0];
  const parametro = partes[1] || '';
  const accion = partes[2] || '';

  if (!seccion || seccion === 'ruta') return null;        // la inicial
  if (seccion === 'cliente' && parametro && accion === 'editar') {
    return '#/cliente/' + parametro;                      // vuelve a la ficha
  }
  if (seccion === 'cliente') return '#/clientes';
  if (seccion === 'clientes' || seccion === 'importar' || seccion === 'ajustes') {
    return INICIO;
  }
  return INICIO;
}

/** ¿Estamos en la pantalla inicial? Desde ahí sí se sale de la app. */
export function esElInicio() {
  const hash = location.hash || INICIO;
  return hash === INICIO || hash === '#/' || hash === '';
}

/** Hay flecha de volver salvo en las pantallas de la barra de abajo. */
export function llevaFlecha() {
  const seccion = String(location.hash || '').replace(/^#\//, '').split('/')[0];
  return !(seccion === '' || seccion === 'ruta' || seccion === 'clientes' ||
    seccion === 'importar');
}

/** Marca la entrada actual del historial con su profundidad. */
export function registrarPantalla() {
  const estado = history.state;

  if (estado && typeof estado.profundidad === 'number') {
    profundidad = estado.profundidad;   // volvimos a una ya visitada
    return;
  }

  profundidad += 1;
  try {
    history.replaceState({ profundidad: profundidad }, '');
  } catch (error) { /* sin history.state seguimos igual, solo sin memoria */ }
}

/** ¿Queda alguna pantalla nuestra por detrás? */
export function hayDondeVolver() {
  return profundidad > 1;
}

/**
 * Vuelve una pantalla atrás.
 * Devuelve false si no hay a dónde: ahí es donde toca salir de la app.
 */
export function volverAtras() {
  if (hayDondeVolver()) {
    history.back();
    return true;
  }

  const padre = pantallaPadre(location.hash);
  if (!padre) return false;

  // replace y no hash: subir no debe apilar, o volver daría vueltas.
  location.replace(padre);
  return true;
}
