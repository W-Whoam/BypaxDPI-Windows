/**
 * Single source of truth for the SpoofDPI ("bypax-proxy") sidecar build.
 *
 * Everything that varies — upstream version, the Go entrypoint, the output
 * naming, the host target triple — lives here so the build/copy/icon scripts
 * never hardcode it. Override at the command line with env vars where noted.
 *
 * Upstream: {@link https://github.com/xvzc/spoofdpi}
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/** Pinned upstream SpoofDPI release (no leading `v`). Override: `SPOOFDPI_VERSION`. */
export const SPOOFDPI_VERSION: string = process.env.SPOOFDPI_VERSION ?? "1.5.3";

/** Upstream repository, used in build error messages and docs. */
export const SPOOFDPI_REPO = "https://github.com/xvzc/spoofdpi";

/**
 * Logical sidecar name. Must match `bundle.externalBin` in
 * {@link ../src-tauri/tauri.conf.json} (`binaries/bypax-proxy`).
 */
export const SIDECAR_NAME = "bypax-proxy";

/** Go entrypoint inside the SpoofDPI source tree. Override: `SPOOFDPI_CMD`. */
export const GO_BUILD_PATH: string =
	process.env.SPOOFDPI_CMD ?? "./cmd/spoofdpi";

/** Release linker flags: strip symbol table + DWARF for a smaller binary. */
export const GO_LDFLAGS = "-s -w";

/** Repo root (this file lives in `scripts/`). */
export const ROOT: string = join(import.meta.dir, "..");

/** Where the freshly built sidecar lands before it is copied into the bundle. */
export const SPOOFDPI_OUT_DIR: string = join(ROOT, "spoofdpi");

/** Tauri picks the sidecar up from here (plain + target-triple-suffixed). */
export const BINARIES_DIR: string = join(ROOT, "src-tauri", "binaries");

/** Host platform info needed to name the sidecar the way Tauri's bundler expects. */
export type TargetInfo = {
	/** Rust target triple, e.g. `x86_64-pc-windows-msvc`. */
	readonly triple: string;
	/** Executable extension for the platform: `".exe"` on Windows, else `""`. */
	readonly exeExt: string;
	readonly isWindows: boolean;
};

/**
 * Resolve the host Rust target triple so the sidecar can be named correctly on
 * any platform (the app is Windows-only today but is moving cross-platform).
 *
 * Resolution order: env `TARGET_TRIPLE` → `rustc -vV` host line → Windows MSVC
 * default (the target the project currently ships).
 */
export function resolveTarget(): TargetInfo {
	const triple = detectTriple();
	const isWindows = triple.includes("windows");
	return { triple, exeExt: isWindows ? ".exe" : "", isWindows };
}

function detectTriple(): string {
	if (process.env.TARGET_TRIPLE) return process.env.TARGET_TRIPLE;
	try {
		const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
		const host = out.split("\n").find((line) => line.startsWith("host:"));
		if (host) return host.slice("host:".length).trim();
	} catch {
		// rustc not on PATH — fall through to the shipped default.
	}
	return "x86_64-pc-windows-msvc";
}

/** Absolute paths for the built sidecar and its two destinations in the bundle. */
export function sidecarPaths(target: TargetInfo = resolveTarget()): {
	readonly built: string;
	readonly plain: string;
	readonly triple: string;
} {
	return {
		built: join(SPOOFDPI_OUT_DIR, `${SIDECAR_NAME}${target.exeExt}`),
		plain: join(BINARIES_DIR, `${SIDECAR_NAME}${target.exeExt}`),
		triple: join(
			BINARIES_DIR,
			`${SIDECAR_NAME}-${target.triple}${target.exeExt}`,
		),
	};
}
