# Plan 06 — Mobile environment setup

## Goal

Prepare the development environment and Expo shell independently from implementing the Virtual Mandi experience.

## Scope

- Confirm supported Node.js, package manager, JavaScript runtime, and Expo SDK versions.
- Bootstrap `apps/mobile` as an Expo React Native TypeScript app within the workspace.
- Document iOS simulator, Android emulator, and physical-device workflows.
- Configure environment variables for API base URL using Expo-safe public configuration; never place secrets in the app bundle.
- Document that mobile development talks to the API running on the host/network, while API media tests use the Docker LocalStack endpoint; do not expose LocalStack credentials to mobile.
- Add a typed mobile config loader with development/test validation.
- Configure linting, formatting, TypeScript, and a basic test runner compatible with the workspace.
- Add a placeholder screen proving the app launches and can resolve `@virtual-mandi/shared`.
- Document when a development build is required instead of Expo Go (for example, native media or auth integrations).

## Constraints

- Do not implement the feed, auth screens, navigation, or media playback here; those belong to Plan 06.
- Do not import Prisma Client.

## Validation

- Launch on the selected simulator/emulator or physical device.
- Run mobile typecheck, lint, and tests.
- Confirm API base URL configuration works in development and fails clearly when absent.

## Definition of done

- A new developer can follow the README and launch the mobile shell.
- Workspace shared package imports work in React Native.
- Native setup assumptions are documented for both iOS and Android.
