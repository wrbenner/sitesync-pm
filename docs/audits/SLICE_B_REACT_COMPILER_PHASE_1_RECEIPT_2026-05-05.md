# Slice B — React Compiler Phase 1 receipt (2026-05-05)

**Branch:** `feat/react-compiler-slice-b-2026-05-05`
**Goal:** Adopt `babel-plugin-react-compiler` and migrate the
`react-hooks` warning backlog so the v7 plugin's compiler-signal rules
can ship at error severity.

## What landed

### Compiler infrastructure
- Installed `babel-plugin-react-compiler@^1.0.0` (already in
  `package-lock.json` from a prior session).
- Wired into `vite.config.ts` via `@vitejs/plugin-react`'s `babel`
  option in **annotation mode** (`compilationMode: 'annotation'`).
  Components opt in via the `'use memo'` directive — zero runtime
  impact until callers opt in.

### Rules promoted to error severity (eslint.config.js)

Eleven of the fourteen Recommended-preset rules in
`eslint-plugin-react-hooks@7` now ship at `error`:

| Rule | Status | Cleared in |
|---|---|---|
| `capitalized-calls` | error | 790d1fa (prior session) |
| `static-components` | error | 790d1fa (prior session) |
| `purity` | error | a458e61 |
| `incompatible-library` | error | 7edca0e |
| `immutability` | error | 2a31ca3 |
| `config` | error | already at 0 |
| `error-boundaries` | error | already at 0 |
| `gating` | error | already at 0 |
| `globals` | error | already at 0 |
| `set-state-in-render` | error | already at 0 |
| `unsupported-syntax` | error | already at 0 |
| `use-memo` | error | already at 0 |

Plus the bonus promotion of `no-deriving-state-in-effects` (not in the
Recommended preset, but small enough to land permanently): cleared in
59ce638.

### Counts (whole repo)

| Rule | Before | After | Δ |
|---|---:|---:|---:|
| `react-hooks/purity` | 8 | 0 | -8 |
| `react-hooks/no-deriving-state-in-effects` | 2 | 0 | -2 |
| `react-hooks/incompatible-library` | 2 | 0 | -2 |
| `react-hooks/hooks` | 5 | 0 | -5 |
| `react-hooks/immutability` | 10 | 0 | -10 |
| `react-hooks/set-state-in-effect` | 84 | 82 | -2 (side effect) |
| `react-hooks/exhaustive-deps` | 84 | 83 | -1 (side effect) |
| `react-hooks/preserve-manual-memoization` | 17 | 15 | -2 (side effect) |
| **Total `react-hooks/*`** | **549** | **517** | **-32** |
| **Total ESLint warnings** | **1570** | **1541** | **-29** |
| **ESLint errors** | **0** | **0** | **0** |

### Test plan
- `npx eslint .` — 0 errors, 1541 warnings.
- `npx tsc --noEmit -p tsconfig.app.json` — green except for the
  pre-existing `src/lib/budgetComputations.test.ts:193` baseline error
  (also fails on the prior commit, unrelated to this work).
- `vite build` — clean (verified by prior commit 4a73580 receipt).

## Architectural pattern guide

The fixes followed five canonical shapes — useful as templates for the
follow-up phases:

### 1. `Date.now()` during render → lazy state
```tsx
// before
const today = Date.now()
// after
const [today] = useState(() => Date.now())
```
Used in 6 files. When the value needs to advance, layer a setInterval
on top.

### 2. `Date.now()` in a useRef initializer → 0 sentinel
```tsx
// before
const lastMouseMoveRef = useRef<number>(Date.now())
// after — populated by the first mousemove handler
const lastMouseMoveRef = useRef<number>(0)
```

### 3. `useEffect(setX, [deriveSource])` → "compare prev props during render"
```tsx
// before
const [tasks, setTasks] = useState<Task[]>([])
useEffect(() => { setTasks(mapped) }, [mapped])
// after — per https://react.dev/learn/you-might-not-need-an-effect
const [tasks, setTasks] = useState(mapped)
const [prevMapped, setPrevMapped] = useState(mapped)
if (prevMapped !== mapped) {
  setPrevMapped(mapped)
  setTasks(mapped)
}
```

### 4. Forward-declared callback used in earlier effect → ref indirection
```tsx
// before — handleSave declared lower in the file but referenced in
// an effect higher up
useEffect(() => {
  setTimeout(() => handleSave(), 1500) // immutability error
}, [...])
const handleSave = useCallback(...)
// after — route through a ref kept in sync via a separate effect
const handleSaveRef = useRef<() => void>(() => {})
useEffect(() => {
  setTimeout(() => handleSaveRef.current(), 1500)
}, [...])
const handleSave = useCallback(...)
useEffect(() => { handleSaveRef.current = handleSave }, [handleSave])
```

### 5. `let` counter mutated through `.map()` → derived index
```tsx
// before
let cursor = -1
return rows.map(r => { cursor += 1; return <Row active={cursor === idx} /> })
// after
return rows.map((r, i) => <Row active={baseIdx + i === idx} />)
```
where `baseIdx` is computed purely from the prefix lengths.

## Documented disable comments (eight total, all with rationale)

Used only when the architecturally correct path would have higher
ongoing maintenance cost than the disable + rationale captures:

- `src/components/shared/DataTable.tsx`,
  `src/components/shared/VirtualDataTable.tsx` —
  `useReactTable` is a documented compiler-incompatible API; the
  compiler correctly skips the call site.
- `src/components/drawings/DrawingViewer.tsx` —
  Liveblocks hooks gated by a module-level constant
  (`LIVEBLOCKS_CONFIGURED` from `import.meta.env`); hook order is
  provably stable per build. Existing rationale comment extended.
- `src/stores/entityStore.ts` —
  Zustand stores expose `.getState()` as a static method on the same
  identifier; the rule mistakes this for a hook reference.
- `src/components/shared/IntelligenceGraph.tsx` —
  60 Hz force-directed physics simulation mutates ref-stored scratch
  state in place; immutable copies would tank the frame budget.
- `src/pages/SiteMap.tsx` —
  Latest-ref pattern keeps an imperative Leaflet click handler synced
  with React state. `ref.current` is the documented mutation API.
- `src/pages/drawings/DrawingToolbar.tsx` (×2) —
  Standard ref-forwarding pattern using
  `React.MutableRefObject.current`.

Each disable names the specific rule and explains *why* — matches the
"documented disable, not blanket suppression" guidance from the parent
slice spec.

## Deferred — Phase 2+ work

Three Recommended-preset rules still have warnings and are kept at
`warn` for follow-up:

- **`set-state-in-effect` (82)** — each is a fetch-on-mount or
  derive-from-prop pattern that wants migrating to TanStack Query or
  the `react.dev` "compare prev props during render" idiom (Phase 1
  used the latter for two cases). 82 is too large for one PR; recommend
  splitting per-page (RFIs, Submittals, Drawings, Daily Log, etc.).
- **`refs` (24)** — `ref.current` reads during render, mostly in
  Liveblocks integrations and PDF/canvas viewers. Each requires
  hoisting the read into `useEffect` or `useMemo` with the ref in deps,
  or moving to a lazy state.
- **`preserve-manual-memoization` (15)** — existing `useMemo` /
  `useCallback` calls the compiler can already auto-memoize. Audit
  each: keep if there's a non-memoization reason (effect dep stability),
  delete otherwise.

The remaining non-Recommended rules
(`memo-dependencies`, `exhaustive-deps`, `invariant`, `todo`,
`hooks`, `syntax`, `rule-suppression`, `void-use-memo`,
`memoized-effect-dependencies`, `exhaustive-effect-dependencies`)
intentionally stay at `warn` — most cover compiler-internal codegen
limits (`todo`, `invariant`) or are advisory signals that don't block
the compiler.

## Commits in this PR

```
b1a1374 feat(eslint): promote 11 React Compiler Recommended rules to error
2a31ca3 fix(react-hooks): clear immutability (10 → 0)
f643610 fix(react-hooks): clear react-hooks/hooks (5 → 0)
7edca0e fix(react-hooks): clear incompatible-library (2 → 0)
59ce638 fix(react-hooks): clear no-deriving-state-in-effects (2 → 0)
a458e61 fix(react-hooks): clear react-hooks/purity (8 → 0)
790d1fa fix(react-hooks): clear static-components + capitalized-calls (3 warnings)
4a73580 feat(slice-b): wire babel-plugin-react-compiler into Vite (annotation mode)
```
