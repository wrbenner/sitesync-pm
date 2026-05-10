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

---

## Addendum — Session 2 audit (2026-05-10, PR #409 branch)

A second autonomous session ran a full code audit against the punch list generated 2026-04-27. Findings:

**Verified already fixed (no action needed):**
- Profile avatar `?` placeholder → initials already implemented (`UserProfile.tsx`)
- `QUALITY 0` missing `/100` → `DashboardProjectHealth.tsx` already shows `{sub.value}/100`
- `%` superscript in Closeout KPI → `MetricBox` already renders `%` inline at value font size
- Faded primary buttons → `Primitives.tsx` already uses `surfaceDisabled`/`textDisabled` on disabled state
- OfflineBanner "Never synced" → replaced with compact pill + "Setting up your workspace…"
- Safety in-page tab overflow → already has `overflowX: 'auto'` + `flexShrink: 0`
- MobileTabBar iPhone overflow → 4-tabs + More pattern avoids it
- Budget `$-500` display → already renders `−$500` + "Over budget" label
- Delete account modal clipped → sticky footer pattern already in place
- Meetings template modal clipped → sticky action footer already in place
- Equipment "+1% from 0" → page redesigned, no delta pills on 0-value KPIs
- Schedule F-grade pill → `ScheduleHealthPanel` not rendered in schedule page header

**New fix in this session:**
- `IrisScheduleRiskBanner.tsx`: replaced `(error as Error).message` with static user-facing copy — removes unsafe cast, prevents internal Supabase error strings leaking to demo users.

**Quality floor after this session:**
- tsErrors: 0, eslintErrors: 0, anyCount: 68 (floor 69), Math.random unguarded: 0, @ts-ignore: 0

---

## What's Next

Lap 2 Day 31 work: drawer-gate seed (per LAP_1_CARRYOVER_PLAN) and IRIS telemetry migration (per IRIS_TELEMETRY_SPEC_2026-05-04.md — must land before Lap 2 Day 31).
