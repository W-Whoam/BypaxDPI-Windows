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

### Argument surface

`App.tsx` builds the sidecar's argv from the live `AppConfig` (see the builder
around `App.tsx:595`). These are **SpoofDPI v1.5.x** flags (double-dash). Older
SpoofDPI docs describe a v1.2.1 single-dash surface (`-port`, `-dns`,
`-http-chunk-size`, `-window-size`) that **no longer applies** — the build is
pinned to 1.5.3 and the args below are authoritative.

| Flag | Value | When |
| --- | --- | --- |
| `--clean` | — | always |
| `--listen-addr` | `<bind>:<port>` | always (`bind` = `0.0.0.0` for LAN/Game mode, else `127.0.0.1`) |
| `--timeout` | ms | always; per-mode from `DPI_TIMEOUTS[dpiMethod]` |
| `--silent`, `--log-level` | `info` | always |
| `--dns-qtype` | `ipv4` / `all` | `ipv4` when `ipv4Only` (default), else `all` |
| `--dns-mode` | `system` | DNS = system, or no resolver IP |
| `--dns-mode https --dns-https-url` | DoH URL | DoH resolver (URL from `DOH_MAP`) |
| `--dns-addr <ip>:53 --dns-mode udp` | — | plain-UDP resolver |
| `--https-split-mode sni` | — | mode `"0"` Turbo |
| `--https-split-mode chunk --https-chunk-size` | 1–16 | mode `"1"` Balanced (`httpsChunkSize`) |
| `--https-split-mode chunk --https-chunk-size 1` | — | mode `"2"` Strong, no driver / advanced off |
| `… --https-fake-count 3` | — | mode `"2"` Strong **with** Npcap + `advancedBypass` |

**Engine abstraction is a seam, not yet an abstraction.** Today the argument
builder and lifecycle in `App.tsx` are SpoofDPI-specific. A second engine
([zapret2](https://github.com/bol-van/zapret2)) is planned — see
[ROADMAP.md](./ROADMAP.md). The intended shape is a small engine interface
(build args from `AppConfig` → spawn → parse readiness/errors) with SpoofDPI and
zapret2 as implementations.

## 6. Connection lifecycle & recovery

**Connect** (orchestrated in `App.tsx`, privileged steps delegated to Rust):

1. Internet-reachability check.
2. Admin-rights check (`ipc.checkAdmin`) — warn if not elevated.
3. Port + safe LAN IP resolution (`ipc.getSidecarConfig`).
4. Kill any zombie sidecar from a previous run (`ipc.killZombieSidecar`).
5. Clear any leftover system proxy (`ipc.startupProxyCleanup` on launch).
6. Spawn SpoofDPI with the built args (§5).
7. Wait for the sidecar's "listening" readiness line on stdout.
8. Verify the TCP port is actually open (`ipc.checkPortOpen`).
9. Write the Windows system proxy (`ipc.setSystemProxy`).
10. Optionally tunnel WinHTTP + add the UWP loopback exemption (Game Mode).
11. Persist the sidecar PID (`ipc.saveSidecarPid`) and drop the sentinel file.
12. Start the PAC server if LAN sharing is on (`ipc.startPacServer`).
13. Update the tray tooltip → **connected**.

**Disconnect:** stop the sidecar → clear the system proxy (restoring any backed-up
corporate proxy) → remove the sentinel → flip the PAC body to `DIRECT` (the PAC
server keeps listening so LAN clients never lose connectivity).

**Recovery matrix:**

| Scenario | Detection | Action |
| --- | --- | --- |
| Crash / BSOD left proxy set | sentinel file present at launch | `startup_proxy_cleanup` restores networking |
| Port already in use | sidecar "bind … in use" on stdout | bump port and retry |
| Npcap missing in Strong mode | no `wpcap.dll` (`ipc.checkDriver`) | drop fake-packet, fall back to chunk-1 |
| Connection dropped | sidecar exit / process gone | exponential backoff reconnect: `2.5s → 3s → 6s → 12s → 20s`, max 5 (`RETRY_DELAYS`, `APP.maxReconnectAttempts`) |
| Network offline | browser `offline` event | warn and pause reconnect |

**State & recovery files:**

| Store | Key / path | Holds |
| --- | --- | --- |
| `localStorage` | `bypax_config` | all user settings (`AppConfig`, plaintext JSON, validated on load) |
| `localStorage` | `bypax_first_run_done` | first-run ISP overlay flag |
| Registry (HKCU) | `…\Internet Settings` | `ProxyEnable`, `ProxyServer`, `ProxyOverride`, `AutoConfigURL` |
| Temp file | `%TEMP%\bypaxdpi_proxy_active.lock` | sentinel — proxy is active (dirty-shutdown marker) |
| Temp file | `%TEMP%\bypaxdpi_sidecar.pid` | live sidecar PID |

## 7. Security model

BypaxDPI runs privileged native code, so the safety posture matters:

- **Sentinel + panic hook.** While connected, a sentinel file marks the proxy as
  set. On a clean exit it is removed; on a dirty shutdown the next launch detects
  it and restores networking. Independently, a Rust **panic hook** (`main.rs`) does
  emergency cleanup even on a hard panic: `reg add ProxyEnable=0`, blank
  `ProxyServer`, and `taskkill /F /IM bypax-proxy.exe` — you are never left offline.
- **Single instance.** A Windows global mutex (`Global\BypaxDPI_SingleInstance`)
  prevents two instances from fighting over the system proxy; a second launch
  focuses the existing window and exits.
- **Native, no shell-outs for privileged ops.** Proxy/registry/admin work goes
  through the `windows` crate, not spawned `cmd`/PowerShell, reducing AV false
  positives and injection surface. (Some recovery paths do shell `reg`/`netsh`/
  `ipconfig` deliberately, for robustness when the process is already failing.)
- **Tauri sandbox.** The shell capability is scoped to the bundled
  `binaries/bypax-proxy` sidecar — the frontend cannot run arbitrary commands. The
  CSP locks the WebView down: `default-src 'self'; script-src 'self'; … object-src
  'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'` (full
  string in `tauri.conf.json`).
- **XSS.** Sidecar stdout and any user content are sanitized with **DOMPurify**
  before the two `dangerouslySetInnerHTML` log-render sites (allow-list of inline
  tags only).
- **Proxy bypass list.** Critical Windows/connectivity and game/auth hosts
  (`*.windowsupdate.com`, `*.msftconnecttest.com`, `*.steam*`, `*.riotgames.com`,
  local ranges, …) are excluded from the proxy so updates, the OS connectivity
  check, and game auth keep working. Defined in `registry::set_proxy()` and mirrored
  in the served PAC.
- **PAC server hardening.** Max 50 concurrent connections; binds `0.0.0.0` only for
  LAN reach — it must not be port-forwarded to the internet.
- **DoH bootstrap.** DoH resolvers are addressed by **IP**, not hostname, so the
  DoH request itself doesn't depend on the ISP DNS it's meant to bypass.

## 8. Toolchain

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

## 9. Build & run pipeline

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

## 10. Cross-platform status

Windows-only today (system-proxy + driver code is Windows-specific; SpoofDPI for
Windows is built from source since upstream ships no Windows binary). The build
scripts are already target-triple aware to make the eventual macOS/Linux port
cheaper. See [ROADMAP.md](./ROADMAP.md).
