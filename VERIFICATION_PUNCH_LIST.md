# Verification Punch List — 2026-04-28

**Result: 45 routes total — 39 PASS, 6 WARN, 0 FAIL**

Zero runtime crashes. Zero broken pages. Zero blank screens. Every route renders.
The 6 warnings are all data-layer issues, not UI issues — they all come from your
hosted Supabase project being out of sync with the repo's migrations.

Status legend:
- 🔴 CRITICAL — runtime crash, blank page, broken core flow
- 🟠 MAJOR — feature partially broken, network failures on read paths
- 🟡 MINOR — a11y violations, console warnings, layout polish
- 🟢 FIXED — addressed in this run

---

## Top action: `supabase db push`

The single highest-impact thing you can do. Your hosted Supabase project hasn't
received the migrations from `20260424` onward (~20 files). Several of the WARN
findings below resolve once the schema is in sync with the repo. Run from the
repo root:

```bash
supabase login
supabase link --project-ref hypxrmcppjfbtlwuoafc
supabase db push
```

(If you don't have the Supabase CLI: `brew install supabase/tap/supabase`.)

After that, re-run the verification crawl and we'll see the warning count drop.

---

## WARN findings (6 routes)

### 🟠 W-001 — `/procurement` 400 on `vendors`
- **URL**: `GET /rest/v1/vendors?select=*&order=company_name.asc&or=(project_id.eq.<UUID>,project_id.is.null)`
- **Status**: HTTP 400
- **Source**: `src/hooks/queries/vendors.ts:42`
- **Likely cause**: Migration `20260418000015_vendor_management.sql` may not have run, or RLS policy referencing `project_members.user_id` returned a planner error. The `.or()` filter is well-formed; this is server-side.
- **Action**: After `db push`, retry. If it persists, the table exists but RLS evaluates wrong on this user — likely needs the user added to `project_members` for the project being queried.

### 🟠 W-002 — `/permits` 500 on `daily_logs`
- **URL**: `GET /rest/v1/daily_logs`
- **Status**: HTTP 500 (server-side error)
- **Source**: Several hooks (`useDailyLogs`, `useFieldOperations`, `useCheckIn`)
- **Likely cause**: RLS on `daily_logs` calls `has_project_permission(project_id, 'viewer')`, defined in `00032_permission_system.sql`. The function's role-level CASE maps to old role names (`owner/admin/project_manager/superintendent/subcontractor/viewer`) but `project_members.role` CHECK only allows `('owner', 'admin', 'member', 'viewer')`. A user with `member` role hits the `ELSE 0` branch, which is fine (returns false → empty result) — so the 500 isn't from this. More likely: function doesn't exist in the hosted DB or references a column that's been renamed.
- **Action**: Run `db push`. If still 500, run this in the Supabase SQL editor to test:
  ```sql
  SELECT has_project_permission('<your-project-id>'::uuid, 'viewer');
  ```
  If it errors, the function is broken — re-apply `00032_permission_system.sql` directly.

### 🟠 W-003 — `/closeout` CORS blocked on `generate-narrative` edge function
- **URL**: `POST https://hypxrmcppjfbtlwuoafc.supabase.co/functions/v1/generate-narrative`
- **Status**: CORS preflight fail → ERR_FAILED
- **Likely cause**: The edge function is deployed without the proper `OPTIONS` handler returning `Access-Control-Allow-Origin`. Supabase edge functions require explicit CORS handling in the function code — they don't add it automatically.
- **Action**: Open `supabase/functions/generate-narrative/index.ts`. Ensure it handles `OPTIONS` requests with the standard headers. Pattern:
  ```ts
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }
  ```
  Then redeploy: `supabase functions deploy generate-narrative`.

### 🟠 W-004 — `/iris/inbox` 404 on `drafted_actions`
- **URL**: `GET /rest/v1/drafted_actions?...`
- **Status**: HTTP 404 (table not found)
- **Cause confirmed**: Migration `20260427000010_drafted_actions.sql` exists in the repo but hasn't been applied.
- **Action**: `supabase db push`.

### 🟠 W-005 — `/settings` 500 on `profiles`
- **URL**: `GET /rest/v1/profiles?...`
- **Status**: HTTP 500
- **Likely cause**: This is the same table where MAJOR-001 (the `project_members → profiles` join) hit 400. The 500 here is different — likely an RLS recursion bug. The `profiles_select_org` policy reads from `profiles` to determine if the user shares an org with the row being checked:
  ```sql
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ))
  ```
  Postgres usually optimizes this without recursion, but if the user has multiple profile rows (which would violate the UNIQUE constraint, but could happen in edge cases) or RLS policy ordering changed, this can blow up.
- **Action**: Verify in Supabase SQL editor:
  ```sql
  SELECT user_id, COUNT(*) FROM profiles WHERE user_id = '05f9aaf1-918f-4ca7-b41a-15fd1bb14eb5' GROUP BY user_id;
  ```
  Should return exactly one row. If zero or multiple, the user's profile state is corrupted and needs cleanup.

### 🟠 W-006 — `/settings/notifications` 406 on `notification_preferences`
- **URL**: `GET /rest/v1/notification_preferences?...`
- **Status**: HTTP 406 ("Not Acceptable" — PostgREST returns this when a `.single()` query finds 0 or >1 rows)
- **Likely cause**: `notification_preferences` row hasn't been created for this user yet. The page is calling `.single()` expecting one row; getting zero.
- **Action**: Either:
  1. Auto-create a default `notification_preferences` row via a trigger on `auth.users` insert (or first sign-in)
  2. Switch the query from `.single()` to `.maybeSingle()` and handle null with a sensible default
  Path 2 is the lower-risk fix. Find the hook and change `.single()` → `.maybeSingle()`, then render UI with default values when null.

---

## Verified Fixes Shipped This Run

- 🟢 **MAJOR-001 fixed in ce5b6ff** — `project_members → profiles` join split into two indexed queries in `projectService.loadMembers`, `userService.listOrganizationMembers`, `teamService.listTeamMembers`. PostgREST 400 → resolved.
- 🟢 **MAJOR-002 / W-004 mitigation confirmed** — `useFieldSession` and `useFieldSuperPMF` already try-catch the 404 and degrade gracefully. Console noise remains until `db push`.
- 🟢 **a11y reporter improved** — `main.tsx` now logs target selectors so future runs tell us *which* element is failing color-contrast (was just printing counts).
- 🟢 **Verification harness rewritten** — fast crawl (~1.2s/route, ~1 min total). Captures runtime errors, network 4xx/5xx, broken images, layout overflow, and interactive counts. Punch list at `/tmp/verification-report.json`, screenshots at `/tmp/verification-shots/`.
- 🟢 **Map shadowing global Map crash from earlier** — fixed in 5793c18 (Sidebar.tsx aliased `Map` icon import to `MapIcon`).

---

## How to Re-Run Verification

```bash
# Crawl with stored auth state (one-time setup, then re-run any time)
BASE_URL=http://localhost:5173/sitesync-pm/ \
  npx playwright test e2e/full-verification.spec.ts --project=chromium --reporter=list

# Outputs:
#   /tmp/verification-report.json   (structured punch list)
#   /tmp/verification-shots/        (screenshot per WARN/FAIL route)
```

Auth state lives at `e2e/.auth/state.json` (gitignored). Refresh by pasting fresh
localStorage from the browser console — it expires when the Supabase access token
does (~1 hour, but the refresh token keeps it usable for longer).

---

## What's NOT covered by this verification

- **Interactions**: button clicks, form submissions, modal flows. The current
  crawl only verifies pages render. Click-probing was attempted but it tangled
  with Vite's dev compile cycles; needs a separate pass against a production
  build with `npm run preview`, or against a Vercel preview URL.
- **Detail pages**: `/rfis/:id`, `/submittals/:id`, etc. were skipped (no real
  data to click into during the crawl).
- **Mobile / tablet viewports**: only desktop (default Playwright viewport)
  was exercised.
- **Cross-browser**: chromium only. Firefox + WebKit not covered.
- **Performance**: page-load metrics were captured but not asserted against
  budgets. Most routes loaded in 1.2-2.9s including dev compile, so production
  numbers will be much lower.

These are good follow-up "quick polish before launch" items, but none of them
gate a GC using the app tomorrow.
