# ARCHITECTURE

How BypaxDPI is built. User-facing usage lives in [README.md](./README.md); the
_why_ behind decisions lives in [HISTORY.md](./HISTORY.md); terms are defined in
[GLOSSARY.md](./GLOSSARY.md).

## 1. System overview

BypaxDPI is a [Tauri v2](https://tauri.app) desktop app. Three layers:

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (WebView2)         React 19 + Vite + TypeScript      │
│  src/  — UI, engine lifecycle, settings, i18n, logs            │
└───────────────▲────────────────────────────────────────────────┘
                │  Tauri IPC (typed in src/ipc.ts)
┌───────────────▼────────────────────────────────────────────────┐
│  Backend (native)            Rust — src-tauri/                  │
│  system proxy, PAC server, admin/driver checks, tray, recovery │
└───────────────▲────────────────────────────────────────────────┘
                │  spawn (@tauri-apps/plugin-shell, sidecar)
┌───────────────▼────────────────────────────────────────────────┐
│  Engine (sidecar)            SpoofDPI (Go) — "bypax-proxy"      │
│  the actual DPI-bypassing local HTTP(S) proxy                  │
└──────────────────────────────────────────────────────────────┘
```

The frontend never does privileged work itself. It drives the Rust backend over
IPC, and the backend manages Windows system state. The DPI bypass itself is
performed by a bundled [SpoofDPI](https://github.com/xvzc/spoofdpi) binary run as
a Tauri **sidecar** (`externalBin: binaries/bypax-proxy` in
`src-tauri/tauri.conf.json`).

## 2. Frontend (`src/`)

| File | Responsibility |
| --- | --- |
| `main.tsx` | React entry; mounts `<App/>` into `#root`. |
| `App.tsx` | Main screen + the engine lifecycle: spawn/stop the sidecar, port selection & retry, auto-reconnect, system-proxy and PAC orchestration, the log panel, dialogs, first-run ISP overlay. |
| `Settings.tsx` | Settings overlay: bypass mode, chunk size, DNS list + latency benchmark, LAN sharing, automation, notifications, Npcap/driver, troubleshooting. Owns `SettingsProps`. |
| `types.ts` | **Import-free** domain vocabulary — the single source of truth for `AppConfig`, `LogEntry`, `DpiMethod`, `DnsKey`, `IspProfileId`, `SelectedIspProfile`, `UpdateConfig`, `DnsLatencies`, etc. |
| `ipc.ts` | The one typed seam over Tauri's `invoke`. Exactly one wrapper per Rust command (see §4). |
| `constants.ts` | URLs, `DNS_MAP`/`DOH_MAP`, app constants, retry delays, per-mode timeouts. Typed via `satisfies`. |
| `profiles.ts` | ISP presets, bypass modes, chunk-size options. Typed via the shared types. |
| `i18n.ts` | `tr`/`en` translation tables; exports `Translations` + `TranslationKey`. The `en` table is the canonical key set — a drift in `tr` is a compile error. |
| `vite-env.d.ts` | Ambient Vite types (asset imports, `import.meta.env`). |

**State & persistence.** User settings are an `AppConfig` persisted to
`localStorage["bypax_config"]` as plaintext JSON, validated on load (DPI method,
chunk size, DNS key are checked against their allowed sets before use). The
update path is the `UpdateConfig` overload (`updateConfig(key, value)` or
`updateConfig(patch)`), which writes back to localStorage on every change.
`selectedIspProfile` may be `"custom"` once the user hand-tunes away from a
preset (there is no `"custom"` entry in `ISP_PROFILES` — it only means "no
preset active").

**Logs.** `LogEntry`s are kept in memory only (capped at `APP.maxLogs = 100`).
A log can carry an `i18nKey` + params so the panel re-renders in the new language
when the user switches it. Sidecar stdout is stripped of ANSI escape codes
before display.

## 3. Backend (`src-tauri/`)

Rust, Tauri v2. Notable subsystems (see `src-tauri/src/lib.rs`):

- **System proxy** — set/clear the Windows system proxy + optional WinHTTP
  ("Game Mode") tunnel, via the native `windows` crate (no spawning CMD/PowerShell).
- **PAC server** — an async, connection-limited (max 50) PAC HTTP server for LAN
  devices; "stop" flips it to DIRECT mode rather than dropping connections.
- **Crash recovery** — a sentinel file marks a dirty shutdown; on next launch
  `startup_proxy_cleanup` restores networking. Zombie sidecar processes from a
  previous run are killed (`kill_zombie_sidecar`, PID persisted via `save_sidecar_pid`).
- **Driver** — detects/installs Npcap (`wpcap.dll`) for advanced (fake-packet) bypass.
- **Tray / lifecycle** — single-instance, tray tooltip, graceful quit with proxy cleanup.

## 4. IPC surface

Every Rust `#[tauri::command]` (registered in `generate_handler!`) has exactly
one typed wrapper in `src/ipc.ts`. Conventions, which the wrappers encode so the
React code never has to:

- **Argument keys are camelCase**; Tauri converts them to the snake_case Rust
  params (`enableWinhttp` → `enable_winhttp`, `proxyPort` → `proxy_port`, `dnsIp`
  → `dns_ip`, `allowLanSharing`, `enableGameMode`).
- **Response structs serialize with their Rust field names**, which are
  snake_case: `ConfigResponse { port, lan_ip, bind_address }`,
  `PacResponse { pac_port }`.

| `ipc.*` | Rust command | Returns |
| --- | --- | --- |
| `clearSystemProxy()` | `clear_system_proxy` | `void` |
| `setSystemProxy(port, enableWinhttp)` | `set_system_proxy` | `void` |
| `updateTrayTooltip(tooltip)` | `update_tray_tooltip` | `void` |
| `checkAdmin()` | `check_admin` | `boolean` |
| `checkPortOpen(port)` | `check_port_open` | `boolean` |
| `getSidecarConfig(allowLanSharing, enableGameMode)` | `get_sidecar_config` | `SidecarConfig` |
| `startPacServer(proxyPort)` | `start_pac_server` | `PacServerInfo` |
| `stopPacServer()` | `stop_pac_server` | `void` |
| `killZombieSidecar()` | `kill_zombie_sidecar` | `string` |
| `checkDnsLatency(dnsIp)` | `check_dns_latency` | `number` (ms) |
| `saveSidecarPid(pid)` | `save_sidecar_pid` | `void` |
| `startupProxyCleanup()` | `startup_proxy_cleanup` | `boolean` |
| `checkDriver()` | `check_driver` | `boolean` |
| `installDriver()` | `install_driver` | `void` |
| `quitApp()` | `quit_app` | `void` |

If the Rust surface changes, `src/ipc.ts` is the single place to update.

## 5. The engine (SpoofDPI sidecar)

The bypass engine is SpoofDPI, built from source as `bypax-proxy`. The three
bypass modes map to SpoofDPI behaviour:

| `DpiMethod` | Mode | Behaviour |
| --- | --- | --- |
| `"0"` | Turbo | SNI parsing only; lowest latency. |
| `"1"` | Balanced | HTTPS/TLS chunk split (order preserved). |
| `"2"` | Strong | Chunk split + packet disorder; optional Npcap fake-packet injection. |

**Engine abstraction is a seam, not yet an abstraction.** Today the argument
builder and lifecycle in `App.tsx` are SpoofDPI-specific. A second engine
([zapret2](https://github.com/bol-van/zapret2)) is planned — see
[ROADMAP.md](./ROADMAP.md). The intended shape is a small engine interface
(build args from `AppConfig` → spawn → parse readiness/errors) with SpoofDPI and
zapret2 as implementations.

## 6. Toolchain

This is a **Bun** project. `bun.lock` is the only committed lockfile (npm/yarn/pnpm
lockfiles are gitignored).

### TypeScript — project references

A React frontend and Bun tooling have incompatible globals (DOM vs Bun), so they
must not share one `tsconfig`. There are three:

- `tsconfig.json` — solution file; references the two below, owns no files.
- `tsconfig.app.json` — the frontend (`src/`): `DOM` libs + `react-jsx`,
  `"types": []` so no Bun/Node globals leak in. Asset/`import.meta.env` types
  come from `src/vite-env.d.ts`.
- `tsconfig.node.json` — the tooling (`vite.config.ts`, `scripts/`): `@types/bun`
  globals, no DOM.

`bun run typecheck` (`tsc --build`) checks both. Unused-symbol hygiene is left to
Biome to avoid duplicate diagnostics.

### Biome — format + lint

`biome.json`. Formatter: **tabs**, double quotes. Linter: `recommended`, with
deliberate adjustments:

- **Web a11y rules off** (`useButtonType`, `useKeyWithClickEvents`,
  `noStaticElementInteractions`, `noSvgWithoutTitle`, `noLabelWithoutControl`).
  BypaxDPI is a fixed 380×700 mouse/touch desktop control panel, not a navigable
  web page; these rules were pure noise here. Re-enable if the UI grows.
- **`useExhaustiveDependencies` → warn.** Effects deliberately use refs (not
  effect deps) to avoid re-runs and stale closures; mount-only effects are
  intentional. Kept as a warning, not silenced — see ROADMAP for the audit.
- **`noArrayIndexKey` → warn.** The index-keyed lists are static and never reordered.
- Two `dangerouslySetInnerHTML` sites (DOMPurify-sanitized) and one ANSI-strip
  regex are kept strict with justified inline `// biome-ignore` comments.

Commands: `bun run lint`, `bun run lint:fix`, `bun run format`.

### Build scripts (`scripts/`)

All Bun ESM TypeScript. `scripts/proxy.config.ts` is the single source of truth
for the sidecar build — it externalizes the SpoofDPI version, the Go entrypoint,
and computes the host **target triple** via `rustc -vV` so the sidecar is named
the way Tauri's bundler expects on any platform. Override with env:
`SPOOFDPI_VERSION`, `SPOOFDPI_CMD`, `TARGET_TRIPLE`.

| Script | What it does |
| --- | --- |
| `bun run build-proxy` | `go build` SpoofDPI from a vendored `SpoofDPI-<version>/` source tree → `spoofdpi/bypax-proxy[.exe]`, then copy. Requires Go. |
| `bun run copy-proxy` | Copy the built sidecar into `src-tauri/binaries/` under both the plain and `-<target-triple>` names Tauri expects. |
| `bun run update-proxy-icon` | PNG→ICO for the bundle/installer; stamp the sidecar `.exe` with icon + version metadata (skipped with a warning if the exe isn't built yet). |

## 7. Build & run pipeline

Prerequisites: Bun, Rust (+ Windows toolchain for a Windows build), Go, and the
SpoofDPI source extracted to `SpoofDPI-<version>/` at the repo root (gitignored).

```
bun install
bun run build-proxy        # go build → spoofdpi/ → src-tauri/binaries/
bun run tauri dev          # dev (runs `bun run dev` = vite, then the Rust app)
# or a release bundle:
bun run tauri build        # runs beforeBuildCommand = `bun run build`
                           # (update-proxy-icon + vite build), then Rust + NSIS/MSI
```

`bun run build` = `update-proxy-icon && vite build`. `tauri.conf.json` points
`beforeDevCommand`/`beforeBuildCommand` at Bun (not npm).

## 8. Cross-platform status

Windows-only today (system-proxy + driver code is Windows-specific; SpoofDPI for
Windows is built from source since upstream ships no Windows binary). The build
scripts are already target-triple aware to make the eventual macOS/Linux port
cheaper. See [ROADMAP.md](./ROADMAP.md).
