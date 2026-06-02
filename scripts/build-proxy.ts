#!/usr/bin/env bun
/**
 * Build SpoofDPI (the "bypax-proxy" sidecar) from a vendored source tree and
 * copy the result into `src-tauri/binaries/`. Requires Go on PATH.
 *
 * Version, Go entrypoint and target naming come from {@link ./proxy.config}.
 * Override with env: `SPOOFDPI_VERSION`, `SPOOFDPI_CMD`, `TARGET_TRIPLE`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
	GO_BUILD_PATH,
	GO_LDFLAGS,
	ROOT,
	resolveTarget,
	SPOOFDPI_OUT_DIR,
	SPOOFDPI_REPO,
	SPOOFDPI_VERSION,
	sidecarPaths,
} from "./proxy.config";

/** Locate the vendored SpoofDPI source dir (the one containing `go.mod`). */
function findSource(): string | null {
	const candidates = [
		join(ROOT, `SpoofDPI-${SPOOFDPI_VERSION}`),
		// GitHub source zips nest the dir one level deep.
		join(ROOT, `SpoofDPI-${SPOOFDPI_VERSION}`, `SpoofDPI-${SPOOFDPI_VERSION}`),
		join(ROOT, `spoofdpi-${SPOOFDPI_VERSION}`),
	];
	for (const dir of candidates) {
		if (existsSync(join(dir, "go.mod"))) return dir;
	}
	// Fallback: any SpoofDPI*/ dir at the root that holds a go.mod (or nests one).
	for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
		if (!entry.isDirectory() || !/^spoofdpi/i.test(entry.name)) continue;
		const dir = join(ROOT, entry.name);
		if (existsSync(join(dir, "go.mod"))) return dir;
		const nested = join(dir, entry.name);
		if (existsSync(join(nested, "go.mod"))) return nested;
	}
	return null;
}

const sourceDir = findSource();
if (!sourceDir) {
	console.error(
		`SpoofDPI ${SPOOFDPI_VERSION} source not found.\n` +
			`Download it from ${SPOOFDPI_REPO}/releases/tag/v${SPOOFDPI_VERSION} ` +
			`and extract it to SpoofDPI-${SPOOFDPI_VERSION}/ at the repo root.`,
	);
	process.exit(1);
}

const { built } = sidecarPaths(resolveTarget());
mkdirSync(SPOOFDPI_OUT_DIR, { recursive: true });

console.log(`Building SpoofDPI ${SPOOFDPI_VERSION} → ${built}`);
const go = spawnSync(
	"go",
	["build", "-trimpath", `-ldflags=${GO_LDFLAGS}`, "-o", built, GO_BUILD_PATH],
	{ cwd: sourceDir, stdio: "inherit", shell: true },
);
if (go.status !== 0) {
	console.error("go build failed");
	process.exit(go.status ?? 1);
}

console.log("Build OK. Copying sidecar into src-tauri/binaries/ ...");
const copy = spawnSync("bun", [join(import.meta.dir, "copy-proxy.ts")], {
	cwd: ROOT,
	stdio: "inherit",
});
process.exit(copy.status ?? 0);
