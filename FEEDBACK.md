# FEEDBACK.md — SiteSync PM Nightly Build Priorities
*Walker is calling GCs this week. Every overnight build must make the product more demoable.*
*Last updated: April 26, 2026 by Chief Product Strategist*
*Standard: A Fortune 500 GC's CTO opens this and thinks "this is better than the $80K/year Procore we use."*

---

## Status: BUILDER DID NOT RUN — Two Consecutive Nights With Zero Commits

Zero builder commits between April 25 and April 26. The last automated work was the massive 35+ commit wave on April 24-25. Since then, nothing. Math.random() is still at **28**. `as any` is still at **41**. WorkflowTimeline still has **0 references** in the codebase. The quality-floor.json shows `mockCount: 31` and `anyCount: 41` — the ratchet is not enforcing.

Walker is calling GCs. The Budget page (Demo Step 5) still shows different trend lines on every page refresh because of `Math.random()` in SCurve.tsx, BudgetKPIs.tsx, and ScheduleKPIs.tsx. This is the most visible, most embarrassing bug in the product. Every night it persists is a night wasted.

The priorities below are carried forward for the NINTH consecutive night for Mock Data and the SECOND consecutive night for WorkflowTimeline and `as any`. They are unchanged because they remain the correct priorities — nothing else matters until a GC can refresh the Budget page without seeing numbers dance.

---

## Tonight's P0 Priorities (April 26 -> April 27 2am CDT)

### 1. MOCK DATA ELIMINATION — KILL ALL 28 Math.random() CALLS (NIGHT NINE — UNCHANGED, STILL CRITICAL)
**SPEC ref:** P0-1 (Mock Data Elimination — 0% complete, blocks every investor demo and GC call)
**Files to change (28 occurrences — identical to last night, zero progress):**
**DEMO KILLERS (fix first — these are visible in the 6-step demo flow, 9 occurrences across 5 files):**
- `src/components/budget/SCurve.tsx:282` — fake budget variance `0.95 + Math.random() * 0.1` changes on every reload
- `src/pages/budget/BudgetKPIs.tsx:134,139` — fake spend/committed trend data with random noise
- `src/pages/schedule/ScheduleKPIs.tsx:95-98` — 4 lines of fake schedule forecast data
- `src/pages/Procurement.tsx:1141` — random PO numbers on conversion `PO-${2045 + Math.floor(Math.random() * 10)}`
- `src/pages/payment-applications/index.tsx:299` — `String(Math.random())` as fallback ID
**ID GENERATION (mechanical fix — 19 occurrences across 15 files):**
- `src/components/drawings/MeasurementOverlay.tsx:83`
- `src/components/drawings/DrawingTiledViewer.tsx:331`
- `src/components/drawings/AnnotationCanvas.tsx:39`
- `src/components/shared/PhotoAnnotation.tsx:84`
- `src/components/shared/DrawingMarkup.tsx:100`
- `src/components/shared/Whiteboard.tsx:109`
- `src/components/shared/FileDropZone.tsx:32`
- `src/components/submittals/SubmittalCreateWizard.tsx:527`
- `src/components/punch-list/PunchItemCreateWizard.tsx:573,608` (2 occurrences)
- `src/hooks/useRealtimeInvalidation.ts:48,118` (2 occurrences)
- `src/hooks/usePermissions.ts:272`
- `src/lib/scheduleHealth.ts:86`
- `src/pages/whiteboard/WhiteboardPage.tsx:26`
- `src/pages/drawings/index.tsx:808,937,1049,1108` (4 occurrences)
**What to do:**
1. **Demo-killing fakes (9 occurrences across 5 files — fix these FIRST):**
   - `SCurve.tsx:282` — `0.95 + Math.random() * 0.1` generates fake budget variance. Replace with: query real `actual_amount` from `budget_line_items` grouped by `period_date`. If no actuals exist, render only the planned line with label "Actuals will appear as costs are recorded." Use integer cents (LEARNINGS.md).
   - `BudgetKPIs.tsx:134,139` — Fake spend/committed trend lines with `Math.random() * spent * 0.02`. Replace with: query actual monthly spend from `budget_line_items` grouped by month. If insufficient data, show only data points that exist — no synthetic noise. A chart with 2 real data points beats 7 fake ones.
   - `ScheduleKPIs.tsx:95-98` — 4 lines generating fake schedule forecast data. Replace with: query real task completion data from `tasks` or `schedule_activities` grouped by week. If no data, show empty state: "Schedule data will appear as activities are tracked."
   - `Procurement.tsx:1141` — random PO numbers. Replace with deterministic: `PO-${req.id.slice(0,8).toUpperCase()}`.
   - `payment-applications/index.tsx:299` — `String(Math.random())` fallback. Replace with `crypto.randomUUID()`.
2. **Mechanical ID generation fix (19 remaining occurrences across 15 files):** Every `Math.random().toString(36).slice(...)` -> `crypto.randomUUID().slice(0, N)` where N matches the original slice length. Every standalone `Math.random()` for ID purposes -> `crypto.randomUUID()`. This is a 30-second fix per file — no logic changes needed.
3. **Exceptions:** `IntelligenceGraph.tsx` uses Math.random() for force-directed graph physics — visual algorithm, not mock data. Leave as-is.
4. **Verify:** `grep -rn "Math\.random" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | grep -v "IntelligenceGraph" | wc -l` returns 0.
5. **Update `.quality-floor.json`:** set `mockCount` to 1 (IntelligenceGraph exception only).
6. **Commit:** `git add -A && git commit -m "fix(P0-1): eliminate all 28 Math.random calls — crypto.randomUUID + real data queries [auto]"`
**Done looks like:** `grep -rn "Math\.random" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | grep -v IntelligenceGraph | wc -l` returns 0. Budget S-Curve shows only planned line when no actuals exist. BudgetKPIs and ScheduleKPIs show real data or clean empty states — no random noise. PO numbers are deterministic. `.quality-floor.json` `mockCount` = 1.
**WHY:** This is night NINE. The count has been 16 -> 26 -> 28 -> 28 (stalled). The 9 demo-killing fakes are the real emergency: SCurve.tsx:282 generates a random variance multiplier that makes the budget burn chart show different values on every page load. BudgetKPIs.tsx adds random noise to trend lines. ScheduleKPIs.tsx fabricates forecast data from thin air. A GC CTO who refreshes the page and sees numbers change will walk out of the demo. The 19 ID-generation fixes are a mechanical find-and-replace — literally `sed -i 's/Math.random().toString(36)/crypto.randomUUID()/g'` with minor cleanup. Total effort: under 2 hours for all 28 fixes. Do it first. Do it completely. Verify with the grep command. Then move on.

### 2. WORKFLOWTIMELINE COMPONENT + RFI DETAIL WIRING — THE COMPOUNDING PLAY (CARRIED FORWARD)
**SPEC ref:** P0-6 (State Machine Handler Completion — 0% complete) + P1-2 (RFIs — 35% complete)
**Files to change:** `src/components/WorkflowTimeline.tsx` (CREATE — still absent, 0 references in codebase), `src/pages/rfis/index.tsx` or wherever the RFI detail view lives, `src/machines/rfiMachine.ts`
**What to do:**
1. **Create `src/components/WorkflowTimeline.tsx`** — horizontal stepper component:
   - Props: `states: string[]`, `currentState: string`, `completedStates: string[]`, `onTransition?: (nextState: string) => void`
   - Renders each state as a step with connecting lines. Completed states show checkmarks (green circle, white check icon). Current state is highlighted (brand blue, pulsing dot). Future states are gray with muted labels.
   - Use inline styles with theme tokens (ADR-003). 56px minimum touch targets (LEARNINGS.md — already enforced elsewhere).
   - Responsive: horizontal on desktop (>768px), vertical stack on mobile (<768px).
   - Accessible: `role="progressbar"`, `aria-valuenow` set to current step index, `aria-valuemin=0`, `aria-valuemax` set to total steps. Each step has `aria-label="Step N: [state name] - [completed|current|upcoming]"`.
   - This component is reusable across Submittals, Change Orders, Pay Apps, Punch Items — building it once enables 5 workflows. That's the compounding play.
2. **Verify `src/machines/rfiMachine.ts` has complete handlers.** The machine exists — verify:
   - All 5 transitions have guards checking user permission
   - Each transition writes to `activity_log` with `{ from_state, to_state, actor_id, timestamp }`
   - Invalid transitions throw a typed error, not a silent no-op
   - If any handler is a stub, complete it now
3. **Wire the RFI detail page:**
   - Top of detail view: `<WorkflowTimeline states={['draft','submitted','under_review','responded','closed']} currentState={rfi.status} />`
   - Action buttons computed from the machine's available events for current state. `draft` -> "Submit" only. `submitted` -> "Start Review" only. Never show unavailable transitions.
   - Each button click: fire machine event -> optimistic UI update -> Supabase persist -> rollback + toast on error
   - Activity feed at bottom: query `activity_log WHERE resource_type='rfi' AND resource_id=rfi.id ORDER BY created_at DESC`
4. **Commit:** `git add -A && git commit -m "feat(P0-6): WorkflowTimeline component + wire to RFI detail page [auto]"`
**Done looks like:** Open any RFI detail page. See the horizontal WorkflowTimeline showing current status visually. Action buttons match available transitions only. `grep -rn "WorkflowTimeline" src/ | wc -l` returns >= 3. Component renders cleanly at 768px (iPad) and 375px (iPhone).
**WHY:** This is the demo differentiator. Procore shows RFI status as a text dropdown in a crowded toolbar. SiteSync shows a visual journey — a superintendent glances at the screen and knows exactly where the RFI is in its lifecycle. The WorkflowTimeline component is reused across RFIs, Submittals, Change Orders, Pay Apps, and Punch Items. One component, five workflows. That's the compounding play that makes every subsequent feature cheaper to build. Every night this doesn't exist is five pages without their signature UI. Build it tonight.

### 3. `as any` CLEANUP — DROP FROM 41 TO UNDER 10 (CARRIED FORWARD)
**SPEC ref:** P0 Quality Gates (Zero `as any` — currently 41 violations), DECISIONS.md ADR-001 (TypeScript strict mode, no `any` casts in production code)
**Files to change:** Run `grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | grep -v node_modules` and fix each one.
**What to do:**
1. **Audit all 41 `as any` casts.** Categorize each:
   - **Type assertion fixable** (most common): `data as any` where the real type is known or inferrable. Replace with the correct type from `src/types/entities.ts` or define one.
   - **Supabase response typing**: `supabase.from('table').select()` returns `any` by default. Use the typed pattern: `supabase.from('rfis').select('*').returns<RFI[]>()` or use the `fromTable<T>()` helper if it exists.
   - **Third-party library gaps**: Some libraries have incomplete types. For these, create a `src/types/vendor.d.ts` with proper declarations rather than casting to `any`.
   - **Genuinely dynamic**: If a value is truly unknown at compile time (e.g., JSON.parse output), use `unknown` with a type guard or Zod parse — never `any`.
2. **Priority order:** Fix the `as any` casts in demo-path files first: Dashboard, RFIs, Budget, PaymentApplications, DailyLog, Procurement. Then sweep remaining files.
3. **Verify:** `grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | grep -v node_modules | wc -l` returns < 10 (stretch: 0).
4. **Update `.quality-floor.json`:** set `anyCount` to the new lower number.
5. **Commit:** `git add -A && git commit -m "fix(quality): eliminate as-any casts with proper typing [auto]"`
**Done looks like:** `as any` count under 10. Zero `as any` in any demo-path file. `.quality-floor.json` `anyCount` updated. TypeScript still compiles with 0 errors (`npx tsc --noEmit` clean).
**WHY:** 41 `as any` casts is a 40x regression from the quality floor target of 1. Every `as any` is a runtime crash hiding behind a compile-time lie. The quality ratchet in `.quality-floor.json` shows `anyCount: 41` — meaning the floor was raised to match reality instead of enforcing the standard. Clean this up now so the ratchet can start protecting again. Focus on demo-path files first: if the CTO opens F12 during the demo and sees a type error in the console because a Supabase response was cast to `any` and a property was undefined, the sale is dead.

---

## Completed Archive

### April 25-26: BUILDER DID NOT RUN — Zero Commits
- **Status:** No builder activity. Zero automated commits between April 25 and April 26.
- **Priorities carried forward:** All 3 priorities (Math.random elimination, WorkflowTimeline, `as any` cleanup) unchanged.
- **Metrics unchanged:** Math.random: 28. `as any`: 41. WorkflowTimeline references: 0.
- **Impact:** Two consecutive nights without builder activity. The massive April 24-25 wave remains the last automated work.

### April 24-25: BUILDER RESURRECTION — 35+ Commits, Massive Feature Wave
- **Status:** Builder came back online. Most productive stretch in project history.
- **Commits:** `823b004` through `2b03f6c` (35+ commits in ~24 hours)
- **What shipped:**
  - Wave 1 data-layer hooks for 12 domains + page wiring
  - Real PDF generation for reports (owner, discrepancy, drawing, scale-audit)
  - PDF viewer + markup tools + tiled renderer for Drawings
  - AI copilot wired to edge function + real tool handlers
  - Daily log real PDF export via @react-pdf/renderer
  - Onboarding wizard wired to project creation + team invite
  - IFC 3D viewing end-to-end via web-ifc WASM
  - Schedule: real data + drag-to-persist + AI risk panel + Lookahead forecast
  - Closeout: warranties + O&M docs + punch linkage + sign-offs
  - Estimating: line items + bid submissions + rollups + precon absorption
  - Pay apps: lien waivers + retainage ledger end-to-end
  - Contracts: vendors + COI expiry + retainage rollup
  - Dashboard: absorb Tasks, Portfolio, Carbon, Site Map, Compliance
  - Budget: absorb Financials + Cost Management + period close
  - Files/Procurement/Reports: absorb transmittals, specs, wiki, deliveries, owner-portal
  - Offline: audited mutations routed through sync queue
  - Integration tracking: Procore/Sage/QuickBooks/BIM360/Aconex
  - Critical-path integration tests for RFI, punch, pay-app, offline capture
  - Realtime: live RFI/Punch/Submittal cache invalidation
  - Notifications: realtime notification center with click-through
  - Period locking: period-closed banner + edit lock on change-orders + pay-apps
  - Mobile: 56px touch targets + PWA manifest + service-worker polish
  - Accessibility: route-level error fallback + color-contrast + focusable regions
  - Security: RLS audit report + FORCE ROW LEVEL SECURITY patch migration
  - Tests: smoke tests for every route + critical-flow integration tests
  - Performance: bundle code-split + web-vitals reporting
  - Lint cleanup across 6 files
- **Impact:** The codebase went from "demo prototype" to "enterprise platform" in one night. TypeScript: 0 errors. Routes: smoke tested. RLS: force-enabled. Offline: queued. Realtime: invalidating.
- **What did NOT get done:** Math.random elimination (count grew 26->28), WorkflowTimeline (still absent), `as any` cleanup (grew to 41). These are tonight's priorities.

### April 19-24: SIX CONSECUTIVE NIGHTS — BUILDER DISABLED, MOCK DATA REGRESSING
- **Status:** All priorities carried forward for 6 consecutive nights. Zero automated builder commits since April 18.
- **Root cause:** Commit `2a3a7df` disabled all scheduled workflow crons to halt API spend. The nightly builder never re-triggered.
- **One manual commit occurred:** `cc43d21` (April 22) — "feat(schedule): AI PDF import + world-class Gantt canvas" — but this commit ADDED 10 new Math.random() calls, increasing count from 16 to 26.
- **Impact:** mockCount at 26. WorkflowTimeline absent. ESLint warnings at 607. Dashboard KPIs not wired.

### April 17-18: Test Coverage Foundation + UX Polish (Phase A/B)
- **Completed:** 75 mutation hook tests, 51 page smoke tests, drift guard, CI workflow, vitest coverage config, skeleton loading states, 56px touch targets, no-hex-colors lint rule, harness detector
- **Commits:** 0a42b2c (Phase A), a2ba759 (Phase B), ed64e09 through 4ba340d (Phase A substeps)
- **Impact:** Coverage rose from ~20% to 43.2%. Touch targets now meet industrial gloved-use requirements.

### April 16-17: Security Hardening + Platform Audit
- **Completed:** Wrapped 26+ mutations in useAuditedMutation, 5 new Zod schemas, CO state machine guards, FormModal focus trap, platform-wide functional audit harness (55/55 pages @ 100% actionable)
- **Commits:** a66535e, df4e26d, 84af4a9, 4b23cfe through d618aeb
- **Impact:** Every mutation is now audited. Zod validation on core forms. Change order machine has proper guards.

### April 15-16: Crash Fixes + Entity CRUD Completion
- **Completed:** Fixed universal crash on project creation (null safety, auto-add creator to project_members, self-heal existing projects), scaffolded ChangeOrders page, completed CRUD for Vendors/Contracts/Permits/PayApps
- **Commits:** 0ae50df through 61cc0fe, ffa1075 through 4b23cfe
- **Impact:** App no longer crashes when creating a new project. All entity pages have full CRUD operations.

---

## Reference: Enterprise Demo Flow (unchanged from April 6 plan)

---

## THE STANDARD

This is not demo software. Demo software looks good for 10 minutes. Enterprise software is unbreakable under adversarial conditions: bad network, wrong permissions, concurrent users, unexpected input, partial failures. Every decision made this week must serve that standard.

The GC demo on April 15th is the proof point — but the bar is the CTO who presses F12, checks the Network tab, tries to break the RFI form, and asks "where are your audit logs?" Build for that person.

---

## THE DEMO FLOW (non-negotiable, enterprise-grade)

Six steps. Every step runs on real data, behind real auth, with real AI, with zero console errors.

**Step 1 — Dashboard** (`/dashboard`)
App loads in under 3 seconds. GC sees Riverside Tower: KPI tiles (% complete, open RFIs, budget burn %, schedule float in days), real-time activity feed (last 10 actions with actor + relative timestamp), and a weather widget pulled from the `weather` edge function using the project's lat/lon. Every number is live from Supabase. The dashboard auto-refreshes when a new RFI or task is created (Supabase realtime subscription). Zero mock data. Zero console errors.

**Step 2 — AI Copilot** (`/copilot` panel)
Walker types "What needs attention this week?" The UI shows a streaming word-by-word response (not a spinner). The `ai-copilot` edge function fetches real project context (open RFIs, overdue tasks, budget variance, schedule risk) and passes it to the LLM. The response names real items: "RFI-047 on the electrical drawings is 3 days overdue" — not generic platitudes. Cited items render as chips that navigate to the actual record. Response streams in under 8 seconds. No mock. No hardcoded strings.

**Step 3 — RFI Workflow** (`/rfis/new` -> `/rfis/:id`)
Walker creates an RFI. Form validated with Zod before any network call. On submit: Supabase insert -> state machine fires `SUBMIT` event -> status transitions `draft -> submitted` -> `ball_in_court` updates -> activity log entry written -> toast confirms. Walker clicks "Mark Under Review" -> `submitted -> under_review`. Walker clicks "Approve" -> `under_review -> responded -> closed`. Every transition is enforced by the XState machine; invalid transitions throw typed errors, never silently succeed. Status badge on the detail page reflects real DB state via realtime subscription.

**Step 4 — Daily Log** (`/daily-logs/new`)
Walker taps the mic (64x64px button, minimum). Recording starts with a red pulse animation. Web Speech API transcribes in real-time (word by word as Walker speaks). On stop, the transcript populates the notes field. Entry saves to `daily_logs` with transcript, date, weather snapshot, and manpower count. Appears immediately at top of log list via realtime subscription. If microphone permission is denied, a clear actionable error is shown — not a silent failure.

**Step 5 — Budget** (`/budget`)
Six-figure budget summary: original contract, approved COs, revised contract, billed to date, cost-to-complete, variance. All live from Supabase. Line items table: Category | Budgeted | Actual | Committed | Variance — with red/green coding. Recharts stacked bar chart (budgeted vs actual by category). Virtualized if > 50 rows. CSV export button. No hardcoded numbers anywhere.

**Step 6 — Payment Application** (`/payment-applications/new`)
Click "New Pay App." G702 summary pre-populates from `schedule_of_values` + `change_orders`. G703 continuation sheet renders every SOV line item: Item No | Description | Scheduled Value | Prev Billings | This Period (editable) | Stored | Total | % | Balance | Retainage. Totals auto-calculate on keystroke. "Save Draft" commits to DB. "Export PDF" generates a clean AIA-formatted PDF (not print-to-PDF — real PDF generation via `@react-pdf/renderer` or equivalent). Every SOV row pre-filled before the GC touches anything.

---

## Ongoing Rules (apply to every session, every run)

**Session startup (non-negotiable — takes 5 minutes, saves hours):**
```bash
# 1. Read AGENTS.md — defines constraints and tooling
cat AGENTS.md

# 2. Read LEARNINGS.md migration safety section
cat LEARNINGS.md

# 3. Understand what yesterday's session did
git log --oneline -10
git diff HEAD~1 --stat

# 4. Check current quality floor
npm run build 2>&1 | tail -5
npm run lint 2>&1 | grep " error " | wc -l
npm test -- --run 2>&1 | tail -5
```
Never skip this. The organism has no memory. This is its memory.

**Mock data — zero tolerance:**
- If any demo page shows a value from `MOCK_`, `demoData`, a hardcoded constant, `Math.random()`, or a `TODO` comment — it is a blocking bug.
- Mocks are acceptable only in unit test files (`*.test.ts`, `*.spec.ts`).
- `IntelligenceGraph.tsx` is the sole exception (physics simulation, not mock data).

**Quality gates before every commit:**
```bash
npx tsc --noEmit       # Zero TS errors
npm run lint --quiet   # Zero errors
npm test -- --run      # Zero regressions
```

---

*Mission: every overnight build moves the product closer to the moment a GC CTO says "cancel Procore."*
*Build for the superintendent who has 30 seconds and dirty gloves. Build for the CTO who opens F12.*
