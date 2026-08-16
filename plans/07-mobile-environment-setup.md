# Plan 07 — Mobile environment setup

## Objective

Create a launchable Expo shell that can consume shared contracts and reach the local API without exposing server credentials.

## Implementation

- Bootstrap `apps/mobile` with the selected Expo SDK and TypeScript.
- Add navigation foundation and a placeholder route only; feature screens belong to Plan 08.
- Add Expo-safe public API URL configuration. For a physical device, document host LAN IP; for Android emulator, document host alias; for iOS simulator, document localhost behavior.
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

- `pnpm --filter @virtual-mandi/mobile start` launches.
- Shared package resolves in Metro.
- API URL can be configured per environment.
- No server-only package is reachable from mobile imports.
