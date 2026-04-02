# Engine Priorities

Update this file every morning before the next run. The engine reads it before every audit
and treats everything here as P0 — higher priority than anything else it finds.

---

## Current Run Focus (Night 2)

The engine now has full stack capability: Supabase backend, edge functions, E2E tests,
and auto-deploy. This run should focus on WIRING REAL DATA. The frontend is beautiful
but still runs on mock data. The Supabase schema is deployed. The hooks exist. Connect them.

### P0: Wire Supabase to the Frontend
- Replace ALL mock data imports in pages with real useSupabase hooks
- Every list page (RFIs, Submittals, Punch List, Daily Log, etc.) should query Supabase
- Every form should write to Supabase via the typed hooks
- Real time subscriptions should be active on RFIs, daily logs, punch list, and notifications
- When the database is empty, show helpful empty states that guide the user to create their
  first item, not blank tables

### P1: Authentication Flow
- The Login page exists but needs to actually call supabase.auth.signInWithPassword
- The Register/Signup page needs to create the user AND their profile record
- After login, the authStore should be populated and the sidebar should show the user's name
- Protected routes: if not authenticated, redirect to /login
- Role based visibility: hide admin pages from non-admin users

### P2: Backend Integration Quality
- Every mutation should use optimistic updates (update UI immediately, revert on error)
- Error handling: show toast notifications on API failures, not silent swallows
- Loading states: skeleton loaders on every data-dependent component
- Offline: queue mutations when offline, sync when connection returns

### P3: Seed Data
- The supabase/seed/ directory is empty. Create seed.sql with:
  - 2 organizations, 3 projects
  - 10 users across different roles (owner, PM, super, sub, inspector)
  - 25 RFIs in various statuses
  - 15 submittals in various review stages
  - 50 punch list items (mix of open, in progress, closed)
  - 30 daily log entries with weather, crews, and notes
  - Budget line items by CSI division for each project
  - 5 change orders in different pipeline stages
  - Notifications for each user

## Construction Gaps to Address

- Lien waiver tracking is not fully built. This is a major workflow for GCs.
- Schedule needs a baseline vs actual comparison view.
- Submittals need better handling of re-submissions and multi-party review chains.
- Daily log needs to capture weather, incidents, and crew hours in a way that is
  defensible for legal and insurance purposes.
- Pay applications (AIA G702/G703) need to generate real PDF output
- Change order pipeline needs markup calculation and approval chain

## UI Principles to Enforce

- Every metric on every page should be a real calculated number, not a placeholder.
- Every table row must be hoverable and clickable to a detail view.
- Every page needs metric cards at the top.
- Empty states should be helpful and specific, not generic "no data found" messages.
- The sidebar icon for each section must be distinct and immediately recognizable.
- Loading states everywhere. No flash of empty content.
- Toast notifications for all user actions (created, updated, deleted, error).
- Forms should validate on blur, not just on submit.

## What I Want Invented (when modules hit 90+)

- A predictive delay engine: tells the PM on Monday what is going to go wrong by Friday
- A subcontractor scorecard that works across the portfolio, not just per project
- A cash flow model that projects 13 weeks out from real committed cost data
- An AI drawing reviewer that flags coordination conflicts between trades
- A "project pulse" that generates a one paragraph natural language summary of project
  health every morning, automatically sent to the PM and super
- Smart notifications that learn which alerts each role cares about and suppress noise
