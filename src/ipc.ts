// ============================================================
// BypaxDPI — Typed IPC boundary
//
// The single typed seam over Tauri's stringly-typed `invoke`. Every Rust
// command in `src-tauri/src/lib.rs` (`generate_handler!`) has exactly one
// wrapper here, so the React code never spells a command name or guesses a
// return type. If the Rust surface changes, this file is the one place to fix.
//
// Conventions (do not "fix" without checking the Rust side):
//   - Argument keys are camelCase; Tauri converts them to the snake_case Rust
//     params (e.g. `enableWinhttp` → `enable_winhttp`).
//   - Response structs are serialized with their Rust field names, which are
//     snake_case (`bind_address`, `pac_port`) — kept verbatim below.
// ============================================================
import { invoke } from "@tauri-apps/api/core";

/** Result of {@link ipc.getSidecarConfig} (Rust `ConfigResponse`). */
export type SidecarConfig = {
	readonly port: number;
	readonly lan_ip: string;
	readonly bind_address: string;
};

/** Result of {@link ipc.startPacServer} (Rust `PacResponse`). */
export type PacServerInfo = {
	readonly pac_port: number;
};

export const ipc = {
	/** Remove the system HTTP(S) proxy + WinHTTP settings. */
	clearSystemProxy: () => invoke<void>("clear_system_proxy"),

	/** Point the system proxy at 127.0.0.1:`port`; optionally tunnel WinHTTP. */
	setSystemProxy: (port: number, enableWinhttp: boolean) =>
		invoke<void>("set_system_proxy", { port, enableWinhttp }),

	/** Update the tray icon tooltip text. */
	updateTrayTooltip: (tooltip: string) =>
		invoke<void>("update_tray_tooltip", { tooltip }),

	/** Whether the process is running elevated (admin). */
	checkAdmin: () => invoke<boolean>("check_admin"),

	/** Whether a TCP listener is already accepting on `port` (port-in-use probe). */
	checkPortOpen: (port: number) => invoke<boolean>("check_port_open", { port }),

	/** Resolve the bind address/port the sidecar should use for this config. */
	getSidecarConfig: (allowLanSharing: boolean, enableGameMode: boolean) =>
		invoke<SidecarConfig>("get_sidecar_config", {
			allowLanSharing,
			enableGameMode,
		}),

	/** Start (or re-point) the PAC server for LAN devices; returns its port. */
	startPacServer: (proxyPort: number) =>
		invoke<PacServerInfo>("start_pac_server", { proxyPort }),

	/** Switch the PAC server to DIRECT mode (graceful "stop" without dropping LAN). */
	stopPacServer: () => invoke<void>("stop_pac_server"),

	/** Kill orphaned bypax-proxy processes left by a previous run. */
	killZombieSidecar: () => invoke<string>("kill_zombie_sidecar"),

	/** Round-trip latency (ms) to a known DNS resolver IP. */
	checkDnsLatency: (dnsIp: string) =>
		invoke<number>("check_dns_latency", { dnsIp }),

	/** Persist the sidecar PID so a later run can clean it up if we crash. */
	saveSidecarPid: (pid: number) => invoke<void>("save_sidecar_pid", { pid }),

	/** Clean orphaned proxy settings after a dirty shutdown; true if it cleaned. */
	startupProxyCleanup: () => invoke<boolean>("startup_proxy_cleanup"),

	/** Whether the Npcap/WinPcap driver (wpcap.dll) is installed. */
	checkDriver: () => invoke<boolean>("check_driver"),

	/** Launch the bundled Npcap installer. */
	installDriver: () => invoke<void>("install_driver"),

	/** Run the full app-exit cleanup and quit. */
	quitApp: () => invoke<void>("quit_app"),
} as const;
