# Ruta de cobro

Cartera de clientes y ruta de cobro diaria. Funciona sin internet: todo se
guarda en el celular, no hay servidor ni cuenta de usuario.

Se distribuye de dos formas, con **el mismo código**:

- **App de Android** (Capacitor): los avisos de cada visita los programa el
  sistema, así que suenan con la app cerrada, sin señal y a la hora exacta.
- **PWA en la web** (Cloudflare Pages): igual de funcional, pero el navegador no
  permite programar avisos con la app cerrada.

El código web no se compila: son archivos estáticos que el navegador ejecuta tal
cual (módulos ES nativos). npm solo aparece para construir el APK.

## Correr en local

Los módulos ES necesitan HTTP; abrir `index.html` con doble clic (`file://`) no
funciona.

```bash
python3 -m http.server 4173 --directory www
```

Luego abrir <http://localhost:4173>.

## Compilar la app de Android

Hace falta **JDK 21** y el Android SDK (no hace falta Android Studio: bastan las
command-line tools). Capacitor 7 compila con `source release 21`, así que un JDK
17 falla con `invalid source release: 21`.

```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/`.

Después de tocar cualquier archivo de `www/`, hay que repetir `npx cap sync
android` para que los cambios entren en el APK.

## Publicar una versión

```bash
./herramientas/publicar.sh 1.3 "Lo que cambió"
```

Sube el `versionCode` de Android, reescribe [`version.js`](www/js/version.js),
compila el APK, lo deja en `www/descargas/` (borrando el anterior) y escribe
`www/version.json`. Después solo queda `git commit` y `git push`.

Las tres versiones (Android, la que viaja en el APK y la publicada) salen
siempre del mismo sitio, así que no pueden desincronizarse.

## Cómo llega la app al celular

`descargar.html` es la página que se le pasa a la cobradora: lee `version.json`
y ofrece el APK vigente con las instrucciones de instalación.

La app instalada consulta ese mismo `version.json` al abrirse y, si hay una
versión más nueva, lo dice en Ajustes con el enlace para bajarla. Sin internet
no hace nada; en la web tampoco, porque allí no hay APK que actualizar.

Android no permite que una app fuera de Play Store se actualice sola: lo más
que se puede hacer es avisar y dar el enlace.

## Desplegar

Cloudflare Pages sirve la raíz del repositorio tal cual ([wrangler.jsonc](wrangler.jsonc)).
`not_found_handling: none` es a propósito: si falta un archivo debe dar 404 de
verdad y no HTML disfrazado de módulo.

Al cambiar archivos del shell hay que subir `VERSION` en [sw.js](www/sw.js) para que
el Service Worker renueve su caché.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `www/` | Toda la app web. Es lo único que se publica y lo único que entra al APK. |
| `www/js/views/` | Una pantalla por archivo. Construyen DOM, no hablan con la base. |
| `www/js/views/cliente.view.js` | Ficha del cliente: lo que se ve en la puerta, con WhatsApp y llamada. |
| `www/js/services/` | Reglas de negocio: ruta, facturación, CSV, importación, avisos, calendario. |
| `www/js/db/` | IndexedDB. La UI solo pasa por `clientes.repo.js`. |
| `www/js/utils/` | Ayudas de DOM y el modelo del cliente con sus validaciones. |
| `android/` | Proyecto nativo que genera Capacitor. Se versiona: lleva los permisos y los iconos. |

Reglas que conviene conocer antes de tocar código:

- **El cliente se identifica por la referencia de pago**, no por el documento.
  Es la clave única en la base y la que usa la importación para comparar.
- **Día de facturación** ([config.js](www/js/services/config.js)): pasado ese día del
  mes, el sistema ya generó la factura del mes siguiente. El saldo del archivo la
  trae sumada, así que la ruta separa *vencido* (lo que sí se cobra) de *mes nuevo*.
- **Meses cortos**: quien cobra el 31 cae el 30 en abril y el 28 en febrero.
  Eso lo resuelve `diaEfectivo()` en [fechas.service.js](www/js/services/fechas.service.js),
  y el `.ics` lo replica con `BYSETPOS=-1`.
- **Origen del cliente** (`manual` o `csv`): la importación respeta los creados a
  mano salvo que se marque lo contrario.

Para agregar un campo al cliente: `normalizarCliente()` en
[validadores.js](www/js/utils/validadores.js), el alias de columna en
[csv.service.js](www/js/services/csv.service.js) y el campo en
[cliente-form.view.js](www/js/views/cliente-form.view.js).

Para cambiar el esquema de la base: subir `DB_VERSION` y agregar un bloque
`if (versionAnterior < N)` en `migrar()` ([database.js](www/js/db/database.js)).

## Avisos

[`notificaciones.service.js`](www/js/services/notificaciones.service.js) tiene dos
caminos y elige solo, mirando si `window.Capacitor` está presente:

- **En Android** programa las alarmas con `LocalNotifications`, siete días por
  adelantado, para que suenen aunque la app no se abra en toda la semana. Antes
  de programar cancela las anteriores, o se duplicarían en cada apertura.
- **En la web** usa `setTimeout`, que solo vale para hoy y mientras la pestaña
  siga viva.

Los plugins se leen de `window.Capacitor.Plugins` en tiempo de ejecución, nunca
con `import`: así el código web sigue sin necesitar compilación.

**Alarmas exactas:** Android 12+ las retrasa a su antojo salvo que el usuario
conceda `SCHEDULE_EXACT_ALARM`. Ajustes comprueba el permiso y, si falta, muestra
un aviso con un botón que lleva a la pantalla del sistema.

Queda además la exportación a `.ics`, útil para quien use solo la web: el
calendario del celular da la alarma sin internet y sin servidor.

## Respaldo

Ajustes tiene **Descargar respaldo** y **Restaurar respaldo**. El archivo `.json`
lleva la cartera completa y los ajustes, y restaura los registros idénticos
(mismo `id`, mismo `origen`, mismas fechas).

El CSV de facturación no sirve de respaldo: no trae los clientes creados a mano,
ni las notas, horas de visita o anticipaciones que agregó la cobradora.

La app pide `navigator.storage.persist()` al arrancar para que el navegador no
borre la base si al celular le falta espacio, pero **Chrome puede negarlo** si la
PWA no está instalada. El respaldo sigue siendo la única protección real frente a
borrar los datos del sitio o cambiar de teléfono.

## Ya pagó y aplazar

Las dos cosas que se hacen en la puerta, desde la ficha del cliente
([cobros.service.js](www/js/services/cobros.service.js)):

- **Ya pagó este mes** marca `ultimoPago` con la fecha de hoy y añade una línea
  al `historialCobros`. El cliente sale de la ruta y pasa a «Ya cobrados» hasta
  el mes siguiente, cuando reaparece solo: la marca no se borra, simplemente
  deja de ser del mes en curso.

  La ficha muestra el **histórico**: una línea por mes cobrado, de la más nueva
  a la más vieja. El mes que no aparece es un mes que no se cobró. Se guarda
  **una sola entrada por mes**, así que remarcar el mismo mes no duplica nada.

  Deshacer quita la línea de ese mes y devuelve `ultimoPago` al cobro anterior,
  para que corregir una equivocación no borre lo que ya estaba bien.
- **Aplazar** pregunta siempre el alcance, porque son dos cosas distintas:
  - *Solo por esta vez* (lo normal) guarda `aplazadoHasta` y mueve la visita de
    **este mes**. El día de cobro no se toca y el mes que viene vuelve solo.
  - *De ahora en adelante* cambia el `diaCobro` y no usa aplazamiento: el
    cliente pasa a cobrarse ese día todos los meses.

**Ninguna de las dos toca el saldo**: ese lo manda el archivo de facturación.
Lo que se registra aquí es si hay que volver o no.

`ultimoPago`, `aplazadoHasta` y `historialCobros` **no pasan por
`normalizarCliente()`** a
propósito, y la importación no los pisa con valores vacíos
(`sinPisarLoDeLaCalle`). Así, al reimportar el CSV del mes o al editar el
cliente, no se borra lo que se marcó en la calle. Si el CSV **sí** trae columna
de último pago, entonces manda el archivo.

En modo *reemplazar* sí se pierden, porque ahí se borra la cartera a propósito.

## Contactar al cliente

La ficha tiene **Escribir por WhatsApp**, que abre el chat con un recordatorio ya
escrito (saldo y día de cobro). `wa.me` solo prellena el texto: no envía nada
hasta que la cobradora lo revise y toque enviar.

Los teléfonos del archivo vienen sin indicativo, y WhatsApp lo exige, así que
[`contacto.service.js`](www/js/services/contacto.service.js) se lo antepone
usando el de Ajustes (57 por defecto). Si el número ya lo trae, no lo repite.

El comprobante tras un pago (HU-3.2) todavía no: necesita el historial de pagos
de la HU-3.1, que no está hecho.

## Limitaciones conocidas

- No se registra el **monto** pagado, solo en qué meses se cobró. Los montos y
  el saldo calculado son la HU-3.1 y no están hechos.
- Aplazar «por esta vez» solo mueve la visita dentro del mismo mes.
