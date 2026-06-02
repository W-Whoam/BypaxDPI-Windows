#!/usr/bin/env bun
/**
 * Brand the Windows build artifacts:
 *   1. Convert `public/bypax-engine.png` and `public/uninstall.png` to `.ico`
 *      for the Tauri/NSIS bundle (cross-platform — pure JS).
 *   2. Stamp the SpoofDPI sidecar `.exe` with the BypaxDPI icon + version
 *      metadata via rcedit (Windows-native; uses Wine elsewhere).
 *
 * Run by `bun run update-proxy-icon`, which `bun run build` invokes before the
 * Vite build. The sidecar stamping is skipped (with a warning) when the `.exe`
 * has not been built yet, so a frontend-only build never hard-fails.
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pngToIco from "png-to-ico";
import { rcedit } from "rcedit";
import { ROOT, resolveTarget, sidecarPaths } from "./proxy.config";

const ICONS_DIR = join(ROOT, "src-tauri", "icons");
const PUBLIC_DIR = join(ROOT, "public");

/** PNG → ICO conversions needed by the bundle/installer. */
const ICONS: ReadonlyArray<{ readonly png: string; readonly ico: string }> = [
	{ png: "bypax-engine.png", ico: "bypax-engine.ico" },
	{ png: "uninstall.png", ico: "uninstall.ico" },
];

async function convertIcons(): Promise<void> {
	for (const { png, ico } of ICONS) {
		const src = join(PUBLIC_DIR, png);
		const dest = join(ICONS_DIR, ico);
		console.log(`Converting ${png} → ${ico}`);
		const buf = await pngToIco(src);
		writeFileSync(dest, buf);
	}
}

async function stampSidecar(): Promise<void> {
	const exePath = sidecarPaths(resolveTarget()).triple;
	if (!existsSync(exePath)) {
		console.warn(
			`⚠ Sidecar not found at ${exePath} — skipping icon/metadata stamp. ` +
				`Run "bun run build-proxy" first to brand the executable.`,
		);
		return;
	}
	const icon = join(ICONS_DIR, "bypax-engine.ico");
	console.log(`Stamping ${exePath}`);
	await rcedit(exePath, {
		icon,
		"version-string": {
			ProductName: "BypaxDPI",
			FileDescription: "BypaxDPI Service",
			CompanyName: "ConsolAktif",
			LegalCopyright: "Copyright © 2026 ConsolAktif",
		},
	});
	console.log("Icon + metadata updated.");
}

await convertIcons();
await stampSidecar();
