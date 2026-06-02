# Changelog

All notable changes to BypaxDPI are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The _why_ behind these changes is in [HISTORY.md](./HISTORY.md).

## [Unreleased]

The TypeScript / Bun migration — turning a renamed-but-untyped codebase into one
that actually type-checks. See [HISTORY.md](./HISTORY.md#the-typescript--bun-migration-2026-06).

### Added

- `src/types.ts` — shared, import-free domain types (`AppConfig`, `LogEntry`,
  `DpiMethod`, `DnsKey`, `IspProfileId`, `SelectedIspProfile`, `UpdateConfig`,
  `DnsLatencies`, `IspProfile`, `BypassMode`, `ChunkSizeOption`).
- `src/ipc.ts` — typed wrapper for every Tauri command (one seam over `invoke`).
- `tsconfig.app.json` + `tsconfig.node.json` project references; `tsconfig.json`
  is now a solution file. `src/vite-env.d.ts` for Vite ambient types.
- `scripts/proxy.config.ts` — single source of truth for the sidecar build
  (externalized SpoofDPI version, Go entrypoint, host target-triple detection).
- `package.json` scripts: `typecheck`, `lint`, `lint:fix`, `format`.
- Missing i18n keys (`btnNo`, `btnYes`, `logFailsafePortClosed`,
  `logDirtyShutdownRecovery`) in both `tr` and `en`.
- Root docs: `ARCHITECTURE.md`, `HISTORY.md`, `CHANGELOG.md`, `ROADMAP.md`,
  `GLOSSARY.md`.

### Changed

- **The whole frontend and tooling now type-checks under `strict`** (was 722
  `tsc` errors → 0). `App.tsx` and `Settings.tsx` fully typed; Tauri calls go
  through `src/ipc.ts`.
- Build scripts rewritten as real Bun ESM TypeScript; SpoofDPI pinned to **1.5.3**
  and the sidecar named by the host target triple (cross-platform groundwork).
- `tauri.conf.json` `beforeDev`/`beforeBuildCommand` now use `bun` instead of `npm`.
- Biome scoped to a desktop webview: web-a11y rules off; `useExhaustiveDependencies`
  and `noArrayIndexKey` downgraded to warnings (documented in `ARCHITECTURE.md`).
- Repo formatted with the configured Biome formatter (tabs).
- `@types/react` + `typescript` declared as devDependencies.

### Fixed

- `main.tsx` crashed-type on a null `#root` (masked when DOM types were missing).
- Notification cleanup called `onAction`'s `PluginListener` as a function — would
  throw at unmount; now `.unregister()`.
- Confirm-dialog buttons and two log lines never localized (referenced
  undefined i18n keys); now defined.
- `selectedIspProfile` could hold `"custom"` but the type forbade it.

### Removed

- Dead build-script duplicates (`scripts/*.cts`, `scripts/*.ps1`, `scripts/new.md`)
  and the root `change-icon.ts` (moved to `scripts/`).
- Dead frontend code (unused DNS-ping timeout chain; unused `currentLang`).
- Tracked cruft: `package-lock.json`, `tauri_schema.json` (now gitignored).
- Deprecated `@types/dompurify` stub (DOMPurify v3 ships its own types).

## [1.0.0] - 2026-05-08

Initial BypaxDPI release: Tauri v2 + React frontend, SpoofDPI proxy integration,
panic-safe proxy cleanup (dirty-state sentinel recovery), system proxy +
WinHTTP management with backup/restore, connection-limited PAC server for LAN
sharing, DoH DNS with latency benchmarking, 3-tier DPI bypass engine, Npcap
advanced bypass, autostart, i18n (tr/en), and an NSIS/MSI installer.
