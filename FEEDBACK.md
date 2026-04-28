# FEEDBACK.md — SiteSync PM Nightly Build Priorities
*Walker is calling GCs this week. Every overnight build must make the product more demoable.*
*Last updated: April 28, 2026 (strategist priorities refresh)*
*Standard: A Fortune 500 GC's CTO opens this and thinks "this is better than the $80K/year Procore we use."*

---

## ⚙️ Loop directive (READ ON EVERY SCHEDULED WAKE-UP)

This file is loaded by the hourly autonomous polish agent. Walker's
explicit instruction:

> Don't just wake up and build new features each time. Use Playwright
> to do e2e verification of each page and the entire workflows.

**Default order of work for every loop iteration:**

1. **Read `VISION.md`, `ROADMAP.md`, this file, `.quality-floor.json`,
   `POLISH_PUNCH_LIST.md`, recent `git log`.** Understand what landed in
   the last 1–2 sessions before touching anything.

2. **Run the Playwright sweep.** All 28 `e2e/page-N-*.spec.ts` × iPhone /
   iPad / desktop. Background it, then triage screenshots.
   ```
   POLISH_USER='wrbenner23@yahoo.com' POLISH_PASS='fu2zyWire20!' \
     npx playwright test --config=playwright.polish.config.ts --project=page-e2e
   ```

3. **Fix what you find. Verify each fix.** Re-run the affected spec to
   confirm the screenshot now shows the issue gone. No fix is "done"
   without a fresh capture.

4. **Verify the floor before committing.** `tsc --noEmit` clean, build
   clean, `Math.random()` count = 0, `as any` count must NOT exceed
   `.quality-floor.json` `anyCount`.

5. **One PR per session.** Branch `auto/polish-{YYYYMMDD-HHMM}`. Commit
   message specific. PR body lists every issue + screenshot evidence.

**Do NOT in any loop iteration:**

- Add new features unless a `ROADMAP.md` milestone is genuinely
  unblocked AND the polish punch list is empty.
- Touch `supabase/migrations/`, `.env*`, `docs/legal/`, or dependency
  versions.
- Force-push, amend shared commits, or skip pre-commit hooks.
- Commit `polish-review/`, `playwright-report/`, `test-results/`, or
  `node_modules/`.
- Mark a task done without a verifying screenshot.

**If you find nothing actionable** after a thorough triage: commit a
`polish-audit-clean-{timestamp}.md` log noting what you checked and why
nothing needed work. Honesty beats make-work.

---

## Status: vision substrate landed (April 27 evening session)

The April 27 deep-work pass shipped the substrate for "Iris that ACTS,
not chats" — `drafted_actions` migration, type-safe payload union,
draft/execute services, three executor handlers (RFI / Daily Log /
Pay App), tool definitions for the LLM loop, the Iris Inbox page at
`/iris/inbox`, the EntityHistoryPanel (audit-log-as-product), the
field-super telemetry table + PMF dashboard tile, and the demo-story
arc seed.

Polish floor at end of session:
- **Math.random()**: 0 (was 28)
- **`as any`**: 6 (was 41; verified 6 are legitimate third-party gaps)
- **WorkflowTimeline references**: 7 (RFI Detail + Pay App Detail wired)
- **TypeScript errors**: 0
- **Build**: clean

The three P0 priorities from the previous FEEDBACK.md are all met.

---

## Tonight's P0 Priorities (April 28 -> April 29 2am CDT)

### 1. iPAD SIDEBAR LAYOUT FIX — ONE CSS CHANGE, 25+ PAGES FIXED
**SPEC ref:** P0-2 (WCAG 2.1 AA Accessibility — 0% complete) + P1-1 (Dashboard — 40% complete) + all demo-path pages
**Files to change:** `src/components/layout/AppLayout.tsx` (or wherever the main content wrapper + sidebar coexist), `src/components/layout/Sidebar.tsx`
**What to do:**
1. **Identify the main content wrapper.** The sidebar is 240px fixed/absolute positioned. The main content area does NOT offset by sidebar width on iPad (768px–1024px). This causes every page title, KPI card, and table to be clipped under the sidebar on iPad.
2. **Fix:** Add `margin-left: 240px` (or `padding-left: var(--sidebar-width)`) to the main content wrapper at screen widths ≥ 768px where the sidebar is visible. Use inline styles with theme tokens per ADR-003. If the sidebar collapses on mobile (<768px), ensure the margin is 0 at that breakpoint.
3. **Alternative approach:** If the sidebar is an overlay on iPad, switch it to a collapsible drawer that pushes content (triggered by hamburger icon). Pick whichever approach is simpler and consistent with existing mobile behavior.
4. **Verify across ALL 28 page specs:** After the fix, every page should show full titles, full KPI cards, and no clipped content at 768px and 1024px widths. Run:
   ```
   POLISH_USER='wrbenner23@yahoo.com' POLISH_PASS='fu2zyWire20!' \
     npx playwright test --config=playwright.polish.config.ts --project=page-e2e --grep="ipad"
   ```
5. **Spot-check critical pages manually:** Dashboard, RFIs, Budget, Pay Apps, Schedule — take iPad screenshots, compare to POLISH_PUNCH_LIST.md evidence.
6. **Commit:** `git add -A && git commit -m "fix(layout): offset main content by sidebar width on iPad — fixes 25+ pages [auto]"`
**Done looks like:** Open any page at 768px width. Page title is fully visible. KPI cards are not clipped. Table columns start after the sidebar, not under it. `POLISH_PUNCH_LIST.md` "iPad layout systematically broken" section can be marked resolved.
**WHY:** This is the single highest-leverage fix in the entire codebase right now. Walker demos SiteSync on iPad to GCs on job sites. Every single page is broken on iPad — titles show "...sing" instead of "Merritt Crossing," KPI cards are hidden under the sidebar, table rows are clipped. One CSS change to the layout wrapper fixes all 25+ authenticated pages simultaneously. A GC who sees a broken iPad layout during a demo doesn't get to the features — they see "not ready for production." Fix this first. Everything else is irrelevant if the iPad layout is broken.

### 2. STUCK SKELETON LOADING RESOLUTION — BUDGET, CREWS, AND DRAWINGS NEVER LOAD
**SPEC ref:** P1-1 (Dashboard — 40%), P1-6 (Budget — 30%), P1-8 (Drawings — 35%), Crews (25%)
**Files to change:** `src/pages/budget/Budget*.tsx` (or budget index), `src/pages/crews/index.tsx` (or Crews page), `src/pages/drawings/index.tsx`
**What to do:**
1. **Diagnose why these three pages are stuck on loading skeletons.** The POLISH_PUNCH_LIST confirms Budget shows "Loading financial data..." with skeleton cards indefinitely, Crews shows "Loading crews..." with six skeleton cards, and Drawings shows 8 skeleton sheet-cards that never resolve. Common causes:
   - The data-fetching hook (`useQuery`, `useBudgetData`, etc.) is failing silently — the query errors but the component only checks `isLoading`, not `isError`. Fix: add error state handling that renders the page with an error banner instead of eternal skeleton.
   - The query depends on a `projectId` that is null/undefined on initial render. Fix: add a guard that shows the empty state ("Select a project") instead of loading forever.
   - The Supabase query itself is failing (wrong table name, missing RLS policy, column mismatch). Fix: check the actual Supabase query response in the console.
2. **Apply the loading timeout pattern from LEARNINGS.md:** If loading persists > 5 seconds, force an error/fallback state. The pattern already exists in Dashboard (5s timeout from commit 9b66222) and ProtectedRoute (8s timeout). Apply the same `useLoadingTimeout(5000)` pattern to Budget, Crews, and Drawings.
3. **Verify each fix:** After fixing, each page should either (a) render real data if project has data, or (b) render a clean empty state ("No budget lines yet — import from CSV or add manually") if the project has no data. Never show an eternal skeleton.
4. **Test all three viewports:** iPhone (375px), iPad (768px), Desktop (1440px). Take screenshots.
5. **Commit:** `git add -A && git commit -m "fix(loading): resolve stuck skeletons on Budget, Crews, Drawings — timeout + error states [auto]"`
**Done looks like:** Navigate to Budget page → see either real data or empty state within 5 seconds. Same for Crews and Drawings. No page shows an infinite loading skeleton. Playwright captures at all 3 viewports show resolved content, not skeleton placeholders.
**WHY:** Budget is Demo Step 5. If the GC navigates to the Budget page and sees a loading spinner that never resolves, the demo is over. Crews and Drawings are in the top 10 most-visited pages for superintendents. These three stuck skeletons make the app feel broken even when the data layer is working. The fix pattern already exists in the codebase (LEARNINGS.md documents it). Apply the same 5-second timeout pattern. This is a 30-minute fix per page, not a rewrite.

### 3. PLAYWRIGHT E2E SWEEP — RUN ALL 28 PAGE SPECS, TRIAGE, FIX TOP 5
**SPEC ref:** P0-2 (WCAG — 0%), Quality Gates (e2ePassRate: 0), Loop Directive (run Playwright on every wake-up)
**Files to change:** `e2e/page-*.spec.ts` (read-only — just run them), then fix whatever breaks in `src/` files
**What to do:**
1. **Run the full Playwright page sweep** after fixing priorities 1 and 2:
   ```
   POLISH_USER='wrbenner23@yahoo.com' POLISH_PASS='fu2zyWire20!' \
     npx playwright test --config=playwright.polish.config.ts --project=page-e2e
   ```
2. **Triage the results.** For each failing spec, examine the screenshot evidence. Categorize failures:
   - **Layout broken** (likely fixed by priority 1) → confirm fixed, no action needed
   - **Data never loads** (likely fixed by priority 2) → confirm fixed, no action needed
   - **Functional regression** (button doesn't work, modal doesn't open, navigation broken) → fix the top 5 by severity
   - **Visual polish** (wrong spacing, misaligned text, color issues) → log in POLISH_PUNCH_LIST.md for next session
3. **Fix the top 5 functional regressions** found in the sweep. Focus on demo-path pages first: Dashboard, RFIs, Budget, Daily Log, Pay Apps. Each fix must be verified with a re-run of the affected spec.
4. **Update POLISH_PUNCH_LIST.md:** Mark resolved items from the critical section. Add any new issues found.
5. **Update `.quality-floor.json`:** If e2e pass rate is now measurably above 0, update `e2ePassRate` to the new floor.
6. **Commit:** `git add -A && git commit -m "fix(e2e): Playwright sweep — fix top regressions across demo pages [auto]"`
**Done looks like:** Playwright runs against all 28 page specs. Pass rate is measurably above 0 (target: >50% of specs green). Demo-path pages (Dashboard, RFIs, Budget, Daily Log, Pay Apps, Copilot) all pass their page specs. POLISH_PUNCH_LIST.md updated with current status. `.quality-floor.json` `e2ePassRate` updated.
**WHY:** The loop directive is explicit: "Don't just wake up and build new features each time. Use Playwright to do e2e verification." The e2ePassRate has been 0 since the specs were created. 28 page specs exist and have never been run in a verify-and-fix loop. After fixing the iPad layout (priority 1) and stuck skeletons (priority 2), a huge number of spec failures should clear automatically. The remaining failures reveal the actual bugs that need fixing before Walker puts this in front of GCs. This is the verification step that turns "code that was written" into "product that works."

---

## Completed Archive

### April 27-28: ALL THREE STRATEGIC PRIORITIES MET — MASSIVE QUALITY LEAP
- **Status:** The April 27 deep-work session ("Iris that ACTS" substrate + 38-phase polish push) completed all three priorities that had been carried forward for 10+ nights.
- **Math.random elimination: DONE.** Count went from 28 → 0 (excluding IntelligenceGraph physics exception). All demo-killing fakes in SCurve, BudgetKPIs, ScheduleKPIs, Procurement, and PaymentApplications replaced with real data queries or `crypto.randomUUID()`. `.quality-floor.json` `mockCount` = 1.
- **WorkflowTimeline component: DONE.** Created `src/components/WorkflowTimeline.tsx` (8.2KB, fully accessible). 7 references across the codebase — wired to RFI Detail and Pay App Detail pages. Horizontal stepper on desktop, vertical on mobile.
- **`as any` cleanup: DONE.** Count dropped from 41 → 6. Remaining 6 are verified legitimate third-party type gaps. `.quality-floor.json` `anyCount` = 6.
- **Bonus:** PermissionGate usage went from 0 → 328 across the app. Iris Inbox page, EntityHistoryPanel, drafted_actions infrastructure, field-super telemetry, and demo story arc seed all shipped.
- **Metrics after session:** Math.random: 0 | `as any`: 6 | WorkflowTimeline refs: 7 | TS errors: 0 | Build: clean
- **New blockers identified:** POLISH_PUNCH_LIST.md reveals iPad sidebar layout is broken across all 25+ pages (single CSS fix), and Budget/Crews/Drawings stuck on loading skeletons. These are tonight's priorities.

### April 26-27: BUILDER SHIPPED INFRASTRUCTURE — P0 PRIORITIES UNTOUCHED
- **Status:** 6 commits landed. All infrastructure/hardening. Zero P0 priority progress.
- **What shipped:** Phase 1 pilot-ready trust floor + demo project + idle timeout (#208), STRATEGY.md vision + /security trust-center page (#209), one-shot Procore→SiteSync project import (#211), MFA hard-force tier with 7-day grace (#212), shared PageState + loading/empty/error consistency (#213), +11 ApprovalChain component-render tests
- **Priorities carried forward:** All 3 priorities (Math.random elimination, WorkflowTimeline, `as any` cleanup) unchanged.
- **Metrics unchanged:** Math.random: 28. `as any`: 41. WorkflowTimeline references: 0.
- **Impact:** The platform is now more enterprise-hardened (MFA, trust center, Procore import). But the demo-killing bug — random numbers on every Budget page refresh — persists for the 10th consecutive night.

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
