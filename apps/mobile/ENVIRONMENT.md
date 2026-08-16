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

## iOS Simulator

1. Install Xcode from the Mac App Store.
2. Install Command Line Tools: `xcode-select --install`.
3. Open Xcode once, accept the license, and install an iOS Simulator runtime under **Settings → Platforms**.
4. Verify: `xcodebuild -version` and `xcrun simctl list devices`.
5. Copy `.env.example` to `.env.local`; use:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_DEFAULT_LOCALE=en-IN
```

Run:

```bash
pnpm --filter @virtual-mandi/mobile ios
```

`localhost` resolves to the Mac from the iOS Simulator.

## Android Emulator

1. Install Android Studio.
2. In SDK Manager install Android SDK Platform 35, Android SDK Build-Tools, Android SDK Platform-Tools, Android Emulator, and Android SDK Command-line Tools.
3. Create a Pixel API 35 virtual device in Device Manager and start it.
4. Add the SDK to the shell environment (adjust the SDK path if Android Studio uses another location):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
```

5. Verify: `adb devices`, `emulator -list-avds`, and `npx expo --version`.
6. Use the Android host alias:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
EXPO_PUBLIC_DEFAULT_LOCALE=en-IN
```

Run:

```bash
pnpm --filter @virtual-mandi/mobile android
```

`10.0.2.2` maps from the Android emulator to the Mac host. If the API is bound only to another interface or a firewall blocks it, use the Mac LAN IP instead.

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

`EXPO_PUBLIC_API_BASE_URL` is required and must be HTTP(S). Invalid or missing values fail at startup with a pointer to this file. `EXPO_PUBLIC_DEFAULT_LOCALE` accepts the shared locale aliases (`en`, `en-IN`, `hi`, `hi-IN`) and falls back to English.
