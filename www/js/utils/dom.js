/* Ayudas mínimas de DOM. Sin dependencias. */

export function el(etiqueta, props = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;

    if (clave === 'class') nodo.className = valor;
    else if (clave === 'html') nodo.innerHTML = valor;
    else if (clave === 'texto') nodo.textContent = valor;
    else if (clave === 'dataset') Object.assign(nodo.dataset, valor);
    else if (clave.startsWith('on') && typeof valor === 'function') {
      nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave in nodo && clave !== 'list') {
      nodo[clave] = valor;
    } else {
      nodo.setAttribute(clave, valor === true ? '' : valor);
    }
  }

  for (const hijo of [].concat(hijos)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }

  return nodo;
}

export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

export function avisar(mensaje, tipo = '') {
  const contenedor = document.getElementById('avisos');
  if (!contenedor) return;

  const aviso = el('div', { class: `aviso ${tipo}`.trim(), texto: mensaje });
  contenedor.append(aviso);
  setTimeout(() => aviso.remove(), 3600);
}

export function confirmar(mensaje, textoAceptar = 'Aceptar') {
  return new Promise((resolver) => {
    const dialogo = el('dialog', {}, [
      el('p', { texto: mensaje, style: 'margin:0 0 16px' }),
      el('div', { class: 'acciones', style: 'margin-top:0' }, [
        el('button', {
          class: 'btn-secundario',
          type: 'button',
          texto: 'Cancelar',
          onclick: () => { dialogo.close(); resolver(false); }
        }),
        el('button', {
          class: 'btn-primario',
          type: 'button',
          texto: textoAceptar,
          onclick: () => { dialogo.close(); resolver(true); }
        })
      ])
    ]);

    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
  });
}

const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

export function moneda(valor) {
  const numero = Number(valor);
  return formatoMoneda.format(Number.isFinite(numero) ? numero : 0);
}

export function fecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}
