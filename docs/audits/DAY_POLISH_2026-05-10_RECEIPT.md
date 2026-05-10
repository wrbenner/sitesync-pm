# Day Polish Receipt — 2026-05-10

**Session type:** Autonomous overnight polish  
**PR:** #409 `auto/polish-20260510-1924`  
**Commit:** `ff1ed5c0`  
**Files changed:** 4 (18 insertions, 11 deletions)

---

## What Changed

### iPad sidebar icon-rail fix (`src/App.tsx`)
The 3-night demo blocker. At 769–1024px, the sidebar was expanding to 252px and obscuring content on every page. Root cause: `useEffect` only had `if (isMobile)` / `else` — `isTablet` in the dep array but never branched on. Four changes: `else if (isTablet)` branch forces icon-rail collapse, grid template maps collapsed+tablet to `72px`, sidebar always rendered on tablet, hamburger suppressed on tablet. Result: full content area available on iPad at all orientations.

### Em-dash name fallback (`src/components/Sidebar.tsx`)
Seed user `full_name = '—'` was passing through `|| ''` as a valid name and rendering "— / Project Manager". Added `/^[—–\-\s]+$/` regex guard — treats dash-only strings as unset, falls back to email local-part + initials.

### Crypto ID generators (`src/components/drawings/MeasurementOverlay.tsx`, `src/pages/CreateProject.tsx`)
Two unguarded `Math.random()` uses in production ID generation replaced with `crypto.randomUUID()` and `crypto.getRandomValues()`. Six remaining `Math.random()` calls are all in `else` fallback branches after `crypto.*` checks — acknowledged defensive patterns.

---

## Quality Floor Outcome

- tsErrors: 0 (unchanged)
- eslintErrors: 0 (unchanged)  
- eslintWarnings: 1573 (unchanged)
- anyCount: 68 (improved from floor of 69)
- mockCount: 12 (unchanged)
- bundleSizeKB: ~3450 (unchanged)
- Math.random unguarded: 0

---

## Deferred

- **Playwright e2e sweep**: No internet access in sandbox; Playwright needs browser v1217, only v1194 cached at `/opt/pw-browsers/`. Visual verification done via code review. Re-run on next session with browser access.
- **Schedule integrity grade pill**: `IntegrityIssueList.tsx` exists but is not wired into the schedule page header. The "F grade" pill from prior punch list screenshots is not present in current code. Investigation needed — deferred to next dedicated session.

---

## What's Next

Lap 2 Day 31 work: drawer-gate seed (per LAP_1_CARRYOVER_PLAN) and IRIS telemetry migration (per IRIS_TELEMETRY_SPEC_2026-05-04.md — must land before Lap 2 Day 31).
