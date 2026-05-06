# Slice B — React Compiler Phase 2 receipt (2026-05-05)

**Branch:** `feat/react-compiler-slice-b-2026-05-05`
**Phase:** 2 of N (Phase 1 receipt: `SLICE_B_REACT_COMPILER_PHASE_1_RECEIPT_2026-05-05.md`)

## What landed

Cleared the two cheaper Phase 2 rules (preserve-manual-memoization,
refs) and promoted them to error. The third Recommended-preset rule
with backlog (set-state-in-effect) is documented and deferred to
Phase 3 as its 82 warnings span four architecturally distinct
migration patterns that each deserve their own focused PR.

### Counts (full repo)

| Metric | Phase 1 end | Phase 2 end | Δ |
|---|---:|---:|---:|
| `react-hooks/*` warnings | 517 | 482 | -35 |
| Total ESLint warnings | 1541 | 1501 | -40 |
| ESLint errors | 0 | 0 | 0 |

| `react-hooks` rule | Phase 1 end | Phase 2 end | Now at |
|---|---:|---:|:---|
| `preserve-manual-memoization` | 15 | 0 | **error** ↑ |
| `refs` | 24 | 0 | **error** ↑ |
| `todo` | 258 | 257 | warn (compiler limit) |
| `set-state-in-effect` | 82 | 82 | warn (Phase 3) |

### Rules now at error severity (13 of 14 Recommended-preset)

`capitalized-calls`, `config`, `error-boundaries`, `gating`, `globals`,
`immutability`, `incompatible-library`, `no-deriving-state-in-effects`,
`preserve-manual-memoization`, `purity`, `refs`, `set-state-in-render`,
`static-components`, `unsupported-syntax`, `use-memo`.

The single holdout is `set-state-in-effect` — see Phase 3 plan below.

## Architectural patterns used in Phase 2

### `preserve-manual-memoization` — 15 warnings, all the same root cause

Every flagged `useCallback` / `useMemo` had a manual dep that walked
through an optional chain (`user?.id`, `todayLog?.id`, `currentOrg?.id`,
`dailyLogsData?.data`). The compiler couldn't safely narrow the
optional access from the parent object, so it inferred the parent as
the dep — mismatched with the manual dep — and skipped compilation.

**Fix:** hoist the optional-chain access into a primitive const above
the callback. The result keys on exactly the value the body reads,
manual deps and inferred deps line up, and the compiler can preserve
the memoization.

```ts
// before
const cb = useCallback(() => doThing(user?.id), [user?.id])
// after
const userId = user?.id
const cb = useCallback(() => doThing(userId), [userId])
```

Bonus: the body reads a primitive instead of repeatedly walking the
optional chain — slightly faster and clearer.

### `refs` — 24 warnings, six distinct patterns

The compiler forbids reading or writing `ref.current` during render —
refs are imperative escape hatches and reading them gives no
re-render guarantee. Six patterns turned up:

1. **State-as-ref "latest" syncs → useEffect**
   `logsRef.current = logs` during render → `useEffect(() => { logsRef.current = logs }, [logs])`.
   Three sites in `useFieldOperations.ts`.

2. **Refs read during render to drive UI → mirror in state**
   `dragRef.current.isPanning` driving a CSS cursor →
   `useState` mirrored from gesture handlers.
   Two sites: IntelligenceGraph (panning), MobileScheduleView
   (pinch-zoom transition).

3. **Counter/index refs read in JSX → state**
   `whiteboardKeyRef.current` for remount key, `historyIndexRef.current`
   for undo button disabled, `undoStack.current.length` for canUndo →
   replaced with state. Three sites: WhiteboardPage, PhotoAnnotation,
   DrawingTiledViewer.

4. **DOM measurements during render → ResizeObserver + state**
   `containerRef.current.clientWidth` during render → tracked in
   `containerSize` state via ResizeObserver. Two sites:
   DrawingTiledViewer (loupe positioning), LiveCursorOverlay
   (surface bounding rect).

5. **"Latest props" via ref → closure capture**
   `lastPosRef.current = { x: screenX, y: screenY }` during render
   was feeding a rAF paint. Removed entirely — the paint effect
   re-runs on screenX/screenY change and captures via closure (the
   effect's cleanup cancels in-flight rAF, so positions don't get
   reordered). One site: DrawingTiledViewer loupe.

6. **Incidental cleanup**
   LiveCursorOverlay's `allMembersRef` was a duplicate of the
   `cursors` state (line 49 wrote them in sync). Replaced
   render-time read with direct `cursors` read; deleted the
   redundant ref + its useRef import.

The PhotoAnnotation undo/redo refactor is worth highlighting: the
previous code had a `setHistoryTick` "force re-render" hack to make
the toolbar buttons update when the ref-stored history changed.
Replacing the refs with state (`historyIndex`, `historyLength`)
eliminated the tick hack entirely — the buttons now re-render
naturally when the values change.

## Phase 3 plan — `set-state-in-effect` (82 → 0)

The 82 remaining warnings split into four migrations, each warranting
a dedicated PR for review:

### 3a — Reset-on-prop-change (~30 sites)

Pattern: `useEffect(() => { setX(propY) }, [propY])`.

Fix: react.dev "compare prev props during render" pattern (same as
the `no-deriving-state-in-effects` fixes in Phase 1).

```tsx
const [x, setX] = useState(propY)
const [prev, setPrev] = useState(propY)
if (prev !== propY) { setPrev(propY); setX(propY) }
```

Sites: Sidebar, Primitives, MentionInput, IrisDraftDrawer,
EditConflictGuard, NotificationCenter, CrossEntitySearch,
CommandPalette, CrossProjectSearchPalette, SmartPicker,
EntityFormModal, drawings/index, daily-log/index, RFIs (response
state), Crews, Workforce, drawings/MeasurementOverlay,
drawings/VersionCompare, ConfirmDialog, DrawingTiledViewer
(3 cases for tool resets), Estimating (2 EditableText/Number),
Meetings, UserProfile, Wiki, ExportCenter, RFICreateWizard,
Closeout (3), admin/branding, admin/sso, payment-applications,
punch-list/PunchListPlanView, submittals/SubmittalDetailPage,
App.tsx (auto-open modal), ConflictResolutionModal, CreateProject
(draft load).

### 3b — Fetch-on-mount (~20 sites)

Pattern: `useEffect(() => { fetch().then(setX) }, [deps])`.

Fix: migrate to TanStack Query (`useQuery({ queryKey, queryFn })`).

Sites: useFieldOperations (6 hooks already partially TanStack-Query
migrated elsewhere — finish the migration), useDailyLogs (legacy),
useScheduleActivities, useFieldCapture, useMfa, useOfflineSync,
useSupabase, useSignedUrl, OwnerReport, ProjectBrain,
EntityAuditViewer, QuickRFI, Settings/NotificationSettings, SiteMap
(loadPins/Zones/SitePlans/LinkedEntities), share/MagicLinkEntity,
files/FilePreviewPanel, admin/UserManagement,
compliance/HUDCompliancePage.

### 3c — Derive-from-prop (~5 sites)

Pattern: `useEffect(() => { setX(deriveFrom(propY)) }, [propY])` —
where the derivation is pure.

Fix: derive during render, drop the state.

```tsx
// before
const [count, setCount] = useState(0)
useEffect(() => { setCount(items.length) }, [items.length])
// after
const count = items.length
```

Sites: PresenceBar (×2), digital-twin/DigitalTwinPage, RFICreateWizard.

### 3d — Subscriptions / event-driven (~5 sites)

Pattern: `useEffect(() => { subscribe(...).then(setX); ... }, [])`.

Fix: refactor per-case; usually safe to keep the effect with a
documented disable + rationale, or split state from subscription
lifecycle.

Sites: CollabTextarea, OfflineIndicator, IrisSuggests, useAuth
(session validity recompute), useCollaborativeField,
CreateDailyLogModal (mediaQuery + weather).

## Commits in this PR (Phase 1 + Phase 2)

```
8689a86 feat(eslint): promote refs + preserve-manual-memoization to error (Phase 2)
cdd43cc fix(react-hooks): clear refs (24 → 0)
92b5b2e fix(react-hooks): clear preserve-manual-memoization (15 → 0)
6f76e52 docs(audits): Slice B React Compiler Phase 1 receipt
b1a1374 feat(eslint): promote 11 React Compiler Recommended rules to error
2a31ca3 fix(react-hooks): clear immutability (10 → 0)
f643610 fix(react-hooks): clear react-hooks/hooks (5 → 0)
7edca0e fix(react-hooks): clear incompatible-library (2 → 0)
59ce638 fix(react-hooks): clear no-deriving-state-in-effects (2 → 0)
a458e61 fix(react-hooks): clear react-hooks/purity (8 → 0)
790d1fa fix(react-hooks): clear static-components + capitalized-calls (3) [prior session]
4a73580 feat(slice-b): wire babel-plugin-react-compiler into Vite [prior session]
```

## Bugatti standard notes

- Each commit clears one rule completely. No half-finished migrations.
- `preserve-manual-memoization` was a single-pattern problem, fixed
  with a consistent hoist across every site.
- `refs` had real architectural variation (six patterns), each
  addressed at its proper level — never a blanket disable, never a
  "tick" hack.
- `set-state-in-effect` is held back deliberately. It would have been
  faster to disable each site or do a sloppy migration; instead the
  82 warnings stay visible at warn until each subset gets its own
  focused PR.
