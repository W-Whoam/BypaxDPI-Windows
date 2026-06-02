# ROADMAP

Future-facing only. Past work is in [CHANGELOG.md](./CHANGELOG.md) /
[HISTORY.md](./HISTORY.md). Nothing here is committed to a date; order is rough
priority.

## Cross-platform (macOS / Linux)

The app is Windows-only today: the system-proxy and Npcap/driver code in
`src-tauri/` is Windows-specific, and SpoofDPI for Windows is built from source
(upstream ships no Windows binary). The build scripts are already target-triple
aware, so the remaining work is:

- Platform-specific system-proxy backends (macOS `networksetup`, Linux desktop
  environments / `gsettings`).
- Use SpoofDPI's prebuilt macOS/Linux release binaries (see the v1.5.3 release
  assets) instead of building from source where available.
- Gate the Npcap/driver UI behind the Windows platform.

## Pluggable bypass engine + zapret2

Today the engine argument builder and lifecycle in `App.tsx` are SpoofDPI-specific.
Introduce a small engine interface — `buildArgs(AppConfig) → spawn → parse
readiness/errors` — with **SpoofDPI** and **[zapret2](https://github.com/bol-van/zapret2)**
as implementations, selectable in settings. This is the protocol-over-implementation
seam noted in [ARCHITECTURE.md](./ARCHITECTURE.md#5-the-engine-spoofdpi-sidecar);
zapret2 uses a different (often more capable) bypass approach and would let users
fall back when SpoofDPI fails on a given ISP.

## Auto-fetch the SpoofDPI source

`build-proxy` currently expects a vendored `SpoofDPI-<version>/` tree. Add an
optional step that downloads + verifies (checksum) the pinned source tarball from
the GitHub release so a fresh clone can build the sidecar with one command.

## Type/quality follow-ups

- **Audit `useExhaustiveDependencies`.** The 10 effects flagged (now warnings) use
  refs deliberately, but a human pass with the app running should confirm none
  hides a stale-closure bug, then either add the dep or add a justified
  `biome-ignore`.
- **Break up the god-files.** `App.tsx` (~3300 lines) and `Settings.tsx` (~1760)
  violate the project's own "no monolithic file" rule. Extract the engine
  lifecycle, the log panel, the connection/PAC modal, and the dialogs into
  responsibility-separated modules and hooks.
- Consider extracting the engine-argument builder out of `App.tsx` (prerequisite
  for the pluggable-engine work above).

## Packaging

- macOS `.dmg` / Linux `.AppImage`/`.deb` targets once the platform backends land.
