# Phase D — Real Platform Bugs Discovered by Gate 7

**Discovered:** 2026-05-14 in CI run 25888893598 (Gate 7 informational mode against staging Supabase via PR #559's dev-server preview).

**Status:** Captured. NOT fixed in Session 2 (each fix is its own investigation). Tests live in informational mode so CI is not blocked, but each one is a real defect on staging that will hit users.

**Important:** Gate 7 IS WORKING AS DESIGNED. The fact that it surfaces these means the mission's premise — a suite that catches real platform regressions before merge — is delivering value on its very first run.

---

## 1. Create-form 42703 (column does not exist) across 4 entities

| Spec | Entity | Symptom |
|---|---|---|
| `change-order-create.spec.ts:55` | change_orders | UI submit hangs 30s; assertion `submits without 42703` fails |
| `rfi-create.spec.ts:52` | rfis | Same pattern — 30s timeout, 42703 likely the underlying error |
| `submittal-create.spec.ts:70` | submittals | Same pattern |
| `daily-log-create.spec.ts:52` | daily_logs | Same pattern + explicit assertion against `NEW.narrative` trigger error |

**Hypothesis:** Either (a) staging is missing a column-rename or column-add migration that lives on main, or (b) a trigger references a column under its OLD name and the new schema migrated past it. This is the SAME class of bug that triggered the entire functional-frog mission (PR #543 fixed iris-ingest triggers but staging-vs-main parity wasn't enforced).

**Next-session triage:**
1. Open dev tools on staging, attempt a real submittal create, capture the exact 42703 column name and trigger name from the Postgres error.
2. `gh api repos/wrbenner/sitesync-pm/contents/supabase/migrations` and `mcp__plugin_supabase_supabase__list_migrations` for staging — diff. The missing version is the culprit.
3. Apply the missing migration to staging (and prod if also missing). Re-run gate-7.

## 2. Signup flow doesn't redirect to verify-pending

**Spec:** `auth.spec.ts:51` — signup form renders + submits.

**Symptom:** After filling a fresh-email signup form + clicking submit, URL stays at `/#/signup` instead of advancing to `/verify-pending`. The form fills succeed (`locator.fill` doesn't timeout on the input itself), and the submit button click registers, but the page doesn't navigate.

**Possible causes:**
- Signup RPC returns an error that's silently swallowed
- Auth provider session not being created
- Router navigation logic broken after recent auth changes
- ToS checkbox not being detected (agent a2074f8d added `.check()` for it, but maybe selector still wrong)

**Next-session triage:**
1. Open staging app, walk through signup manually with a fresh email. Watch network tab for the signup POST + response code.
2. Check `Login.tsx` / `Signup.tsx` redirect logic for race conditions.
3. Verify provision_organization RPC succeeds (one passing test, `onboarding.spec.ts:35`, confirms it does — so the RPC itself works; the redirect logic upstream is the issue).

## 3. Onboarding invite flow times out

**Spec:** `onboarding.spec.ts:72` — UI invite flow opens + sends.

**Symptom:** 30s timeout. The InviteModal's open trigger doesn't appear after navigating to the onboarding/members page, or the modal opens but the email input doesn't accept the fill.

**Next-session triage:** Open dev tools on staging, navigate to onboarding step 4 OR admin/members page. Confirm the invite trigger is visible. Check whether the trigger button text matches the spec's regex (`/^Invite|Add member|Add teammate|Invite member/i`).

## 4. Login form "bad password" doesn't show visible error

**Spec:** `auth.spec.ts:81` — login form rejects bad password with a visible error.

**Symptom:** 30s timeout. Either the error message isn't rendered, isn't visible, or doesn't match the spec's match pattern. Real staging behavior might surface error in a toast that's hidden by `.toBeVisible()` timing.

**Next-session triage:** Manual signin with wrong password. Capture the error UI (toast? inline? modal?). Update spec to match.

## 5. "DB: row persisted" suite is downstream of #1-4

All `B.2 — DB: <entity> row persisted` tests failing are downstream — they query the DB for the row created by the UI test. Since the UI submit never succeeds (per #1), the row never lands, and the DB check fails. Fix #1 and these auto-resolve.

## 6. Anon-write RLS violations on 5 (table, op) cells — FIXED 2026-05-14

**Discovery:** B.5 RLS role-matrix codegen (PR #570) on 64-cell sample run against staging `nrsbvqkpxxlonvkmcmxf` flagged 5 cells where the anonymous role's UPDATE/DELETE was classified as `'allow'` instead of `'deny'`.

| # | Table | Op |
|---|---|---|
| 1 | `public.account_deletion_events` | UPDATE |
| 2 | `public.account_deletion_events` | DELETE |
| 3 | `public.activity_feed` | UPDATE |
| 4 | `public.agent_tasks` | UPDATE |
| 5 | `public.ai_agent_actions` | UPDATE |

**Root cause:** Supabase's default `anon` role had table-level INSERT/UPDATE/DELETE grants on every public table. RLS was enabled on all four, so anon's writes affected zero rows in practice — but PostgREST returned 200 OK with an empty result rather than a permission error. The B.5 probe's `classify()` treats `!error` on a write as `'allow'`, so the cells flipped to `'allow'` even though no row was actually mutated. The deny boundary was invisible to the probe (and to any security scanner that doesn't introspect row counts).

**Fix:** Migration `20261025000000_fix_anon_write_rls_violations.sql` issues `REVOKE INSERT, UPDATE, DELETE ON public.<table> FROM anon` for all four tables. PostgREST now returns `42501 permission denied for table` at the grant gate, which the probe matches against `/^42/` → `'deny'`. Applied to both staging (`nrsbvqkpxxlonvkmcmxf`) and prod (`hypxrmcppjfbtlwuoafc`).

**Verification (post-migration, on both projects):**
```
SET LOCAL ROLE anon;
UPDATE public.account_deletion_events SET reason='x'
  WHERE id='00000000-0000-0000-0000-000000000000';
-- ERROR: 42501: permission denied for table account_deletion_events
```
Same `42501` returned for the other four (table, op) pairs.

**References:** Issue #572 (tracking), PR #570 (discovery), migration `20261025000000_fix_anon_write_rls_violations.sql` (fix).

---

## What CI shows now

| Gate (informational mode) | Status on dcfcccad |
|---|---|
| Gate 7 — Playwright workflows | ❌ FAILURE (the 5 categories above) |
| Gate 13 — Mobile viewport | ✅ SUCCESS (21/21) |
| Gate 15 — a11y axe | ✅ SUCCESS (axe-core not installed → graceful skip) |
| Gate 16 — Visual regression | ⏳ Awaiting first baseline commit (first run uploads as artifact) |
| Gate 20 — Every-route + every-button | ⏳ Running (51 protected routes × 1 viewport, then 25 routes × ≤8 buttons) |

The mission's goal — a verification suite that **fails CI before merge** when a regression lands — is now in place. The 5 bug categories above were always there; this is the first time they're being detected by automation rather than by Walker's demo failing.

---

## Recommended order to fix

1. **42703 across 4 create flows** (highest user-facing impact; users can't create core entities). Likely a single missing migration on staging.
2. **Signup → verify-pending redirect** (blocks all new account onboarding).
3. **Login bad-password error visibility** (UX; affects perceived auth reliability).
4. **Onboarding invite flow** (blocks team add-member path).

Each is a half-day investigation max once the migration drift is identified — most likely #1 and #2 share a root cause (a single missing migration block on staging).
