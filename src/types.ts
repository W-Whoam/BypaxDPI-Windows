// ============================================================
// BypaxDPI — Shared domain types
//
// The single vocabulary the frontend speaks. Kept import-free on purpose: this
// is the leaf every other module depends on. `constants.ts` / `profiles.ts`
// attach these types to their data with `satisfies` so the literals and the
// types can never drift apart.
// ============================================================

/** UI / app language. Mirrors {@link SUPPORTED_LANGUAGES} in `i18n.ts`. */
export type Language = "tr" | "en";

/**
 * DPI bypass strength, passed to the SpoofDPI sidecar.
 * `"0"` Turbo · `"1"` Balanced · `"2"` Strong. String-typed because it is also
 * a localStorage value and a sidecar CLI argument.
 */
export type DpiMethod = "0" | "1" | "2";

/** DNS selection strategy: pick a fixed server (`manual`) or auto-benchmark. */
export type DnsMode = "manual" | "auto";

/** Keys of {@link DNS_MAP}/{@link DOH_MAP} in `constants.ts`. `"system"` = OS default. */
export type DnsKey =
	| "system"
	| "cloudflare"
	| "adguard"
	| "google"
	| "quad9"
	| "opendns";

/** ISP preset chosen in the first-run overlay / settings guide. */
export type IspProfileId = "light" | "mid" | "heavy" | "other";

/** Severity of a line in the in-app log panel. */
export type LogType = "info" | "success" | "error" | "warn";

/**
 * Optional metadata attached when emitting a log line. Storing the i18n key +
 * params (not just the rendered string) lets the log panel re-render in the
 * new language when the user switches it.
 */
export type LogMeta = {
	readonly i18nKey?: string;
	readonly i18nParams?: readonly unknown[];
};

/** A rendered, stored log entry shown in the log panel. */
export type LogEntry = {
	readonly id: string;
	readonly time: string;
	readonly msg: string;
	readonly type: LogType;
	/** Source i18n key, or null for raw/sidecar messages. */
	readonly i18nKey: string | null;
	readonly i18nParams: readonly unknown[] | null;
};

/**
 * Persisted user settings (localStorage key `bypax_config`).
 *
 * The first group is always present (see `defaultSettings` in `App.tsx`). The
 * optional group is written lazily by the settings toggles, so reads must
 * tolerate `undefined` — hence the `?`. Defaults applied at read time:
 * `enableWinhttp` true, `lanSharing` false, the rest false unless noted.
 */
export type AppConfig = {
	language: Language;
	autoStart: boolean;
	autoConnect: boolean;
	minimizeToTray: boolean;
	dnsMode: DnsMode;
	selectedDns: DnsKey;
	autoReconnect: boolean;
	dpiMethod: DpiMethod;
	httpsChunkSize: number;
	ipv4Only: boolean;
	selectedIspProfile: IspProfileId;

	lanSharing?: boolean;
	/** Game Mode (WinHTTP proxy). Defaults to true (`!== false`). */
	enableWinhttp?: boolean;
	/** Npcap-backed fake-packet injection. */
	advancedBypass?: boolean;
	alwaysOnTop?: boolean;
	requireConfirmation?: boolean;
	notifications?: boolean;
	notifyOnConnect?: boolean;
	notifyOnDisconnect?: boolean;
};

/**
 * Updater for {@link AppConfig}, shared by App (owner) and Settings (consumer).
 * Either set one key, or merge a partial patch — both persist to localStorage.
 */
export type UpdateConfig = {
	<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void;
	(patch: Partial<AppConfig>): void;
};

/** Measured DNS round-trip latencies (ms), keyed by resolver. `system` excluded. */
export type DnsLatencies = Partial<Record<DnsKey, number>>;

/** A selectable ISP preset (first-run overlay + settings guide). */
export type IspProfile = {
	readonly id: IspProfileId;
	readonly mode: DpiMethod;
	readonly chunk: number;
	readonly color: string;
	readonly bg: string;
	readonly icon: string;
	/** Imported ISP logo URLs (Vite asset imports). */
	readonly logos: readonly string[];
};

/** A bypass-mode card in Settings (drives the engine argument builder). */
export type BypassMode = {
	readonly id: DpiMethod;
	readonly color: string;
	readonly activeBg: string;
	readonly iconBg: string;
	readonly iconClass: string;
	/** lucide-react icon component name. */
	readonly iconName: string;
	readonly hasChunkSize: boolean;
	readonly hasNpcap: boolean;
};

/** A chunk-size choice in the Advanced selector. */
export type ChunkSizeOption = {
	readonly value: number;
	readonly label: string;
};
