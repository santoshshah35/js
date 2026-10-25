#!/usr/bin/env bash
# Build build/patro.apk from the web app and this Android wrapper.
#
# Needs a JDK plus the Android build tools packaged by Debian/Ubuntu:
#   sudo apt-get install aapt dalvik-exchange zipalign apksigner android-sdk-platform-23
# Set ANDROID_JAR to use another platform's android.jar.
#
# The signing key lives in android/keystore/ (not committed). Keep it: an
# update to an installed app must be signed with the same key.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="$(cd "$HERE/.." && pwd)"
OUT="$HERE/build"
ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
KEYSTORE_DIR="$HERE/keystore"
KEYSTORE="$KEYSTORE_DIR/patro.jks"
PASSFILE="$KEYSTORE_DIR/password.txt"

for tool in aapt javac dalvik-exchange zipalign apksigner keytool zip; do
  command -v "$tool" >/dev/null || { echo "Missing $tool; see the header of this script." >&2; exit 1; }
done
[ -f "$ANDROID_JAR" ] || { echo "android.jar not found at $ANDROID_JAR" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/assets/www/lib" "$OUT/gen" "$OUT/classes"

echo "Copying the web app"
cp "$WEB/index.html" "$WEB/styles.css" "$WEB/app.js" "$OUT/assets/www/"
cp "$WEB"/lib/*.js "$OUT/assets/www/lib/"

echo "Packaging resources"
aapt package -f -m \
  -J "$OUT/gen" \
  -M "$HERE/AndroidManifest.xml" \
  -S "$HERE/res" \
  -A "$OUT/assets" \
  -I "$ANDROID_JAR" \
  -F "$OUT/patro.unsigned.apk"

echo "Compiling Java"
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 \
  -bootclasspath "$ANDROID_JAR" \
  -d "$OUT/classes" \
  $(find "$OUT/gen" "$HERE/src" -name '*.java')

echo "Converting to dex"
dalvik-exchange --dex --min-sdk-version=21 --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && zip -q patro.unsigned.apk classes.dex)

echo "Aligning"
zipalign -f -p 4 "$OUT/patro.unsigned.apk" "$OUT/patro.aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "Creating a signing key in $KEYSTORE_DIR"
  mkdir -p "$KEYSTORE_DIR"
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$PASSFILE"
  keytool -genkeypair -noprompt -keystore "$KEYSTORE" -alias patro \
    -keyalg RSA -keysize 3072 -validity 10000 \
    -storepass:file "$PASSFILE" -keypass:file "$PASSFILE" \
    -dname "CN=Patro, O=Patro, C=NP" >/dev/null 2>&1
fi

echo "Signing"
apksigner sign --ks "$KEYSTORE" --ks-key-alias patro \
  --ks-pass "file:$PASSFILE" \
  --min-sdk-version 21 \
  --out "$OUT/patro.apk" "$OUT/patro.aligned.apk"
apksigner verify --min-sdk-version 21 "$OUT/patro.apk"

rm -f "$OUT/patro.unsigned.apk" "$OUT/patro.aligned.apk" "$OUT/classes.dex"
echo "Built $OUT/patro.apk ($(du -h "$OUT/patro.apk" | cut -f1))"
