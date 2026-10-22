#!/usr/bin/env bash
# Publica una version nueva de la app.
#
#   ./herramientas/publicar.sh 1.2 "Ahora se registran los pagos"
#
# Sube la version en los tres sitios donde vive (build.gradle, version.js
# y version.json), compila el APK, lo deja en www/descargas/ y actualiza
# lo que lee la pagina de descarga. Despues solo queda hacer commit y push.

set -euo pipefail

cd "$(dirname "$0")/.."

NOMBRE="${1:-}"
NOTAS="${2:-}"

if [ -z "$NOMBRE" ]; then
  echo "Uso: $0 <version> [notas]"
  echo "Ejemplo: $0 1.2 \"Ahora se registran los pagos\""
  exit 1
fi

if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "$HOME/Android/jdk21" ]; then
    export JAVA_HOME="$HOME/Android/jdk21"
  else
    echo "Falta JAVA_HOME con un JDK 21." >&2
    exit 1
  fi
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

ANTERIOR=$(grep -oP 'versionCode \K\d+' android/app/build.gradle)
CODIGO=$((ANTERIOR + 1))
FECHA=$(date +%Y-%m-%d)
APK="descargas/ruta-de-cobro-$NOMBRE.apk"

echo "==> Version $NOMBRE (codigo $CODIGO, antes $ANTERIOR)"

# 1. Android
sed -i "s/versionCode $ANTERIOR/versionCode $CODIGO/" android/app/build.gradle
sed -i "s/versionName \"[^\"]*\"/versionName \"$NOMBRE\"/" android/app/build.gradle

# 2. La copia que viaja dentro del APK
cat > www/js/version.js <<FIN
/* Version de esta copia de la app.
   La reescribe herramientas/publicar.sh al compilar, junto con el
   versionCode de Android, para que las dos no se desincronicen.
   Dentro del APK viaja empaquetada, asi que dice que version esta
   instalada en el telefono. */

export const VERSION_APP = {
  codigo: $CODIGO,
  nombre: '$NOMBRE'
};
FIN

# 3. Compilar con la version ya puesta.
#
#    Dos cuidados antes del sync, porque cap sync copia www/ ENTERA
#    dentro del APK:
#
#    - Vaciar www/descargas, o cada version se lleva dentro a la
#      anterior y el archivo engorda el doble en cada publicacion.
#    - Capacitor abre siempre index.html, y en el sitio ese archivo es
#      la pagina de descarga. Dentro del APK tiene que ser la app, asi
#      que se intercambian mientras dura la compilacion y se devuelven
#      al terminar, pase lo que pase.
echo "==> Compilando..."
rm -f www/descargas/*.apk

cp www/index.html /tmp/ruta-cobro-descarga.html
devolver_el_index() {
  cp /tmp/ruta-cobro-descarga.html www/index.html
  rm -f /tmp/ruta-cobro-descarga.html
}
trap devolver_el_index EXIT

cp www/app.html www/index.html

npx cap sync android >/dev/null
( cd android && ./gradlew assembleDebug --console=plain -q )

devolver_el_index
trap - EXIT

# 4. Publicar el APK, ya con el empaquetado hecho. Se deja solo el
#    vigente: la pagina de descarga siempre apunta a uno, y asi el
#    repositorio no engorda sin control.
mkdir -p www/descargas
cp android/app/build/outputs/apk/debug/app-debug.apk "www/$APK"
TAMANO=$(awk "BEGIN {printf \"%.1f\", $(stat -c%s "www/$APK") / 1048576}")

# 5. Lo que leen la pagina de descarga y la app instalada
cat > www/version.json <<FIN
{
  "versionCode": $CODIGO,
  "versionName": "$NOMBRE",
  "apk": "$APK",
  "fecha": "$FECHA",
  "tamanoMB": $TAMANO,
  "notas": "$NOTAS"
}
FIN

echo
echo "==> Listo: version $NOMBRE ($TAMANO MB)"
echo "    www/$APK"
echo
echo "    Revisa y publica:"
echo "      git add -A && git commit -m 'publicar la version $NOMBRE' && git push"
