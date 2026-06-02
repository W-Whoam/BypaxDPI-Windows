#!/usr/bin/env bun
/**
 * Copy the built SpoofDPI sidecar from `spoofdpi/` into `src-tauri/binaries/`
 * under both the plain and target-triple-suffixed names Tauri expects (dev +
 * bundle). Run standalone with `bun run copy-proxy`, or implicitly via
 * `bun run build-proxy`.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import {
	BINARIES_DIR,
	resolveTarget,
	SIDECAR_NAME,
	sidecarPaths,
} from "./proxy.config";

const target = resolveTarget();
const { built, plain, triple } = sidecarPaths(target);

if (!existsSync(built)) {
	console.error(`${built} not found. Build it first: bun run build-proxy`);
	process.exit(1);
}

mkdirSync(BINARIES_DIR, { recursive: true });
copyFileSync(built, plain);
copyFileSync(built, triple);
console.log(`Copied ${SIDECAR_NAME} → ${plain} and ${triple}`);
