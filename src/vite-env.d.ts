/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_APP_VERSION: string;
	readonly VITE_I18N_BASE_URL?: string;
}

// App flavor constants, set by vite.config.mjs from the flavor manifest
// (FG_FLAVOR, scripts/flavor.mjs). Literals at build time, so code behind
// `__FLAVOR__ === "…"` is dropped from the other flavor's bundle.
declare const __FLAVOR__: "grindr" | "server";
/** User-visible app name, e.g. "Free Grind". */
declare const __APP_NAME__: string;
/** Lowercase app slug, prefix of release asset names (`<slug>-v<version>.apk`). */
declare const __APP_SLUG__: string;
/** GitHub repository as "owner/repo". */
declare const __GITHUB_REPO__: string;
declare const __REPO_URL__: string;
declare const __WEBSITE_URL__: string;

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
