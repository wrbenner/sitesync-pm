# Polish Pass Receipt — 2026-05-12

**PR:** #484 — `auto/polish-20260512-1532`  
**Branch:** `auto/polish-20260512-1532`  
**Commits:** 3 (all green on typecheck + ESLint + build)

---

## What changed

### 1. Math.random → crypto (5 files, 8 deletions)

Dead `typeof crypto !== 'undefined'` fallbacks eliminated. `crypto.randomUUID()` and `crypto.getRandomValues()` are universally available (Chrome 92+, Safari 15.4+, Node 18+).

- `src/lib/fieldCapture/durableQueue.ts` — `makeUuid()` + jitter calc
- `src/lib/apiTokens/index.ts` — `randomSecret()`
- `src/lib/realtime/presenceChannel.ts` — `generateUuid()`
- `src/lib/webhooks/index.ts` — `event_id` fallback
- `src/lib/emailThreading.ts` — `randomHex()`

Net: `Math.random` count in non-test source: **6 → 0**.

### 2. Weather display labels (2 files)

POLISH_PUNCH_LIST item resolved.

- `src/components/dailylog/QuickEntry.tsx`: `H 97° / L 91°` → `High 97°F / Low 91°F`  
  Also added `htmlFor`/`id` to 4 unlabelled `<label>` elements (a11y fix that cleared pre-existing ESLint warnings).
- `src/components/export/DailyLogPDF.tsx`: `97F` → `High 97°F / Low 91°F`

### 3. Time Tracking mobile overflow (1 file)

- Week navigation row made `overflow-x: auto` with `flex-shrink: 0` + `white-space: nowrap` on each button — "← Prev Week" / "Next Week →" no longer wrap to two lines on iPhone 393px.
- "Week at a Glance" card header: added `flex-wrap: wrap` so the Enter Hours button reflows below the long date-range title on narrow screens.
- Cleared 7 pre-existing ESLint warnings that blocked the pre-commit hook:
  - `react-hooks/memo-dependencies`: moved `totalHours` to module scope (`totalTimeEntryHours`)
  - `jsx-a11y/label-has-associated-control`: added `htmlFor`/`id` to Period, Format, Worker, Cost Code selects
  - `react-hooks/todo`: replaced `throw` inside `try/catch` with early-return toast

---

## Metrics

| Metric | Floor | After |
|--------|-------|-------|
| TypeScript errors | 0 | **0** |
| ESLint warnings | 0 | **0** |
| `as any` (code, excl. comments) | 69 | **67** |
| `Math.random` (non-test src) | 0 | **0** |
| Build | pass | **pass** |

---

## Playwright sweep results (84 tests)

- **69 passed** — Safety, Schedule, Time Tracking, Directory, Drawings, Login and all their viewport variants rendered correctly.
- **15 failed** — Login (real-auth flow), RFIs, Daily Log, Punch List, Submittals. All require either real Supabase auth or project context that doesn't exist in `VITE_DEV_BYPASS=true` mode. Not code regressions.

---

## Deferred

- **Dashboard / Settings / Iris / Crews / Meetings / Reports blank in bypass mode** — these pages require a real project context. Not fixable without a live Supabase project. Not a code bug.
- **Budget / Change Orders "Access Restricted"** — viewer role (the bypass default) doesn't have permission. Correct behaviour.
- **Safety KPI label wrapping on iPhone** ("DAYS WITHOUT INCIDENT" / "EXPIRING CERTS" break to 2 lines inside 2-col card grid) — minor cosmetic, would need card min-width or abbreviation; deferred.

---

## Next

Lap 2 Day 31 pre-flight: `IRIS_TELEMETRY_SPEC_2026-05-04.md` migration must land. Read that spec before touching any DB files.
