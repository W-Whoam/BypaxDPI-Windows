# GLOSSARY

Project terms and abbreviations. Each is a heading so it can be linked.

## DPI

Deep Packet Inspection. The technique ISPs use to look inside network traffic
(beyond IP/port) and block or throttle it — e.g. by reading the TLS SNI to see
which site you're connecting to. BypaxDPI's job is to make that inspection fail.

## DPI bypass

Reshaping outgoing traffic so a DPI box can't reliably classify it — without a
remote VPN server. BypaxDPI does this locally on your machine; it is not a tunnel
and does not decrypt your traffic.

## SpoofDPI

The open-source Go DPI-bypass proxy ([xvzc/spoofdpi](https://github.com/xvzc/spoofdpi))
that BypaxDPI bundles as its engine, built as the `bypax-proxy` binary. Pinned to
v1.5.3 (see `scripts/proxy.config.ts`).

## zapret2

A different DPI-bypass engine ([bol-van/zapret2](https://github.com/bol-van/zapret2)),
planned as a second selectable engine. See [ROADMAP.md](./ROADMAP.md).

## Sidecar

A Tauri term for an external executable the app bundles and spawns. BypaxDPI's
sidecar is `bypax-proxy` (declared as `externalBin` in `tauri.conf.json`). Tauri
expects it named `<name>-<target-triple><ext>` in `src-tauri/binaries/`.

## Target triple

The Rust platform identifier (e.g. `x86_64-pc-windows-msvc`) used to name the
sidecar so Tauri's bundler picks the right one. Detected at build time via
`rustc -vV` in `scripts/proxy.config.ts`.

## SNI

Server Name Indication — the hostname sent in the clear during a TLS handshake.
A common DPI signal; Turbo mode targets just this.

## Chunk split / chunk size

Splitting an HTTPS/TLS record into N smaller TCP segments so a DPI box can't
reassemble the SNI in one read. **Chunk size** is the configurable byte count
(see `CHUNK_SIZES`, `DEFAULT_CHUNKS`). Used by Balanced and Strong modes.

## Packet disorder

Sending segments out of order (in addition to chunking) to further confuse DPI
reassembly. Used by Strong mode.

## Bypass mode (DpiMethod)

The strength tier, a string `"0" | "1" | "2"`: Turbo / Balanced / Strong. Stored
in `AppConfig.dpiMethod`. See [ARCHITECTURE.md](./ARCHITECTURE.md#5-the-engine-spoofdpi-sidecar).

## DoH

DNS over HTTPS. Resolving DNS over an HTTPS connection so the ISP can't see or
hijack plain port-53 queries. BypaxDPI uses resolver **IPs** (not domains) for
DoH to avoid a bootstrap chicken-and-egg (see `DOH_MAP` in `constants.ts`).

## PAC

Proxy Auto-Config. A small script served over HTTP that tells other devices
(phone, console) which proxy to use. BypaxDPI runs a connection-limited PAC
server in Rust for LAN sharing; "stopping" it flips it to DIRECT rather than
dropping connections.

## Npcap / wpcap.dll

A Windows packet-capture driver. When installed (`wpcap.dll` present), Strong
mode can do fake-packet injection for tougher DPI. Detected/installed via
`check_driver` / `install_driver`.

## WinHTTP / Game Mode

A Windows system HTTP setting separate from the per-user proxy. Enabling "Game
Mode" tunnels WinHTTP through the proxy so C++ desktop games/services also bypass
DPI. Controlled by `AppConfig.enableWinhttp`.

## Sentinel recovery

A crash-safety mechanism: a sentinel file marks that the proxy was left set. If
the app/PC dies (BSOD, power loss), the next launch detects the sentinel and
restores networking (`startup_proxy_cleanup`) so you're never left offline.

## Zombie sidecar

A `bypax-proxy` process orphaned by a previous crash/force-kill. Cleaned up on
launch (`kill_zombie_sidecar`); the live sidecar's PID is persisted via
`save_sidecar_pid`.

## ISS / ISP

ISS is the Turkish abbreviation (İnternet Servis Sağlayıcı) used in the UI and
code; ISP is the English equivalent. ISP presets live in `ISP_PROFILES`
(`profiles.ts`); the selected one is `AppConfig.selectedIspProfile`, which may be
`"custom"` when the user hand-tunes settings.
