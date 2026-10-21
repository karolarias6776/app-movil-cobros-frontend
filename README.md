# Ruta de cobro

PWA para llevar la cartera de clientes y la ruta de cobro diaria. Funciona sin
internet: todo se guarda en el celular, no hay servidor ni cuenta de usuario.

Sin dependencias, sin compilación: son archivos estáticos que el navegador
ejecuta tal cual (módulos ES nativos).

## Correr en local

Los módulos ES necesitan HTTP; abrir `index.html` con doble clic (`file://`) no
funciona.

```bash
python3 -m http.server 4173
```

Luego abrir <http://localhost:4173>.

## Desplegar

Cloudflare Pages sirve la raíz del repositorio tal cual ([wrangler.jsonc](wrangler.jsonc)).
`not_found_handling: none` es a propósito: si falta un archivo debe dar 404 de
verdad y no HTML disfrazado de módulo.

Al cambiar archivos del shell hay que subir `VERSION` en [sw.js](sw.js) para que
el Service Worker renueve su caché.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `js/views/` | Una pantalla por archivo. Construyen DOM, no hablan con la base. |
| `js/services/` | Reglas de negocio: ruta, facturación, CSV, importación, avisos, calendario. |
| `js/db/` | IndexedDB. La UI solo pasa por `clientes.repo.js`. |
| `js/utils/` | Ayudas de DOM y el modelo del cliente con sus validaciones. |

Reglas que conviene conocer antes de tocar código:

- **El cliente se identifica por la referencia de pago**, no por el documento.
  Es la clave única en la base y la que usa la importación para comparar.
- **Día de facturación** ([config.js](js/services/config.js)): pasado ese día del
  mes, el sistema ya generó la factura del mes siguiente. El saldo del archivo la
  trae sumada, así que la ruta separa *vencido* (lo que sí se cobra) de *mes nuevo*.
- **Meses cortos**: quien cobra el 31 cae el 30 en abril y el 28 en febrero.
  Eso lo resuelve `diaEfectivo()` en [fechas.service.js](js/services/fechas.service.js),
  y el `.ics` lo replica con `BYSETPOS=-1`.
- **Origen del cliente** (`manual` o `csv`): la importación respeta los creados a
  mano salvo que se marque lo contrario.

Para agregar un campo al cliente: `normalizarCliente()` en
[validadores.js](js/utils/validadores.js), el alias de columna en
[csv.service.js](js/services/csv.service.js) y el campo en
[cliente-form.view.js](js/views/cliente-form.view.js).

Para cambiar el esquema de la base: subir `DB_VERSION` y agregar un bloque
`if (versionAnterior < N)` en `migrar()` ([database.js](js/db/database.js)).

## Avisos

Con la app abierta, los recordatorios salen solos. Con la app cerrada no hay
forma confiable de programarlos en una PWA, así que Ajustes exporta la ruta como
archivo `.ics`: el calendario del celular da la alarma, sin internet y sin servidor.

## Limitaciones conocidas

- Los datos viven solo en ese navegador. Si se borran los datos del sitio, se
  pierde la cartera: todavía no hay exportación de respaldo.
- No se registran pagos desde la app; `ultimoPago` entra por CSV o a mano.
