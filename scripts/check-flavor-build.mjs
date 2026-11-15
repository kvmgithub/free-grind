// Checks that a build of a flavor other than grindr contains none of the
// Grindr workarounds: no workaround code in the frontend bundle, none of their
// texts, and no Honduras bypass in the Rust binary.
//
//   bun scripts/check-flavor-build.mjs <dist dir> [<app binary or bundle> …]
//
// Fails (exit 1) with every hit listed. For the grindr flavor it does nothing.
// Run it in the server flavor's release CI after the build, so "workarounds
// stay out" is checked on the actual artifacts instead of assumed.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { flavorId } from "./flavor.mjs";

// Strings only the workaround code (src/grindr-workarounds,
// src-tauri/src/api/entitlements.rs) and its texts (locales/*/grindr.json)
// contain.
const FRONTEND_MARKERS = ["enter_honduras", "restore_stranded_location", "entitlement_bypass", "location_finder", "Honduras"];
const BINARY_MARKERS = ["honduras-hold.data", "[entitlements]"];

if (flavorId() === "grindr") {
	console.log("check-flavor-build: grindr flavor, nothing to check");
	process.exit(0);
}

const [dist, ...binaries] = process.argv.slice(2);
if (!dist || !existsSync(dist)) {
	console.error("usage: bun scripts/check-flavor-build.mjs <dist dir> [<app binary or bundle> …]");
	process.exit(2);
}

function* files(target) {
	if (statSync(target).isDirectory()) {
		for (const entry of readdirSync(target)) yield* files(path.join(target, entry));
	} else {
		yield target;
	}
}

const hits = [];
function scan(target, markers) {
	for (const file of files(target)) {
		if (path.basename(file) === "grindr.json") hits.push(`${file}: workaround texts (grindr.json)`);
		const bytes = readFileSync(file);
		for (const marker of markers) {
			if (bytes.includes(marker)) hits.push(`${file}: "${marker}"`);
		}
	}
}

scan(dist, FRONTEND_MARKERS);
for (const binary of binaries) scan(binary, BINARY_MARKERS);

if (hits.length) {
	console.error(`check-flavor-build: Grindr workaround traces in a ${flavorId()} build:`);
	for (const hit of hits) console.error(`  ${hit}`);
	process.exit(1);
}
console.log(`check-flavor-build: ${flavorId()} build is clean (${dist}${binaries.length ? `, ${binaries.join(", ")}` : ""})`);
