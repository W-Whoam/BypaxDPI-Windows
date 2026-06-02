// ============================================================
// BypaxDPI — Persisted state (localStorage)
//
// The one place that touches localStorage. Owns the storage keys, the factory
// defaults, and the load-time validation that hardens settings before they
// become sidecar CLI arguments. Keeping this out of the components means the
// keys and the validation can't drift across call sites.
// ============================================================
import type { AppConfig } from "./types";

const CONFIG_KEY = "bypax_config";
const FIRST_RUN_KEY = "bypax_first_run_done";

/** Factory defaults — the always-present {@link AppConfig} keys. Optional toggles
 * are applied at read time by the components (`enableWinhttp` true, the rest false). */
export const DEFAULT_CONFIG: AppConfig = {
	language: "tr",
	autoStart: false,
	autoConnect: false,
	minimizeToTray: false,
	dnsMode: "manual",
	selectedDns: "cloudflare",
	autoReconnect: true,
	dpiMethod: "2",
	httpsChunkSize: 1,
	ipv4Only: true,
	selectedIspProfile: "heavy",
};

const VALID_DPI_METHODS = ["0", "1", "2"];
const VALID_CHUNK_SIZES = [1, 2, 4, 8, 16, 32, 64, 128];

/**
 * Load and validate persisted settings.
 *
 * Tolerates legacy base64-obfuscated configs (older builds), and re-validates
 * the security-relevant fields (`dpiMethod`, `httpsChunkSize`, `selectedDns`)
 * against their allowed sets — these flow into sidecar CLI args, so a tampered
 * localStorage value must not become an injected argument.
 */
export function loadConfig(): AppConfig {
	const saved = localStorage.getItem(CONFIG_KEY);
	if (!saved) return DEFAULT_CONFIG;
	try {
		// Backward compat: older builds base64-obfuscated the config.
		let parsedStr = saved;
		if (!saved.startsWith("{")) {
			parsedStr = decodeURIComponent(escape(atob(saved)));
		}
		const parsed: Record<string, unknown> = JSON.parse(parsedStr);
		if (typeof parsed !== "object" || parsed === null) return DEFAULT_CONFIG;

		// Validated against the literal sets, so the narrowing casts are safe.
		return {
			...DEFAULT_CONFIG,
			...parsed,
			dpiMethod: VALID_DPI_METHODS.includes(String(parsed.dpiMethod))
				? (String(parsed.dpiMethod) as AppConfig["dpiMethod"])
				: DEFAULT_CONFIG.dpiMethod,
			httpsChunkSize: VALID_CHUNK_SIZES.includes(Number(parsed.httpsChunkSize))
				? Number(parsed.httpsChunkSize)
				: DEFAULT_CONFIG.httpsChunkSize,
			selectedDns:
				typeof parsed.selectedDns === "string"
					? (parsed.selectedDns as AppConfig["selectedDns"])
					: DEFAULT_CONFIG.selectedDns,
		} as AppConfig;
	} catch (e) {
		console.error("Failed to parse config:", e);
		return DEFAULT_CONFIG;
	}
}

/** Persist settings as plaintext JSON (re-validated on next {@link loadConfig}). */
export function saveConfig(config: AppConfig): void {
	localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/** Whether the first-run ISP overlay has already been completed/skipped. */
export function isFirstRunDone(): boolean {
	return localStorage.getItem(FIRST_RUN_KEY) !== null;
}

/** Mark the first-run ISP overlay as completed so it never shows again. */
export function markFirstRunDone(): void {
	localStorage.setItem(FIRST_RUN_KEY, "true");
}
