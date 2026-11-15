// Prints the TAURI_CONFIG merge patch for one build:
//
//   bun scripts/flavor-config.mjs [linux|windows|macos|android|ios]
//
// The target platform defaults to the host OS. It matters because the patch
// replaces app.windows as a whole (JSON merge patch replaces arrays), so it
// starts from the window list Tauri would use for that platform
// (tauri.<platform>.conf.json if it has one, else tauri.conf.json).
//
// 1. App identity from the flavor manifest (FG_FLAVOR, see scripts/flavor.mjs):
//    product name, identifier, window title, user agent, OTA endpoint and key,
//    WiX upgrade code, binary name, and capabilities naming its folders (3.).
//
// 2. The Free Grind server built into the app. Its addresses come only from
//    the build environment (no defaults):
//      FG_API_URL   REST/WebSocket   (read by Rust, grindr-patched/src/server.rs)
//      FG_MEDIA_URL media host       (Rust; here: HTTP scope for the media cache)
//      FG_RTC_URL   LiveKit host     (here: CSP connect-src for video calls)
//    Without them the build has no Free Grind server. Only these exact hosts
//    are added, nothing broader.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { loadFlavor } from "./flavor.mjs";

const PLATFORMS = ["linux", "windows", "macos", "android", "ios"];
const HOST = { linux: "linux", win32: "windows", darwin: "macos" }[process.platform];

const platform = process.argv[2] || HOST;
if (!PLATFORMS.includes(platform)) {
	throw new Error(`flavor-config: unknown target platform "${platform}" (expected ${PLATFORMS.join(", ")})`);
}

const env = (name) => (process.env[name] || "").trim();
const tauriDir = new URL("../src-tauri/", import.meta.url);
const readJson = (url) => JSON.parse(readFileSync(url, "utf8"));
const conf = readJson(new URL("tauri.conf.json", tauriDir));
const platformConfUrl = new URL(`tauri.${platform}.conf.json`, tauriDir);
const platformConf = existsSync(platformConfUrl) ? readJson(platformConfUrl) : {};
const flavor = loadFlavor();

// 1. Identity
const windows = platformConf.app?.windows ?? conf.app.windows;
const patch = {
	productName: flavor.appName,
	// Android: the identifier is the Kotlin package Tauri generates code into
	// (src-tauri/gen/android), the same for every flavor. The app's real ID
	// there is the Gradle applicationId, set from the manifest's
	// android.applicationId by build.gradle.kts.
	...(platform === "android" ? {} : { identifier: flavor.identifier }),
	app: {
		windows: windows.map((w) => ({ ...w, title: flavor.appName, userAgent: flavor.userAgent })),
	},
	plugins: {
		hotswap: { endpoint: flavor.ota.endpoint, pubkey: flavor.ota.pubkey },
	},
};
// The Rust side picks its backend by cargo feature (src-tauri/Cargo.toml).
if (flavor.id === "server") {
	patch.build = { features: ["flavor-server"] };
}
if (flavor.windows?.wixUpgradeCode) {
	patch.bundle = { windows: { wix: { upgradeCode: flavor.windows.wixUpgradeCode } } };
}

// 2a. LiveKit: WebSocket plus the same host over HTTPS (LiveKit uses it to
// diagnose failed connections).
const rtc = env("FG_RTC_URL").split(/[\s,]+/).filter(Boolean);
if (rtc.length) {
	const extra = [];
	for (const origin of rtc) {
		const url = new URL(origin);
		if (url.protocol !== "wss:" && url.protocol !== "ws:") throw new Error(`FG_RTC_URL: expected wss:// (or ws:// for local tests), got ${origin}`);
		extra.push(`${url.protocol}//${url.host}`, `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`);
	}
	const csp = conf.app.security.csp;
	const connect = [...new Set([...csp["connect-src"].split(" "), ...extra])].join(" ");
	patch.app.security = { csp: { ...csp, "connect-src": connect } };
}

// 3. Capabilities. Listing them replaces auto-discovery, so once anything
// changes, every file is listed: as is (by identifier), or inline when it
// names the app's own folders (src-tauri/capabilities is written for the
// grindr flavor: Downloads/FreeGrind, free-grind-data-*.zip), rewritten for
// this flavor under its own identifier.
const capDir = new URL("../src-tauri/capabilities/", import.meta.url);
let capabilitiesChanged = false;
const capabilities = readdirSync(capDir)
	.filter((f) => f.endsWith(".json"))
	.map((f) => {
		const text = readFileSync(new URL(f, capDir), "utf8");
		const rewritten = text
			.replaceAll("/FreeGrind", `/${flavor.folderName}`)
			.replaceAll("/free-grind-data-", `/${flavor.appSlug}-data-`);
		const capability = JSON.parse(rewritten);
		if (rewritten === text) return capability.identifier;
		capabilitiesChanged = true;
		return { ...capability, identifier: `${capability.identifier}-${flavor.id}` };
	});

// 2b. Media host for the frontend's HTTP plugin (chat media cache).
const media = env("FG_MEDIA_URL");
if (media) {
	const url = new URL(media);
	if (url.protocol !== "https:") throw new Error(`FG_MEDIA_URL: expected https://, got ${media}`);
	const main = readJson(new URL("default.json", capDir));
	capabilities.push({
		identifier: "free-grind-media",
		description: "HTTP access to the Free Grind media host (set at build time)",
		windows: main.windows,
		permissions: [{ identifier: "http:default", allow: [{ url: `${url.origin}/*` }] }],
	});
	capabilitiesChanged = true;
}
if (capabilitiesChanged) {
	patch.app.security = { ...patch.app.security, capabilities };
}

// Binary name (Linux packages put it in /usr/bin, so two flavors need
// different ones). Unset: Tauri's default, the Cargo package name.
if (flavor.mainBinaryName) patch.mainBinaryName = flavor.mainBinaryName;

process.stdout.write(JSON.stringify(patch));
