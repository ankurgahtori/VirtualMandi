# Plan 07 — Mobile environment setup

## Objective

First make the Android and iOS development environments runnable, then create a launchable Expo shell that can consume shared contracts and reach the local API without exposing server credentials.

## Phase 0 — Android/iOS environment readiness

Complete and document this phase before mobile feature implementation:

- Install Node.js 22+, pnpm 9.15.0, Git, and Watchman on macOS.
- Install Xcode from the Mac App Store, Xcode Command Line Tools, an iOS Simulator runtime, and accept the Xcode license.
- Install Android Studio, Android SDK Platform 35, Android SDK Build-Tools, Android Emulator, and Android SDK Command-line Tools.
- Configure `ANDROID_HOME`/`ANDROID_SDK_ROOT`, add `platform-tools` and `emulator` to `PATH`, and create/start a Pixel emulator.
- Verify `xcrun simctl list`, `adb devices`, `npx expo --version`, and Docker-backed API reachability.
- Provide separate commands for Expo Go, iOS Simulator, Android Emulator, and a physical device.
- Document LAN/firewall requirements and API host mapping: `localhost` for iOS Simulator, `10.0.2.2` for Android Emulator, and the developer machine LAN IP for a physical device.
- Keep native signing files, keystores, provisioning profiles, and secrets out of Git.

This repository cannot install Xcode or Android Studio automatically; `apps/mobile/ENVIRONMENT.md` is the authoritative machine setup checklist.

## Phase 1 — Expo shell implementation

- Bootstrap `apps/mobile` with the selected Expo SDK and TypeScript.
- Add navigation foundation and a placeholder route only; feature screens belong to Plan 08.
- Add Expo-safe public API URL configuration.
- Add secure storage dependency/configuration for later bearer refresh sessions.
- Add `@virtual-mandi/shared` import and verify no Prisma/database dependency enters the bundle.
- Add locale resource loading and a placeholder language switch.
- Document Expo Go versus development build requirements for secure storage and media playback.

## Environment contract

Mobile receives only public values such as API base URL and default locale. It must never receive `DATABASE_URL`, AWS keys, LocalStack credentials, JWT signing secrets, or admin-only configuration.

## Tests

- Typecheck, lint, test placeholder render.
- Launch iOS simulator, Android emulator, and one physical-device path if available.
- Verify missing/invalid API URL produces an actionable startup error.

## Completion criteria

- [x] `pnpm --filter @virtual-mandi/mobile start` is configured and the iOS/Android production bundles export successfully.
- [x] Shared package resolves in Metro through the monorepo resolver.
- [x] API URL can be configured per environment and invalid values fail with actionable guidance.
- [x] No server-only package is reachable from mobile imports.
- [x] Android/iOS machine setup is documented in `apps/mobile/ENVIRONMENT.md`.

## Implementation notes

- Expo SDK 52, React Native, React Navigation, Secure Store, and shared package integration are configured.
- The explicit `apps/mobile/index.js` entry avoids Expo AppEntry resolution through pnpm symlinks.
- `apps/mobile/metro.config.js` maps the shared package's Node-style `.js` TypeScript import specifiers for Metro.
- iOS and Android bundle exports were verified. On the current machine, `adb` is installed but no emulator/device is running; `xcrun` is available but no `simctl` developer-tool runtime is installed, so simulator/device launch remains a local environment follow-up.
