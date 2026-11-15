import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFlavor } from "./scripts/flavor.mjs";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const packageJsonPath = fileURLToPath(new URL("./package.json", import.meta.url));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const appVersion = packageJson.version ?? "0.0.0";

// Short commit the frontend was built from, shown next to the version in
// Settings. Always read from git (not CI env), so a rebuild of the same commit
// bakes in the same string and stays reproducible. Empty outside a checkout.
function shortCommitHash() {
	try {
		return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
	} catch {
		return "";
	}
}
const commitHash = shortCommitHash();

// App identity of the flavor being built (FG_FLAVOR, default grindr).
const flavor = loadFlavor();

/**
 * Builds other than the grindr flavor ship without anything that works around
 * or poses as Grindr. Each module below resolves to a stand-in with the same
 * API (a *.check.ts next to it keeps them in sync) for every import from
 * outside its own folder, so the original never ends up in the bundle:
 *  - src/grindr-workarounds/index.ts → stub.ts (official behaviour only)
 *  - src/services/recaptcha.ts → recaptcha.unavailable.ts (no token minting)
 * The workarounds' texts (the "grindr" i18next namespace,
 * public/locales/<locale>/grindr.json) are left out of the output too.
 */
function withoutGrindrWorkarounds() {
	const src = (file) => normalizePath(fileURLToPath(new URL(`./src/${file}`, import.meta.url)));
	const swaps = [
		// Files inside grindr-workarounds/ keep their real siblings.
		{ original: src("grindr-workarounds/index.ts"), standIn: src("grindr-workarounds/stub.ts"), keepWithin: src("grindr-workarounds/") },
		{ original: src("services/recaptcha.ts"), standIn: src("services/recaptcha.unavailable.ts") },
	];
	let outDir = "";
	return {
		name: "without-grindr-workarounds",
		enforce: "pre",
		configResolved(config) {
			outDir = path.resolve(config.root, config.build.outDir);
		},
		async resolveId(source, importer, options) {
			if (!importer || !/grindr-workarounds|recaptcha/.test(source)) return null;
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			if (!resolved) return null;
			const swap = swaps.find(({ original }) => normalizePath(resolved.id) === original);
			if (!swap || (swap.keepWithin && normalizePath(importer).startsWith(swap.keepWithin))) return null;
			return swap.standIn;
		},
		closeBundle() {
			const locales = path.join(outDir, "locales");
			if (!existsSync(locales)) return;
			for (const locale of readdirSync(locales)) rmSync(path.join(locales, locale, "grindr.json"), { force: true });
		},
	};
}

/** `%APP_NAME%` in index.html: the flavor's app name. */
function appNameInHtml() {
	const escaped = flavor.appName.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
	return {
		name: "app-name-in-html",
		transformIndexHtml: (html) => html.replaceAll("%APP_NAME%", escaped),
	};
}

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [react(), tailwindcss(), appNameInHtml(), ...(flavor.id === "grindr" ? [] : [withoutGrindrWorkarounds()])],
	// Release builds (ci/build) must not pick up local .env files.
	// @ts-expect-error process is a nodejs global
	envDir: process.env.FG_REPRODUCIBLE_BUILD ? false : undefined,
	define: {
		"import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
		"import.meta.env.VITE_COMMIT_HASH": JSON.stringify(commitHash),
		__FLAVOR__: JSON.stringify(flavor.id),
		__APP_NAME__: JSON.stringify(flavor.appName),
		__APP_SLUG__: JSON.stringify(flavor.appSlug),
		__APP_FOLDER__: JSON.stringify(flavor.folderName),
		// Main binary name (Tauri default: the Cargo package name).
		__APP_BINARY__: JSON.stringify(flavor.mainBinaryName ?? "free-grind"),
		__GITHUB_REPO__: JSON.stringify(flavor.github),
		__REPO_URL__: JSON.stringify(flavor.repoUrl),
		__WEBSITE_URL__: JSON.stringify(flavor.websiteUrl),
		// Release feed and page when releases aren't on GitHub (manifest updates).
		__RELEASES_FEED_URL__: JSON.stringify(flavor.updates?.feedUrl ?? ""),
		__RELEASES_PAGE_URL__: JSON.stringify(flavor.updates?.pageUrl ?? ""),
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
		target: "chrome69",
		cssTarget: "chrome69",
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (
						id.includes("/node_modules/react/") ||
						id.includes("/node_modules/react-dom/") ||
						id.includes("/node_modules/scheduler/")
					) {
						return "vendor-react";
					}
					if (
						id.includes("/node_modules/react-router") ||
						id.includes("/node_modules/@remix-run/")
					) {
						return "vendor-router";
					}
					if (
						id.includes("/node_modules/leaflet/") ||
						id.includes("/node_modules/react-leaflet/")
					) {
						return "vendor-map";
					}
					if (id.includes("/node_modules/@tauri-apps/")) {
						return "vendor-tauri";
					}
					if (
						id.includes("/node_modules/zod/") ||
						id.includes("/node_modules/@msgpack/")
					) {
						return "vendor-data";
					}
				},
			},
		},
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent Vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1420,
				}
			: undefined,
		watch: {
			// 3. tell Vite to ignore watching `src-tauri`
			ignored: ["**/src-tauri/**"],
		},
	},
}));
