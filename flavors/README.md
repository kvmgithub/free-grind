# App flavors

The same code builds two apps, selected with `FG_FLAVOR`:

| `FG_FLAVOR` | Backend | Manifest |
|---|---|---|
| `grindr` (default) | Grindr's servers, with the Grindr workarounds | [`grindr/flavor.json`](./grindr/flavor.json) |
| `server` | a Free Grind server only, no workarounds | `server/app-flavor/flavor.json` (private repository, checked out at `server/`) |

The flavor sets the app's identity. Product features are switched by the server's feature flags, not by the flavor.

## Manifest (`flavor.json`)

| Field | Used for |
|---|---|
| `id` | `grindr` or `server`; must match `FG_FLAVOR` |
| `appName` | Every user-visible name: window title, launcher, texts (`{{appName}}`), installer |
| `appSlug` | Lowercase folder and file prefix: app data folders, keyring service, export file names, release asset names (`<slug>-v<version>.apk`) |
| `folderName` | Export folder (`Downloads/<folderName>`, iOS `Documents/<folderName>`) |
| `identifier` | Tauri identifier on desktop and iOS (data directory); not used on Android, see below |
| `userAgent` | WebView user agent |
| `github` | `owner/repo` for releases, the in-app updater and links |
| `websiteUrl` | About page |
| `ota.endpoint`, `ota.pubkey` | Frontend OTA updates (hotswap); each flavor needs its own key |
| `android.applicationId` | Android package ID |
| `ios.bundleId` | iOS bundle ID |
| `windows.wixUpgradeCode` | Optional; pins MSI upgrades (Tauri derives it from the name otherwise) |
| `mainBinaryName` | Optional; binary name (Linux packages install it to `/usr/bin`, so two flavors need different ones) |
| `env` | Optional; build variables (`FG_*` only), e.g. the server flavor's `FG_API_URL`, `FG_MEDIA_URL`, `FG_RTC_URL`, `FG_FCM_*`. A variable already set in the environment wins. Locally, `server/.env.app` sets them for the server flavor, for example to point at the dev stack. |

Changing `identifier`, `android.applicationId` or `ios.bundleId` makes a different app: no in-place update, separate data.

On Android, Tauri's `identifier` stays the same for every flavor, because it's the Kotlin package Tauri generates code into. The Gradle `applicationId` is the app's real ID there.

## Assets

Next to the manifest:

- `android/res/`: launcher icons (`mipmap-*/ic_launcher*`, the adaptive icon in `mipmap-anydpi-v26/`), `values/ic_launcher_background.xml`, and `values/strings.xml` with `app_name` and `main_activity_title`. Gradle adds this folder to the app's resources. See [`grindr/android/res`](./grindr/android/res) for the full set.
- `ios/AppIcon.appiconset/`: optional; replaces the committed app icon in iOS builds.

## Builds

- `scripts/flavor-config.mjs` builds the Tauri config patch.
- `vite.config.mjs` provides the frontend constants and swaps in the workaround stub.
- `src-tauri/build.rs` provides the Rust name and slug.
- `build.gradle.kts` sets the Android ID and resources.
- `ci/build/ios.sh` sets the iOS bundle.

- `scripts/flavor-env.mjs` exports name, slug and build variables for the shell build scripts.
- `scripts/check-flavor-build.mjs` fails a non-grindr build that still contains workaround traces.

The server flavor also needs the cargo feature `flavor-server`, which `flavor-config.mjs` sets, and `FG_API_URL` / `FG_MEDIA_URL`, from its manifest's `env` or the environment.

Local server-flavor development: `FG_FLAVOR=server bun run tauri dev`, with the dev stack's addresses in `server/.env.app`.
