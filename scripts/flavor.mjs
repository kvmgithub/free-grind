// Loads the app flavor selected by FG_FLAVOR (default: grindr).
//
//   grindr → flavors/grindr/flavor.json   (this repository)
//   server → server/app-flavor/flavor.json (the private server repository,
//            checked out at server/; it is not part of this repository)
//
// The manifest is the single source of the app's identity: name, IDs, update
// endpoints and links. scripts/flavor-config.mjs turns it into the Tauri
// config patch, vite.config.mjs into build-time constants (__APP_NAME__ …).
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

const FLAVOR_DIRS = {
	grindr: "flavors/grindr/",
	server: "server/app-flavor/",
};

const REQUIRED = ["appName", "appSlug", "folderName", "identifier", "userAgent", "repository", "websiteUrl", "ota.endpoint", "ota.pubkey", "android.applicationId", "ios.bundleId"];

/**
 * The source repository's web URL (GitLab, also self-hosted, or GitHub): its
 * forge, path and API base, for the app's links, release lookups and commit
 * comparisons.
 */
function repository(url, file) {
	const m = /^https:\/\/([^/]+)\/([\w.-]+(?:\/[\w.-]+)+)\/?$/.exec(url);
	if (!m) throw new Error(`${file}: repository must be the repository's https URL, e.g. https://gitlab.com/group/project`);
	const [, host, path] = m;
	const forge = host === "github.com" ? "github" : "gitlab";
	return {
		repoUrl: `https://${host}/${path}`,
		repoForge: forge,
		repoPath: path,
		repoApiUrl:
			forge === "github" ? `https://api.github.com/repos/${path}` : `https://${host}/api/v4/projects/${encodeURIComponent(path)}`,
	};
}

function get(obj, path) {
	return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

export function flavorId() {
	const id = (process.env.FG_FLAVOR || "grindr").trim();
	if (!Object.hasOwn(FLAVOR_DIRS, id)) {
		throw new Error(`FG_FLAVOR: unknown flavor "${id}" (expected ${Object.keys(FLAVOR_DIRS).join(" or ")})`);
	}
	return id;
}

/** Absolute path of the selected flavor's directory (with trailing slash). */
export function flavorDir(id = flavorId()) {
	return fileURLToPath(new URL(FLAVOR_DIRS[id], root));
}

export function loadFlavor(id = flavorId()) {
	const file = new URL(`${FLAVOR_DIRS[id]}flavor.json`, root);
	if (!existsSync(file)) {
		const hint = id === "server" ? " The server flavor lives in the private server repository; check it out at server/." : "";
		throw new Error(`FG_FLAVOR=${id}: ${fileURLToPath(file)} not found.${hint}`);
	}
	const flavor = JSON.parse(readFileSync(file, "utf8"));
	const missing = REQUIRED.filter((key) => {
		const value = get(flavor, key);
		return typeof value !== "string" || !value.trim();
	});
	if (missing.length) throw new Error(`${fileURLToPath(file)}: missing ${missing.join(", ")}`);
	if (flavor.id !== id) throw new Error(`${fileURLToPath(file)}: id is "${flavor.id}", expected "${id}"`);
	if (!/^[a-z0-9-]+$/.test(flavor.appSlug)) throw new Error(`${fileURLToPath(file)}: appSlug must be lowercase letters, digits and dashes`);
	return { ...flavor, ...repository(flavor.repository, fileURLToPath(file)) };
}
