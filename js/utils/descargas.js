/* Entrega un archivo al celular para abrirlo o guardarlo.
   Un solo lugar: el .ics y el respaldo se descargan igual. */

export function descargarArchivo(nombre, texto, tipo) {
  const blob = new Blob([texto], { type: tipo || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

/** '2026-10-21' para poner en el nombre del archivo. */
export function selloDeHoy() {
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const dia = hoy.getDate();
  return hoy.getFullYear() + '-' +
    (mes < 10 ? '0' + mes : mes) + '-' +
    (dia < 10 ? '0' + dia : dia);
}
