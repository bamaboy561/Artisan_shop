# Artisan Android

Native Android container for `https://artisan.shop.kg`.

## Test APK

Run from PowerShell:

```powershell
./build-test-apk.ps1
```

The APK is created at `releases/Artisan-Android-1.0.0-test.apk`.

## Release bundle

1. Create an upload key and keep it outside the repository.
2. Copy `keystore.properties.example` to `keystore.properties` and set the real values.
3. Run `./gradlew.bat bundleRelease`.

The Play Store bundle is created at `app/build/outputs/bundle/release/app-release.aab`.

The package name is `kg.shop.artisan`. The release build intentionally remains unsigned until
`keystore.properties` is configured.

## Firebase push notifications

1. Create a Firebase Android app with package name `kg.shop.artisan`.
2. Download `google-services.json` to `android/app/google-services.json`.
3. Enable the Firebase Cloud Messaging API (HTTP v1).
4. Add the service account values to the website environment:

```text
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The app remains buildable without `google-services.json`; push registration is simply disabled.
The test APK uses the same package name as the future Play Store build, so uninstall a debug-signed
test APK before installing a differently signed release build.
