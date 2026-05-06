# Parallel-Tab Contract — Homepage Redesign Wave 1

This file defines who-owns-what so 4 tabs run tonight without write conflicts. Read this **before** opening any tab.

## Pre-Flight (already committed on this branch)

These four files exist as **typed stubs** so every tab's imports resolve from the start. Each tab replaces its owned stub with the real implementation:

| File | Pre-flight state | Final owner |
|------|------------------|-------------|
| `src/types/stream.ts` | **Locked.** Full types — do not modify shape mid-flight. | All tabs read; nobody writes. |
| `src/services/iris/index.ts` | Identity stub (`detectIrisEnhancements` returns items unchanged) | Tab D |
| `src/stores/streamStore.ts` | Empty Zustand store, correct signatures | Tab A |
| `src/hooks/useActionStream.ts` | Returns empty result | Tab A |

If a contract change is genuinely needed mid-flight, **stop, edit `src/types/stream.ts` from one tab only, communicate, then resume.** Do not let two tabs evolve the contract independently.

## File-Ownership Map (zero overlap)

### Tab A — Stream Data Layer
**Owns (writes):**
- `src/hooks/useActionStream.ts` (replaces stub)
- `src/stores/streamStore.ts` (replaces stub — finalize localStorage snooze + in-memory dismiss)
- `src/config/roleFilters.ts` (new)
- `src/hooks/__tests__/useActionStream.test.ts` (new)

**Reads only:** existing query hooks (`useRFIs`, `usePunchItems`, `useSubmittals`, `useTasks`, `useIncidents`, `useDailyLogs`, `useScheduleActivities`), `src/types/stream.ts`, `src/services/iris/index.ts`.

### Tab B — Stream UI
**Owns (writes):**
- `src/components/stream/ActionStream.tsx`
- `src/components/stream/StreamItem.tsx`
- `src/components/stream/StreamItemExpanded.tsx`
- `src/components/stream/StreamEmpty.tsx`
- `src/components/stream/StreamPulse.tsx`
- `src/components/stream/StreamNav.tsx`
- `src/components/stream/SwipeActions.tsx`
- `src/pages/day/index.tsx` (full rewrite)

**Reads only:** `src/types/stream.ts`, `src/hooks/useActionStream.ts` (stub returns empty during dev), `src/stores/streamStore.ts`, design tokens (`src/styles/theme.ts`, `src/styles/tokens.css`).

### Tab C — Navigation
**Owns (writes):**
- `src/config/navigation.ts` (new)
- `src/components/Sidebar.tsx` (rewrite)
- `src/components/CommandPalette.tsx` (enhance or create)
- `src/components/MobileTabBar.tsx` (new)
- `src/App.tsx` — **only the route-redirects block** (`/conversation` → `/day`, `/site` → `/day`); leave all existing routes intact.

**Reads only:** `src/types/stream.ts` (for `StreamRole` + `toStreamRole`), `useAuth`, `usePermissions`.

### Tab D — Iris Service
**Owns (writes):**
- `src/services/iris/index.ts` (replaces stub — finalize `detectIrisEnhancements`)
- `src/services/iris/drafts.ts` (new)
- `src/services/iris/templates.ts` (new)
- `src/services/iris/types.ts` (new — IrisDraft + service-local types only; do NOT redefine StreamItem types)
- `src/stores/irisDraftStore.ts` (new)

**Reads only:** `src/types/stream.ts`, existing project context hooks, `@ai-sdk/anthropic` (already installed).

## Cross-Cutting Rules

1. **Nobody touches `src/types/stream.ts`** except via a coordinated edit. The shape is locked.
2. **Nobody else writes to `src/App.tsx`** during Wave 1 except Tab C (route redirects only).
3. **Nobody else writes to `src/components/Sidebar.tsx`** during Wave 1 except Tab C.
4. **No package.json changes** during Wave 1 (`@ai-sdk/anthropic` already present per existing `src/services/iris/draftAction.ts`).
5. **No CSS token changes** — read from existing `src/styles/tokens.css` only.
6. **Tests:** each tab is responsible for tests under its owned paths only.

## Completion Criteria per Tab

A tab is "done" when:
- ✅ Owned files compile (`pnpm typecheck` clean for owned paths)
- ✅ Tests for owned paths pass (`pnpm test` filtered)
- ✅ The tab's own session spec acceptance checklist is satisfied
- ✅ Zero edits outside the owned-files list above
- ✅ A short PR description summarizing the diff

## Merge Order

After all 4 tabs complete:
1. **Tab A first** (data layer) — others depend on the real `useActionStream` to flip from stub to real
2. **Tab D second** (Iris) — finalizes `detectIrisEnhancements` so Tab A's hook decorates items
3. **Tab B third** (UI) — now consumes real data + real Iris drafts
4. **Tab C last** (nav) — independent; merge anytime after Tab A

If any conflict arises during merge, the contract types in `src/types/stream.ts` win. Adjust callers, never the contract.
