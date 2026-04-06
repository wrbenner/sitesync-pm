# FEEDBACK.md — Founder Priorities

**Owner:** Walker Benner, Founder/CEO
**Injected into:** Every autonomous agent session as P0 priority
**Instructions:** Update this before running the organism. Clear it after each run. Be specific.

---

## Tonight's P0 Priorities

*Updated by Chief Product Strategist agent — 2026-04-05. Walker is calling GCs this week. Every priority is chosen to make the 10 minute demo flow flawless: Dashboard > RFI creation > RFI workflow > Submittals > Daily Log.*

1. MOCK DATA ELIMINATION ON THE SIX DEMO CRITICAL PAGES (P0-1). This is still the single biggest blocker and was not completed in the previous run.
   **Files to change:** `src/pages/RFIs.tsx`, `src/pages/Submittals.tsx`, `src/pages/PunchList.tsx`, `src/pages/DailyLog.tsx`, `src/pages/FieldCapture.tsx`, `src/pages/AICopilot.tsx`. Also fix mock data in these supporting files found by grep: `src/components/dashboard/widgets/CashFlowWidget.tsx`, `src/components/dashboard/widgets/LiveSiteWidget.tsx`, `src/pages/Safety.tsx`, `src/pages/Schedule.tsx`, `src/pages/Crews.tsx`, `src/pages/Meetings.tsx`.
   **What "done" looks like:** Each of the six P0-1 pages fetches real data from the corresponding Supabase table using existing React Query hooks (check `src/hooks/` for existing query hooks before writing new ones). When the table is empty, render a proper empty state component with an icon, a message like "No RFIs yet", and a Create button. During fetch, show a loading skeleton (use the existing `LoadingSkeleton` component if one exists, or create a minimal one). After completion, run `grep -r "Math.random\|faker\|mockData\|MOCK\|hardcoded" src/ --include="*.ts" --include="*.tsx"` and confirm zero results across ALL files, not just the six pages. The grep currently returns 20 files. Fix all 20.
   **Why this matters:** Fake data kills every demo. When Walker opens the app in front of a GC and the RFI list shows "John Doe" with random dates, the deal is dead. Real empty states are infinitely better than fake populated states. A superintendent will respect "No RFIs yet, create your first" but will never trust a tool showing obviously fabricated data.

2. RFI AND SUBMITTAL STATE MACHINE COMPLETION (P0-6, P1-2, P1-3). The three most visible workflows must work end to end.
   **Files to change:** Find the state machine definitions (likely in `src/machines/` or `src/lib/machines/` or colocated with pages). Key files: the RFI state machine, Submittal state machine, and their corresponding page components `src/pages/RFIs.tsx` and `src/pages/Submittals.tsx`. Also update `src/pages/ChangeOrders.tsx` if time permits.
   **What "done" looks like:** (a) RFI: a user can create a draft RFI, submit it (status changes to `submitted`), it moves to `under_review`, gets a response (`responded`), and closes (`closed`). Each transition validates with Zod, checks that the transition is valid per the state machine, updates the `rfis` table in Supabase, writes a row to `activity_log` with actor/timestamp/from_state/to_state, and shows a toast. Invalid transitions (e.g., trying to close a draft) return a typed error shown as a toast, not an unhandled rejection. (b) Submittal: same pattern for `draft > submitted > in_review > approved/rejected/revise_and_resubmit`. (c) The status badges on the list views update immediately after transition (optimistic update or cache invalidation). (d) Ball in court updates on each transition for both RFIs and Submittals.
   **Why this matters:** "Create an RFI and walk it through approval" is the first thing every GC evaluates. If the status badge doesn't change when they click "Submit", or if clicking "Approve" on a submittal throws a console error, SiteSync looks like a prototype. Procore's RFI workflow is rock solid and has been for 10 years. Ours must be equally reliable on day one. This is also the foundation for the AI copilot to suggest actions ("This RFI is 3 days overdue, want me to send a reminder?"), which is the leapfrog moment in the demo.

3. DASHBOARD KPI TILES AND ACTIVITY FEED WIRED TO REAL DATA (P1-1). The dashboard is the first screen every prospect sees.
   **Files to change:** `src/pages/Dashboard.tsx`, `src/components/dashboard/widgets/CashFlowWidget.tsx`, `src/components/dashboard/widgets/LiveSiteWidget.tsx`, and any other widget components in `src/components/dashboard/`.
   **What "done" looks like:** (a) The four KPI tiles (Open RFIs, Overdue Submittals, Budget Variance, Schedule SPI) each make a real Supabase aggregation query. Open RFIs = `select count(*) from rfis where project_id = X and status not in ('closed', 'void')`. Overdue Submittals = `select count(*) from submittals where project_id = X and required_date < now() and status not in ('approved', 'rejected')`. Budget Variance and Schedule SPI can show "N/A" or "$0" if no budget/schedule data exists yet, that is fine. (b) Each KPI tile has a loading skeleton during fetch and an error fallback. (c) The activity feed shows the last 20 entries from the `activity_log` table, displaying actor name, action description, entity type, and relative timestamp ("2 hours ago"). If no activity exists, show "No recent activity" with a subtle prompt. (d) CashFlowWidget and LiveSiteWidget no longer use Math.random() or hardcoded data. Either wire to real queries or show a clean empty state.
   **Why this matters:** The dashboard is SiteSync's first impression. A GC opens the app and sees four KPI cards with real zeros and an empty activity feed, they think "clean, ready for my data." They see random numbers and fake names, they think "toy." This is also where the AI advantage shows: once the activity feed is real, the next step (not tonight) is adding AI insights ("RFI #12 is approaching its 14 day SLA, architect hasn't responded"). The dashboard with real data is the foundation for every AI feature that follows. It strengthens Moat 3 (workflow habituation) and Moat 5 (proprietary data) simultaneously.

---

## Ongoing Priorities (injected every run)

These never clear. They represent your permanent product north star.

1. **Zero mock data** — The app must work with real Supabase data. If a feature requires data that doesn't exist, create the migration and seed it. Never show hardcoded names, numbers, or arrays.

2. **Field first UX** — Every interaction must work for a superintendent with dirty gloves on an iPad at a jobsite with slow internet. 44px touch targets. Offline first. Fast.

3. **Better than Procore on every page** — Before finishing any page, ask: "What does Procore do here? What don't they do? What should we do that they can't?" The answer goes in the implementation.

4. **AI woven in, not bolted on** — Every page should have an AI insight, suggestion, or prediction that a superintendent couldn't get from Procore. Not a chat widget — contextual intelligence.

5. **Never regress quality** — If you improve a metric (coverage, bundle size, error count), update .quality-floor.json. These floors never go down.

---

## Completed (archive)

*Move items here after they're verified complete by the verifier agent.*

- [x] 2026-04-05: Initial organism infrastructure created (SPEC.md, AGENTS.md, homeostasis.yml, etc.)

## Previous Priority History

### 2026-04-05 (First Run — Not Completed)
The following priorities were set but the nightly builder had not yet run:
1. MOCK DATA ELIMINATION (P0-1) — Carried forward and expanded with specific file list (20 files found by grep)
2. PERMISSIONGATE ON EVERY ACTION BUTTON (P0-3) — Deprioritized for tonight. Rationale: Walker's demos will use admin login. PermissionGate is critical for enterprise sales but not for the first GC demos this week. Will be P0 priority #2 or #3 in the next run after mock data and workflows are solid.
3. STATE MACHINE HANDLER COMPLETION (P0-6) — Carried forward, narrowed to RFI + Submittal (the two demo critical workflows). Change Order state machine is stretch goal.
