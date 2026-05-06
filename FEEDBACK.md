# FEEDBACK.md — SiteSync PM Nightly Build Priorities
*Walker is calling GCs this week. Every overnight build must make the product more demoable.*
*Last updated: April 29, 2026 (strategist priorities refresh)*
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

## Tonight's P0 Priorities (April 29 -> April 30 2am CDT)

### 1. iPAD SIDEBAR LAYOUT FIX — STILL THE #1 DEMO BLOCKER ACROSS 25+ PAGES
**SPEC ref:** P0-2 (WCAG 2.1 AA Accessibility — 0% complete) + P1-1 (Dashboard — 40% complete) + all demo-path pages
**Files to change:** `src/App.tsx` (grid layout), `src/components/Sidebar.tsx`, `src/styles/theme.ts`
**What to do:**
The April 28 session did NOT fix this. POLISH_PUNCH_LIST.md "iPad layout systematically broken" section is still unresolved despite 29 commits landing. The builder focused on service-level fixes (PostgREST 400s, maybeSingle, login flow) while the #1 visual blocker persisted. Fix it tonight.

**Current layout architecture:** `App.tsx` line ~600 uses CSS Grid: `gridTemplateColumns: '252px minmax(0, 1fr)'`. The Sidebar uses `position: sticky` in non-overlay mode. In theory this should work. In practice, POLISH_PUNCH_LIST screenshots at iPad width (768px–1024px) show every page title clipped behind the sidebar. Something is desynchronizing.

**Diagnosis steps:**
1. Run the app at 820px width (iPad Air) in Playwright or a browser. Take a screenshot of Dashboard. If the page title is clipped, the bug is confirmed.
2. Check whether `isMobile` (`max-width: 768px`) returns false at iPad widths. At 769px+, the desktop grid renders. At exactly 768px, MobileLayout renders (no sidebar). The breakpoint gap between 769px–1024px is where iPad lives and where content clips.
3. Check whether the Sidebar's `width: 100%` combined with `position: sticky` is actually respecting the grid track width, or if it's overflowing. Open DevTools → check computed width of the sidebar `<nav>` vs the first grid column.
4. **Most likely fix:** The Sidebar in overlay mode (`mode='overlay'`) explicitly sets `width: layout.sidebarWidth` (252px), but in non-overlay mode it sets `width: 100%`. If the grid track is somehow collapsing to 0 while the sticky sidebar still renders at 252px, the content column starts at x=0 and the sidebar covers it. Force the sidebar's grid column via `gridColumn: 1` and the main via `gridColumn: 2`.
5. **Alternative fix:** At the tablet breakpoint (769px–1024px), auto-collapse the sidebar to a 64px icon-only rail (like Notion/Linear). This frees ~190px for content and eliminates the clipping problem entirely. Add a `tabletCollapsed` state to `useUiStore` that triggers between 769px–1024px. The Sidebar already supports a collapsed rendering path — wire it to this breakpoint.
6. **Verify:** After the fix, run Playwright captures at 820px and 1024px for Dashboard, RFIs, Budget, Pay Apps, Schedule. Every page title must be fully visible. No KPI cards clipped. No table columns hidden.
7. **Commit:** `git add -A && git commit -m "fix(layout): resolve iPad sidebar content overlap — 25+ pages fixed [auto]"`

**Done looks like:** Open Dashboard at 820px width. "Merritt Crossing" title fully visible. All 4 KPI cards visible. Activity feed starts after the sidebar, not under it. Repeat for RFIs, Budget, Pay Apps.
**WHY:** Walker demos SiteSync on iPad to GCs on job sites THIS WEEK. Every single authenticated page is broken at iPad width. The builder has now skipped this fix for 2 consecutive nights. A GC who sees titles reading "...sing" and KPI cards hidden under the sidebar stops the demo. This is night 3 of asking — it must ship tonight.

### 2. STUCK SKELETON SWEEP — VERIFY SERVICE FIXES, APPLY TIMEOUT PATTERN TO REMAINING PAGES
**SPEC ref:** P1-1 (Dashboard), P1-6 (Budget — 30%), P1-2 (RFIs — 35%), P1-3 (Submittals — 30%), P1-9 (Punch List — 20%), P1-8 (Drawings — 35%), Crews (25%), Files (35%)
**Files to change:** Budget, Crews, Drawings, RFIs, Submittals, PunchList, Files page components + their data hooks
**What to do:**
The April 28 session fixed several underlying causes of stuck skeletons: PostgREST 400 on `project_members → profiles` join (`ce5b6ff`), notification preferences 406 (`117826e`), profile load 500 (`1d956ba`), and ran `supabase db push` to apply 9 pending migrations. The crawl went from 39→44 PASS. But POLISH_PUNCH_LIST.md still lists 10+ pages with stuck skeletons at initial capture. Some may now be fixed; others persist.

1. **Verification pass first.** Before changing any code, navigate to each page listed in POLISH_PUNCH_LIST "Stuck loading / skeleton placeholders" section and check if it now resolves within 5 seconds:
   - Budget → does it show data or empty state?
   - Crews → does it show crew cards or empty state?
   - Drawings → does it show drawing sheets or empty state?
   - RFIs → does it resolve past "Loading project — tasks (3/16)..."?
   - Submittals → does it resolve past skeleton cards?
   - Punch List → does it show items or empty state?
   - Files → does it show file list or empty state?
   Take screenshots of each at desktop width. Log which ones are fixed vs still stuck.

2. **For pages still stuck:** Apply the `useLoadingTimeout(5000)` pattern from LEARNINGS.md. The pattern exists in Dashboard (5s timeout from commit `9b66222`) and ProtectedRoute (8s timeout). For each stuck page:
   - Check if the data hook returns `isError` — if so, render error state with retry button
   - Check if `projectId` is null — if so, render "Select a project" empty state
   - Add a 5-second timeout that forces error/fallback state if loading persists
   - Ensure the fallback state is a clean empty state component, not a blank screen

3. **Kill the "Never synced" banner on initial load.** POLISH_PUNCH_LIST shows "Loading project — budget items (8/16)... · Never synced" across meetings, directory, time-tracking, and post-login landing. This banner makes every page look broken. Either: (a) hide it once the first entity finishes syncing, (b) convert it to a subtle progress indicator (dot or thin bar), or (c) remove it entirely during initial project load and only show sync status after the first successful sync completes.

4. **Commit:** `git add -A && git commit -m "fix(loading): resolve remaining stuck skeletons + kill Never-synced banner [auto]"`

**Done looks like:** Every page in the demo flow (Dashboard, RFIs, Budget, Daily Log, Pay Apps, Punch List, Drawings) loads real data or a clean empty state within 5 seconds. No page shows an infinite skeleton. No "Never synced" banner on fresh navigation. Playwright captures at all 3 viewports show resolved content.
**WHY:** The service fixes from April 28 likely cleared many stuck skeletons, but we don't know which without verification. The remaining stuck pages are demo-killers: Budget is Demo Step 5, RFIs is Demo Step 3, and a superintendent checking Punch List or Drawings will bounce if they see eternal loading. The timeout pattern is proven and takes 15 minutes per page. Verify first, then fix what's still broken.

### 3. MOBILE UX — TAB OVERFLOW FIX + BOTTOM NAV CONTENT OCCLUSION
**SPEC ref:** P0-2 (WCAG 2.1 AA — 0%), P1-9 (Punch List), Safety, Time Tracking, Contracts, Pay Apps
**Files to change:** Shared tab strip component (likely `src/components/Tabs.tsx` or similar), `src/components/layout/MobileLayout.tsx`, page-level scroll containers
**What to do:**
Two systematic mobile issues remain after the April 28 polish push. Both affect every iPhone demo.

**Issue A — Tab text collisions on pages with 5+ tabs:**
POLISH_PUNCH_LIST documents this as the "second most-visible mobile issue." Safety has 7 tabs that render as "Incidents Inspections Toolbox TalCertificatiosCorrective" — unreadable. Time Tracking shows "Timesheet Certified Payroll T&M Tickets Rates Payroll Export" with clipping. Contracts shows "Insurance" truncated to "Insuranc".

Fix: Find the shared tab/pill strip component used across these pages. Convert it to a horizontally scrollable container on mobile:
- `overflow-x: auto` with `-webkit-overflow-scrolling: touch`
- `white-space: nowrap` on the tab container
- Each tab gets `flex-shrink: 0` so it doesn't compress
- Add gradient fade on the right edge (the pattern was partially applied to Safety + PayApps in commit `2b2b852` — extend it to all tab strips)
- Minimum tab touch target: 56px height per LEARNINGS.md (gloved use)

**Issue B — Bottom nav + Iris FAB occlude page content on iPhone:**
POLISH_PUNCH_LIST shows the bottom 5-tab nav and the purple Iris FAB stacking on top of actual content: Dashboard punch-list card half-hidden, Safety empty-state illustration occluded, Daily Log bottom card covered, RFI "Send RFI" button half-blocked.

Fix: Add bottom safe-area padding to the main scroll container in `MobileLayout.tsx`:
- Calculate: bottom nav height (64px per line 955 of Sidebar.tsx) + FAB size (~56px) + 16px breathing room = ~136px
- Apply `paddingBottom: 136px` to the scroll container wrapping page content in MobileLayout
- For modals that have action buttons at the bottom (like "Send RFI"), ensure the button sits above the bottom nav via `bottom: calc(64px + env(safe-area-inset-bottom) + 16px)`

Verify: Take iPhone screenshots of Dashboard (scrolled to bottom), RFIs (form filled), Safety (empty state), Daily Log. No content hidden behind nav or FAB.

**Commit:** `git add -A && git commit -m "fix(mobile): scrollable tab strips + bottom-nav safe padding [auto]"`

**Done looks like:** Open Safety page on iPhone — all 7 tabs readable, horizontally scrollable with gradient hint. Scroll Dashboard to bottom on iPhone — punch list card fully visible above the bottom nav. Open RFI creation form — "Send RFI" button fully visible and tappable above bottom nav.
**WHY:** Walker is demoing on both iPad and iPhone to GCs this week. After fixing iPad layout (priority 1) and stuck skeletons (priority 2), the remaining demo-killers are these two mobile UX issues. Tab text collisions make multi-section pages like Safety, Time Tracking, and Contracts look amateurish. Content hidden behind the bottom nav makes the app feel unfinished. Both are systematic fixes to shared components — one change to the tab strip component fixes every page that uses tabs, one change to MobileLayout fixes every page's bottom padding. High leverage, low risk.

---

## Completed Archive

### April 28-29: MASSIVE CRAWL PROGRESS (39→44/45 PASS) BUT iPAD LAYOUT STILL BROKEN
- **Status:** 29 commits landed. Crawl went from 39 PASS / 6 WARN to 44 PASS / 1 WARN / 0 FAIL across 45 routes. The builder was highly productive on service-level bugs and polish but did NOT address the iPad sidebar layout fix (priority 1) or stuck skeleton timeout pattern (priority 2).
- **What shipped:**
  - Login flow rebuilt: password sign-in, Google + Microsoft OAuth, magic-link, rate-limit error surfacing, Vite base path redirect fix, Threshold minimalism polish
  - Service fixes: PostgREST 400 on project_members→profiles join split into two queries, notification preferences maybeSingle, profile load maybeSingle, vendor UUID guard, auto-create profile row on auth.users insert
  - Demo polish (commit `2b2b852`): Closeout % rendering, Schedule health pill de-escalated, workforce/contracts permission gates corrected, Reports status filter aligned to CHECK constraint, Daily Log weather formatting, Dashboard /100 denominators, Equipment/Workforce 0-value delta suppression, Crews empty state, Budget "Over by $X" negative display, tab scroll affordance on Safety/PayApps
  - Features: Drawings side-by-side revision compare, Workforce demo-tagged tabs, Reports Generate CTA pre-selection
  - Verification: a11y reporter enhanced with target selectors, full crawl audit x2
  - Migration: renamed collided migration + rewired invite email to deployed send-invite
- **What did NOT get done:** iPad sidebar layout fix (still broken across all 25+ pages), stuck skeleton timeout pattern (service fixes may have resolved some but not verified), Playwright e2e sweep (crawl system used instead — e2ePassRate still 0 in quality floor)
- **Metrics:** Crawl: 44/45 PASS. TypeScript: 0 errors. `as any`: 6. mockCount: 1. Build: clean.

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
