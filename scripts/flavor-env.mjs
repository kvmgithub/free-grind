// Prints the app flavor (FG_FLAVOR, see scripts/flavor.mjs) as shell
// assignments for the build scripts:
//
//   eval "$(bun scripts/flavor-env.mjs)"
//
// Always: FG_FLAVOR, FG_APP_NAME, FG_APP_SLUG, FG_APP_BINARY (main binary
// name), FG_APP_REPO_URL.
//
// Plus the build variables in the manifest's optional "env" object, e.g. the
// server flavor's FG_API_URL / FG_MEDIA_URL / FG_RTC_URL / FG_FCM_*. A
// variable that's already set in the environment wins, so a local build can
// point the same flavor at a dev server. Only FG_* names are accepted.
import { flavorId, loadFlavor } from "./flavor.mjs";

const quote = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;
const flavor = loadFlavor();
const lines = [];
const assign = (name, value) => lines.push(`${name}=${quote(value)}; export ${name}`);

assign("FG_FLAVOR", flavorId());
assign("FG_APP_NAME", flavor.appName);
assign("FG_APP_SLUG", flavor.appSlug);
// Tauri's default binary name is the Cargo package name.
assign("FG_APP_BINARY", flavor.mainBinaryName ?? "free-grind");
assign("FG_APP_REPO_URL", flavor.repoUrl);

for (const [name, value] of Object.entries(flavor.env ?? {})) {
	if (!/^FG_[A-Z0-9_]+$/.test(name)) throw new Error(`flavor.json env: ${name} is not an FG_* variable`);
	if (typeof value !== "string") throw new Error(`flavor.json env: ${name} must be a string`);
	if ((process.env[name] ?? "").trim()) continue;
	assign(name, value);
}

process.stdout.write(`${lines.join("\n")}\n`);
