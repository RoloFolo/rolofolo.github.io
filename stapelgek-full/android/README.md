# Stacking Mad for Android

A WebView around the game in `..` (index.html, game.js, fonts, themes), with rewarded AdMob videos.

Build (needs Java 17+, Node and the Android SDK with platform 36; `local.properties` points at the SDK):

    cd .. && npm install && npm run build
    cd android && ./gradlew assembleRelease bundleRelease

- `app/build/outputs/bundle/release/app-release.aab` goes to Google Play.
- `app/build/outputs/apk/release/app-release.apk` is for installing directly; copy it to `../stapelgek-full.apk`.
- The version name comes from `../package.json`; raise `versionCode` in `app/build.gradle` for every Play upload.
- AdMob ids are in `gradle.properties` (Google's test ids for now).
- The Play upload key is `upload.keystore` with `keystore.properties`, kept out of this repository.
  Without them the release build is signed with the debug key, fine for trying out but not for Play.
