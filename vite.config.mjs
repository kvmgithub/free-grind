import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
 * Builds other than the grindr flavor ship without the Grindr workarounds:
 * every import of src/grindr-workarounds/index.ts from outside that folder
 * resolves to stub.ts (same API, official behaviour only), so none of the
 * workaround code ends up in the bundle.
 */
function grindrWorkaroundsStub() {
	const dir = normalizePath(fileURLToPath(new URL("./src/grindr-workarounds/", import.meta.url)));
	const index = `${dir}index.ts`;
	const stub = `${dir}stub.ts`;
	return {
		name: "grindr-workarounds-stub",
		enforce: "pre",
		async resolveId(source, importer, options) {
			if (!importer || !source.includes("grindr-workarounds")) return null;
			if (normalizePath(importer).startsWith(dir)) return null;
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			return resolved && normalizePath(resolved.id) === index ? stub : null;
		},
	};
}

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [react(), tailwindcss(), ...(flavor.id === "grindr" ? [] : [grindrWorkaroundsStub()])],
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
		__GITHUB_REPO__: JSON.stringify(flavor.github),
		__REPO_URL__: JSON.stringify(flavor.repoUrl),
		__WEBSITE_URL__: JSON.stringify(flavor.websiteUrl),
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
