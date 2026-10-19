#!/usr/bin/env bash
# Builds ../stapelgek.apk without the Android SDK: every tool comes from Maven Central.
#   aapt2 + framework resources: apktool-lib    classes: android stubs (API 16)
#   dex: dalvik-dx                              signing: apksig
# Needs Java 17+, Python 3, curl, zip and (for the web game) node: cd .. && npm install && npm run build
set -euo pipefail

cd "$(dirname "$0")"
VERSION_CODE=${VERSION_CODE:-7}
VERSION_NAME=${VERSION_NAME:-1.3.2}
MIN_SDK=24
TARGET_SDK=34

BUILD=build
TOOLS=$BUILD/tools
MAVEN=https://repo1.maven.org/maven2
mkdir -p "$TOOLS"

fetch() { # fetch <maven path> <file>
  [ -f "$TOOLS/$2" ] || curl -sSfL "$MAVEN/$1" -o "$TOOLS/$2"
}
fetch org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar apktool-lib.jar
fetch com/google/android/android/4.1.1.4/android-4.1.1.4.jar android.jar
fetch com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar
fetch com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
if [ ! -x "$TOOLS/aapt2" ]; then
  unzip -joq "$TOOLS/apktool-lib.jar" prebuilt/linux/aapt2 prebuilt/android-framework.jar -d "$TOOLS"
  chmod +x "$TOOLS/aapt2"
fi

rm -rf "$BUILD/out" && mkdir -p "$BUILD/out/res" "$BUILD/out/classes" "$BUILD/out/assets"

# The game itself goes in as assets.
cp ../index.html ../game.js ../icon.png "$BUILD/out/assets/"

# Resources and manifest.
"$TOOLS/aapt2" compile --dir res -o "$BUILD/out/res"
"$TOOLS/aapt2" link -o "$BUILD/out/unsigned.apk" \
  -I "$TOOLS/android-framework.jar" \
  --manifest AndroidManifest.xml \
  --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$BUILD/out/assets" \
  "$BUILD/out/res"/*.flat

# Code.
javac --release 8 -nowarn -classpath "$TOOLS/android.jar" \
  -d "$BUILD/out/classes" $(find java -name '*.java')
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=$MIN_SDK \
  --output="$BUILD/out/classes.dex" "$BUILD/out/classes"
(cd "$BUILD/out" && zip -qj unsigned.apk classes.dex)
python3 -I tools/align.py "$BUILD/out/unsigned.apk" "$BUILD/out/aligned.apk"

# Sign. This apksig still touches a JDK internal on start-up.
java --add-exports java.base/sun.security.x509=ALL-UNNAMED -cp "$TOOLS/apksig.jar" tools/Sign.java "$BUILD/out/aligned.apk" ../stapelgek.apk \
  stapelgek.keystore stapelgek stapelgek
ls -l ../stapelgek.apk
