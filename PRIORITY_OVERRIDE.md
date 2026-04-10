# PRIORITY OVERRIDE — Demo Sprint (April 10–14)

> This file overrides default experiment priorities for 5 nights only.
> Valid: April 10 through April 14. Demo: April 15.
> After April 14, revert to standard SPEC.md-driven prioritization.

---

## The Brutal Truth

After 3 nights of autonomous building, the score is:

| Metric | Count |
|--------|-------|
| Code quality improvements shipped | 16 |
| User-facing features shipped | 0 |
| Pages wired to Supabase | 14 of 44 |
| Pages showing real data | ~14 |
| Pages that are beautiful empty shells | 30 |
| AI Copilot calls to edge functions | 0 |
| Seed data loaded (112KB, Riverside Tower) | No |

A GC seeing this product today would see empty pages with excellent touch targets. The organism has been optimizing what it measures — type safety, eslint errors, test coverage — and those numbers are improving. But they are the wrong numbers.

The organism does not have a quality problem. It has a **feature shipping problem**.

---

## Experiment Mix — Demo Sprint

Every night from April 10–14, the Product Mind MUST produce experiments in this distribution:

| Category | Weight | What It Means |
|----------|--------|---------------|
| **FEATURE** | 70% | Wire pages to Supabase; ship visible functionality |
| **AI** | 15% | Connect AI features to edge functions |
| **QUALITY** | 10% | Only on demo-visible pages; no quality work on pages the GC won't see |
| **TESTING** | 5% | E2e demo flow test only |

If the Product Mind produces more than 15% QUALITY experiments, it has failed its directive. Reject the output and regenerate.

---

## Demo-Critical Pages (Priority Order)

### Tier 1 — Must be fully wired before anything else

#### 1. Dashboard (`/`)
**Current state:** 1 Supabase reference, majority static.
**Must show:**
- Project overview card with real project name, contract value, and start date from `projects` table
- Budget summary: contract value vs. spent vs. projected (from `budget_line_items` aggregation)
- Open RFI count with overdue highlighted (from `rfis` where `status != 'closed'`)
- Active punch items count (from `punch_list_items` where `status != 'complete'`)
- Schedule status indicator (days ahead/behind from `schedule_items`)
- Recent activity feed (from `audit_log` or `daily_logs`, last 5 entries)
**Wiring target:** At minimum 6 `useQuery` hooks pulling from real tables
**The test:** A GC should be able to read the health of the $52M Riverside Tower project in 10 seconds

#### 2. Submittals (`/submittals`)
**Current state:** 2 Supabase references, partial.
**Must show:**
- Full list of submittals from `submittals` table with status badges
- Filter by status (pending, approved, rejected, resubmit)
- Overdue submittals highlighted in red
- Count by status in header
**Wiring target:** Full list view with real data; no placeholder rows

#### 3. Punch List (`/punch-list`)
**Current state:** 0 Supabase queries. Currently an empty shell.
**Must show:**
- All items from `punch_list_items` table
- Grouped by location/zone or assignee
- Status filter (open, in-progress, complete)
- Priority indicators
- Item count in header
**Wiring target:** Complete list from `punch_list_items`; skeleton loading; empty state with "Add Item" CTA

#### 4. Tasks (`/tasks`)
**Current state:** 0 Supabase queries. Empty shell.
**Must show:**
- Tasks from `tasks` table (or equivalent)
- Assigned to / due date columns
- Status filter
- Overdue highlighting
**Wiring target:** Full list from database; real assignees from `profiles` join

#### 5. AI Copilot (`/ai-copilot`)
**Current state:** 0 edge function calls. UI-only mock.
**Must show:**
- Working chat interface
- User message → `supabase.functions.invoke('ai-copilot', { body: { message, projectId } })` → Claude response
- Response includes actual project context (budget, RFI count, schedule status pulled before calling Claude)
- Loading state while waiting for response
**This is the "wow" moment of the demo.** When the GC types "What are the biggest risks on this project right now?" and gets a specific, accurate answer about Riverside Tower — that is the moment he calls his operations director.
**Wiring target:** End-to-end message flow with real Claude response containing project-specific data

---

### Tier 2 — Wire after Tier 1 is complete

#### 6. RFIs (`/rfis`)
**Current state:** Has Supabase queries but needs audit.
**Must show:** Full list, overdue highlighted, filter by status and ball-in-court. Verify queries are correct and data is showing.

#### 7. Schedule (`/schedule`)
**Current state:** Has Supabase queries but needs audit.
**Must show:** Gantt or timeline view with real schedule items. Critical path items highlighted.

#### 8. Budget (`/budget`)
**Current state:** Has Supabase queries but needs audit.
**Must show:** Line items, variance from budget, forecast to complete. Real numbers from Riverside Tower seed data.

#### 9. Daily Log (`/daily-log`)
**Current state:** Has Supabase queries.
**Must show:** Most recent daily logs with weather, crew counts, work performed. Real entries from seed data.

#### 10. Change Orders (`/change-orders`)
**Current state:** Has Supabase queries.
**Must show:** CO list with status, amounts, and running total impact to contract.

---

### Tier 3 — Nice to have if Tiers 1–2 are complete

Directory, Safety, Drawings, Financials — these appear in a full demo but are not the make-or-break moments.

---

### Ignore Until After Demo

AIAgents, TimeMachine, Benchmarks, Sustainability, Marketplace, Estimating, OwnerPortal, Portfolio, Workforce, Onboarding, Insurance, Integrations, Permits, Procurement, Warranties — do not touch these pages. Do not improve their type safety. Do not add tests. Ignore them completely until April 15.

---

## What "Wire to Supabase" Means (Precise Definition)

A page is **wired** when ALL of the following are true:

1. It imports `useQuery` from `@tanstack/react-query` (or the project's equivalent hook)
2. It calls `supabase.from('table_name').select(...)` inside the query function
3. The component renders real data from the query result, not a static array
4. It renders a **loading skeleton** (not a spinner, not a blank screen) while `isLoading === true`
5. It renders a meaningful **empty state** with a CTA when the query returns zero rows
6. It renders an **error boundary or error message** when the query fails

A page that does steps 1–3 but skips the skeleton is 80% wired. Ship the skeleton too — a GC seeing a blank flash before data loads notices it.

**Verify command for any FEATURE experiment:**
```bash
grep -l "useQuery\|fromTable\|supabase.from" src/pages/[PageName].tsx
grep "fromTable\|supabase.from\|useQuery" src/pages/[PageName].tsx | head -20
```

---

## What "Wire AI Copilot" Means (Precise Definition)

The AI Copilot is wired when:

1. `AICopilot.tsx` calls `supabase.functions.invoke('ai-copilot', ...)` — NOT a mock, NOT a direct Anthropic call from the client
2. The edge function receives the message AND a `projectId`
3. The edge function fetches project context from Supabase before calling Claude:
   - Project name, contract value, status
   - Open RFI count and most overdue
   - Active punch items count
   - Budget variance
4. Claude receives this context in its system prompt
5. The response references specific Riverside Tower data
6. The UI shows a typing indicator while waiting
7. The UI renders the response in markdown if applicable

**Verify command:**
```bash
grep -r "functions.invoke\|ai-copilot" src/components/AICopilot.tsx
cat supabase/functions/ai-copilot/index.ts | head -60
```

---

## The Seed Data Problem

112KB of seed data exists at `supabase/seed.sql` representing the Riverside Tower project ($52M, active construction). It has NOT been loaded.

If no real data is flowing through a correctly-wired page, the first thing to check is whether the seed data has been applied. The organism should:
1. Check if `projects` table has rows: `SELECT count(*) FROM projects;`
2. If empty, apply seed: `psql $DATABASE_URL < supabase/seed.sql` (or via Supabase dashboard)
3. Re-verify pages after seed is applied

A wired page showing zero rows because seed data isn't loaded is not a victory.

---

## The AI Edge Functions

25 edge functions exist in `supabase/functions/`. They need `ANTHROPIC_API_KEY` set as a Supabase secret.

If AI experiments fail because the API key isn't set:
```bash
supabase secrets set ANTHROPIC_API_KEY=<key>
```

The key should already be in the environment or repository secrets. If not available, log the blocker in `FEEDBACK.md` and move on to FEATURE experiments.

---

## Nightly Success Criteria

At the end of each night, the organism should be able to answer YES to:

- [ ] Did at least 3 Tier 1 pages get wired to real data today?
- [ ] Can a human navigate to `/`, `/submittals`, and `/punch-list` and see real Riverside Tower data?
- [ ] Did AI Copilot get any closer to answering project-specific questions?
- [ ] Are all pages that were already wired still working (no regressions)?
- [ ] Is the DAILY_REPORT.md updated with what was actually shipped (not what was attempted)?

If the answer to any of these is NO, that is the priority for the next night — not code quality, not type safety, not eslint.

---

## The Coaching Note (Read This Last)

The organism is not failing because it's bad at code. It's failing because it's been given the wrong definition of success. Type safety IS important — on a page a user is going to see. Eslint errors DO matter — in a file that runs during a demo. But we have been fixing type errors in pages that don't even render real data.

You cannot polish an empty shell.

**Wire first. Polish second. The demo is in 5 nights.**
