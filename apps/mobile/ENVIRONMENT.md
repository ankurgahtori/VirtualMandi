# Mobile Android/iOS development environment

Plan 07 starts with native environment setup. The repository uses Expo managed workflow, so Xcode/Android Studio are installed on the developer machine rather than committed into the repository.

## Common prerequisites

- macOS with current updates
- Node.js 22+
- pnpm 9.15.0 (`corepack` may be unavailable on some machines; `npm install --global pnpm@9.15.0` is an alternative)
- Git
- Watchman: `brew install watchman`
- Docker Desktop running for PostgreSQL/LocalStack and the API

From the repository root:

```bash
pnpm install
pnpm infra:up
pnpm --filter @virtual-mandi/database prisma:generate
pnpm db:migrate
pnpm db:seed
```

## One-time mobile environment

Create `apps/mobile/.env.local` once:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_DEFAULT_LOCALE=en-IN

# Optional development-only login prefill; do not use these in production.
EXPO_PUBLIC_DEV_LOGIN_EMAIL=admin@virtualmandi.local
EXPO_PUBLIC_DEV_LOGIN_PASSWORD=VirtualMandi123!
```

The API server stays on `http://localhost:3000`. On iOS Simulator, `localhost` already means the Mac. The `start` command automatically attempts `adb reverse`, which maps Android Emulator `localhost:3000` to Mac `localhost:3000`; it safely does nothing when no Android emulator is connected.

## Install the mobile build

Start the selected iOS Simulator or Android Emulator first, then run one command.

### iOS Simulator

```bash
pnpm --filter @virtual-mandi/mobile install:ios
```

### Android Emulator

```bash
pnpm --filter @virtual-mandi/mobile install:android
```

These commands build and install the native development build without starting the Expo server.

## Start the Expo server

Run this in a separate terminal:

```bash
pnpm --filter @virtual-mandi/mobile start
```

The server uses the development build installed above. Keep this terminal running while using the app. You do not need to update `EXPO_PUBLIC_API_BASE_URL` for each start.

## Physical device

1. Put the phone and Mac on the same Wi-Fi network.
2. Find the Mac LAN IP, for example with `ipconfig getifaddr en0`.
3. Ensure the API listens on `0.0.0.0` and macOS firewall permits port 3000.
4. Set the LAN address in `.env.local`, for example:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000
EXPO_PUBLIC_DEFAULT_LOCALE=en-IN
```

5. Start Expo with `pnpm --filter @virtual-mandi/mobile start` and scan the QR code in Expo Go, or use a development build.

## Expo Go vs development build

- Expo Go is sufficient for this Plan 07 shell and navigation.
- `expo-secure-store` is supported in Expo Go for basic development, but production behavior and native configuration must be tested in a development build before release.
- Future video/music/native integrations may require a development build and cannot be assumed to work in Expo Go.
- Never put `DATABASE_URL`, AWS credentials, JWT secrets, or admin configuration in `EXPO_PUBLIC_*` variables. Expo public variables are bundled into the client.

## Startup configuration

`EXPO_PUBLIC_API_BASE_URL` is required and must be HTTP(S). Invalid or missing values fail at startup with a pointer to this file. `EXPO_PUBLIC_DEFAULT_LOCALE` accepts the shared locale aliases (`en`, `en-IN`, `hi`, `hi-IN`) and falls back to English. The optional `EXPO_PUBLIC_DEV_LOGIN_EMAIL` and `EXPO_PUBLIC_DEV_LOGIN_PASSWORD` values prefill only the login form in development builds (`__DEV__`); remove them from `.env.local` whenever you no longer want the prefill.
