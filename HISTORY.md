# HISTORY

The _why_ behind non-obvious decisions and milestones. Structured-by-version
change facts live in [CHANGELOG.md](./CHANGELOG.md); the resulting design lives
in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## The TypeScript / Bun migration (2026-06)

### What state the repo was actually in

The git log told a tidy story — "migrate to bun", "biome for formatting", "please
no js", "migrate src (the frontend) to typescript", "type fixes to i18n". The
reality was that the migration was **cosmetic**: files had been renamed, not
typed.

- `tsc` had never passed. Under `strict` it reported **722 errors**, most of them
  bogus — because the single root `tsconfig.json` mixed a browser (React) and a
  Bun environment in one compilation, so it had no `DOM` lib, no `jsx`, and
  `bun-types` polluting the frontend. `document`, `window`, `navigator` weren't
  even typed.
- `App.tsx` (~3300 lines) and `Settings.tsx` (~1760) were untyped JS in `.tsx`
  clothing: `useState([])`, `(text, fieldName)` params, `invoke()` results used
  as `any`.
- The build scripts (`copy-proxy.ts`, `build-proxy.ts`) were still CommonJS
  (`require`, `__dirname`), duplicated as `.cts`, and cross-referenced
  `copy-proxy.js`/`.cjs` files that no longer existed — so `bun run build`,
  `build-proxy`, and `copy-proxy` were all broken. `package.json` scripts pointed
  at deleted `.js`/`.cjs` files.
- `package-lock.json` (npm) and a 308 KB `tauri_schema.json` were tracked.

The lesson recorded here so the next session doesn't trust the log over the
tools: **a rename is not a migration.** The first thing the migration did was make
`tsc` and `biome` _tell the truth_, then fix from there.

### Decision: split tsconfig into project references

The keystone. One config cannot serve both a DOM/React frontend and Bun tooling.
Split into `tsconfig.app.json` (frontend: DOM + `react-jsx`, no Bun/Node globals)
and `tsconfig.node.json` (tooling: Bun globals, no DOM), wired by a solution
`tsconfig.json`. This alone took the error count from **722 → 145** by removing
the bogus DOM/jsx/window errors and exposing the ~143 _real_ ones (plus surfacing
a genuine null-`getElementById` bug in `main.tsx`).

Closes off: a single "just run tsc on everything" mental model. The price is
three config files; the payoff is that each environment is type-checked correctly
and frontend code can't accidentally use Bun globals.

### Decision: a typed IPC boundary instead of `invoke<T>` everywhere

Rather than sprinkle `invoke<T>(...)` generics across the components, all 15 Tauri
commands got exactly one wrapper in `src/ipc.ts`. This is the
protocol-over-implementation seam: the React code speaks `ipc.startPacServer(port)`,
not a stringly-typed command name + a hand-remembered camelCase/snake_case
contract. The Tauri argument-casing rule (camelCase JS keys → snake_case Rust
params) and the snake_case response fields (`bind_address`, `pac_port`) are
encoded once, in the wrapper, where they can't drift.

### Decision: shared, import-free `types.ts`; data conforms via `satisfies`

`src/types.ts` is the domain vocabulary and is deliberately import-free (it's the
leaf everything depends on). `constants.ts`/`profiles.ts` attach those types to
their literal data with `satisfies`, so keys and values can't drift from the
types (a missing DNS resolver or a typo'd DPI method is a compile error) while
literal inference is preserved. `i18n.ts` derives `Translations` from the English
table, which made `tr`/`en` key drift a compile error — and immediately caught
one: `logPacStartError` took `number` in `tr` but `Error` in `en`. The six
`log*Error` helpers were normalized to `unknown`, which is also the honest type
for their catch-block call sites.

### Decision: parallelize the two big files behind a fixed boundary

`App.tsx` and `Settings.tsx` were typed by two agents in parallel. The only thing
coupling them is the props `App` passes to `<Settings/>`, so that contract
(`UpdateConfig`, `DnsLatencies`, and ultimately `SettingsProps`) was defined in
the shared types _first_. With the boundary fixed, the two files were independent
and the full project type-checked at **zero errors** on the first reconciliation —
no boundary mismatch.

### Bugs found by typing (kept, documented)

Type-checking is a bug finder. Surfaced and fixed:

- **Notification cleanup would throw.** `onAction` (plugin-notification) returns a
  `PluginListener` whose disposer is `.unregister()`, but the cleanup called it as
  a function `unlistenNotificationAction()` — a `TypeError` at unmount. Fixed.
- **Four i18n keys never existed** (`logFailsafePortClosed`,
  `logDirtyShutdownRecovery`, `btnNo`, `btnYes`), so the confirm-dialog buttons and
  those log lines always fell back to hardcoded Turkish literals and never
  localized. Added to both `tr` and `en`.
- **`selectedIspProfile` stored `"custom"`** at runtime but the type only allowed
  the four presets. Added `SelectedIspProfile = IspProfileId | "custom"`.
- **Dead code**: an unused DNS-ping timeout chain (the timeout moved to the Rust
  backend) and an unused `currentLang` in `Settings.tsx`. Removed.

### Decision: SpoofDPI version externalized; build scripts target-triple aware

The build scripts hardcoded `SpoofDPI-1.2.1` and `x86_64-pc-windows-msvc`. They
were rewritten as real Bun ESM with `scripts/proxy.config.ts` as the single
source of truth: the SpoofDPI version is pinned to **1.5.3** (overridable via
`SPOOFDPI_VERSION`) and the sidecar's target triple is computed from `rustc -vV`.
This is groundwork for going cross-platform — the app is Windows-only today but is
moving toward macOS/Linux, and a second engine (zapret2) is planned. The `.cts`
duplicates and parallel `.ps1` scripts were removed in favour of the one Bun path.

### Decision: scope Biome to a desktop app, don't chase web-a11y

After formatting and the safe fixes, most remaining lint was web-accessibility
rules (`useButtonType`, `useKeyWithClickEvents`, `noStaticElementInteractions`,
…). BypaxDPI is a fixed 380×700 mouse/touch control panel, not a navigable web
page, so those were turned off (documented in `biome.json` and
`ARCHITECTURE.md`) rather than polluting the JSX with `type="button"` on every
control. `useExhaustiveDependencies` and `noArrayIndexKey` were downgraded to
warnings — the effects deliberately use refs and the lists are static, but the
signal is kept for a future audit (see ROADMAP). Security-sensitive patterns
(DOMPurify-sanitized HTML, the ANSI-strip regex) were kept strict with justified
inline ignores.

### Outcome

`bun run typecheck` → 0 errors. `bun run lint` → green (0 errors; warnings are the
intentional ref-based effects). `bunx vite build` → bundles cleanly (2127
modules). The project is now genuinely type-based, not type-named.
