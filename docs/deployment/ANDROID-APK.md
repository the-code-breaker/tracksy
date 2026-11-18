# Android APK builds

**Current: 0.4.1/code 6**, `artifacts/Tracksy-0.4.1-arm64.apk` and `.aab`. Removes native styling interception that stripped button/row layout. Adds fixed headers/actions and settlement pickers. Verification matches the packaged native bundle to the inspected build without CSS interop. Same signing key; physical Android acceptance remains pending. Earlier build descriptions follow.

**Latest: 0.4.0/code 5**, `artifacts/Tracksy-0.4.0-arm64.apk` and `.aab`. Simpler settings, email invitations/reminders, member expense editing/history and restored-session startup. The existing release key is retained. Signatures, packaged artwork/backend/UI settings and 16KB alignment passed. See `artifacts/Tracksy-0.4.0-arm64.verification.json` and `artifacts/TESTING.md`. Physical device acceptance remains pending. The previous artifact paragraph below is historical.

Current artifact: **0.3.0/code 4**, `artifacts/Tracksy-0.3.0-arm64.apk` and `.aab`. This reference-led emerald redesign includes two bundled generated illustrations, Google sign-in, native date picker and bottom-sheet selectors. Same release signing key as earlier local APKs. Both signatures, 16KB ZIP alignment, compiled illustration resources and embedded backend/auth/UI settings were verified. See `artifacts/Tracksy-0.3.0-arm64.verification.json` and `artifacts/TESTING.md` for hashes and device acceptance checks.

The local Windows build uses JDK 17, Android API 36, Build Tools 35.0.0 and 36.0.0, NDK 27.1.12297006, CMake 3.22.1, and the Gradle version specified by the generated Expo template. The current template uses Gradle 9.0.0. Public dependencies and Gradle distributions are downloaded from their official repositories; Gradle and direct SDK archives are checked against their published checksums.

## Build

From `apps/mobile`, generate Android sources when they do not exist:

```powershell
npx expo prebuild --platform android --no-install
```

From the repository root, build a release APK:

```powershell
npm run apk
```

To produce both the installable APK and the Google Play App Bundle:

```powershell
npm run apk -- -Format Both
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-release.ps1
```

The default target is **ARM64 Android phones**. The script uses `apps/mobile/.env` for the public Supabase settings and bundles the JavaScript and fonts into the application. Sentry source-map upload is disabled for this local build because the Sentry project is not configured.

For a separately installed Android SDK or a different architecture:

```powershell
npm run apk -- -SdkRoot "C:\path\to\Android\Sdk" -Architecture "arm64-v8a,armeabi-v7a"
```

If reusing an existing SDK installation on this computer, `scripts/setup-android-sdk.ps1 -SourceSdk <sdk-directory>` creates a workspace SDK under `.local/android-sdk`. It references already installed public tools and installs the required base API 36 platform in the workspace. Keep the referenced source SDK available. `-DirectInstall` handles Windows SDK-manager file-lock problems using the checksum-verified official base platform archive.

## Signing and artifacts

The first build generates a dedicated RSA release key at `.local/android-signing/tracksy-release.p12`. Its password is protected with Windows DPAPI in `credentials.xml`; neither file is committed. Repeated builds reuse the same key.

Keep the release keystore and securely back up its password for future updates. The DPAPI credential file is tied to this Windows account and computer; it is not a portable password backup.

The output is copied to `artifacts/Tracksy-<version>-<architecture>.apk`, with a SHA-256 checksum file beside it. The build script verifies the APK signature before publishing the local artifact. The SDK, signing material, and packaged native output stay under ignored workspace directories. Gradle caches use `%TEMP%\Tracksy-gradle` and CMake staging uses `%TEMP%\Tracksy-native` to avoid Windows workspace folder locks. Each Gradle project keeps its own default task-history directory.

This local signed APK is for installation and device acceptance. Store billing, push delivery, OAuth providers, emailed-link completion, and other production acceptance checks remain as recorded in [HOSTED-SETUP.md](HOSTED-SETUP.md).

## Latest verified testing artifacts - authentication repair, 29 October 2026

Version **0.2.1**, code **3**, package `app.tracksy.mobile`, ARM64, minimum API 24 and target API 36. This version uses the same dedicated local signing key as earlier APKs and can be installed over them.

- `artifacts/Tracksy-0.2.1-arm64.apk`: 52,961,887 bytes; SHA-256 `b4a32df1ce6f32f38d6e8dd6f273bba6e5ad53569a38221ae3f4be2c83070520`.
- `artifacts/Tracksy-0.2.1-arm64.aab`: 38,819,505 bytes; SHA-256 `abbf5792451509affdb462cf576f8ddec1aea429466f36cb01a4ca0533a479f8`.

APK v2 signature, 16KB-aware alignment, App Bundle signature and embedded hosted configuration checks passed. The release verifier additionally confirms the new confirmation-resend and delivery-error UI strings in both bundles. The SMTP service was repaired independently; new account signup still requires email confirmation and a 12-character password. No Android device was connected.

## Previous responsive testing artifacts - 29 October 2026

Version **0.2.0**, code **2**, package `app.tracksy.mobile`, ARM64, minimum API 24 and target API 36. This version uses the same dedicated signing key as 0.1.0.

- `artifacts/Tracksy-0.2.0-arm64.apk`: 52,957,215 bytes; SHA-256 `a6c47cbea75ffab038f01f2e663caf3769cae4e8b1aa622706f9a08d1e0a74d1`.
- `artifacts/Tracksy-0.2.0-arm64.aab`: 38,816,096 bytes; SHA-256 `4cfe92685ba0b1d9c405070e4f06f5de36881296728a4c9261c050daa1ea3289`.

APK v2 signature, 16KB-aware ZIP alignment and App Bundle JAR signature passed. The verification script checked package/version, blocked broad media/storage permissions, embedded Hermes, hosted Supabase settings, responsive UI strings and support URL in both formats. Evidence is in `artifacts/Tracksy-0.2.0-arm64.verification.json`. No Android phone was connected; device acceptance is still required.

## Historical testing artifact - 28 October 2026

`artifacts/Tracksy-0.1.0-arm64.apk` was built successfully with release lint enabled. Package `app.tracksy.mobile`, version `0.1.0`, version code `1`, ARM64, minimum Android API 24 (Android 7.0), target API 36. File size: 53,062,747 bytes.

The dedicated 3072-bit RSA release signature passes APK Signature Scheme v2 verification. Package alignment passes `zipalign -c -P 16 4`. The APK is not debuggable and includes its Hermes runtime, JavaScript bundle, app assets, and fonts. The embedded Supabase endpoint and public key match the configured hosted project. Verification details and the SHA-256 checksum are beside the APK.

SHA-256: `58fa3468d11b15d315a7856a07a00173f4f58ce07c91131ce62ff8ac1e135645`.

No Android device runtime test has been performed. Install this build on an ARM64 phone for acceptance testing; no Metro server or Expo Go is needed. Build workers are limited to one Gradle worker and two Metro workers for this machine's memory capacity.
