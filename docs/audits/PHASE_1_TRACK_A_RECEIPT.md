# Phase 1 — Track A Receipt (Auth + Onboarding)

**Date:** 2026-05-13
**Operator:** Claude Code (Opus 4.7 1M-ctx)
**Plan:** `~/.claude/plans/lucky-watching-bird.md`
**Walker call:** "Full 5-step wizard" + "5 core articles" (2026-05-13)

## What shipped

### A1 — Sub-1 §4.4 RLS-policy-drift cron
- `supabase/functions/rls-policy-drift/index.ts` — rewritten from page-on-any to **count-vs-baseline** invariants. Pre-existing implementation would page constantly given the 13 documented exemptions from Day 4. New version compares to baseline `{rls_disabled_org=0, unprotected=13, writable_restrictive_incomplete=0}` and writes `audit_incidents` row + Slack alert only on drift.

### A2 — Sub-2 polish wiring
- `src/pages/auth/Signup.tsx` — wired existing helpers that were shipped but unconnected:
  - `isDisposableEmail(email)` in `validateEmail()` — rejects disposable email signups
  - `checkPasswordSafe(password)` at submit (pwned-passwords k-anon; fails open on network error)
  - `useTrack` events: `signup_started` on mount, `signup_email_submitted` at submit, `signup_org_provisioned` after edge fn, `signup_completed` on success
- `supabase/migrations/20261019000000_brt_sub_2_lockout_threshold_10.sql` — applied to live; `check_login_lockout` threshold 5 → 10 (15-min window unchanged)

### A3 — Sub-3 5-step wizard + sample-data seeder
- 3 untracked WIP files promoted to tracked: `OnboardingWizard.tsx`, `Step1RolePick.tsx`, `Step2OrgDetails.tsx`
- `src/hooks/useOnboardingState.ts` — reads/writes `profiles.onboarding_step`; best-effort persistence; in-memory advance still works if DB write fails
- `OnboardingWizard.tsx` — wired to `useOnboardingState`, replacing in-memory `useState<StepNumber>(1)` with persisted step
- `supabase/migrations/20261019010000_brt_sub_3_onboarding_state.sql` — applied to live:
  - `profiles.onboarding_step int default 0`
  - `seed_sample_data(p_org_id uuid, p_role text)` SECDEF — role-tailored sample data using existing `is_demo` column (added by Day 3 catch-up migration 20261009000002). Idempotent: returns 0 if any sample project exists for the org.
  - Uses 'gc'|'sub'|'owner'|'architect' role catalogue. Seeds 1 project + 2 RFIs + 1 submittal + 1 daily log + 2 punch items per org.
- 4 reference fixtures in `supabase/fixtures/sample_data/*.yaml` for human-editable docs of the inlined data
- `src/App.tsx` — `/onboarding` route now mounts `OnboardingWizard` instead of single-screen `CreateProject`

## Architectural notes

**`is_demo` vs `is_sample` decision:** The spec calls out `is_sample` columns. The codebase already has `is_demo` (Day 3 catch-up migration 20261009000002) with partial indexes and `clear_demo_data()`. Per the no-patches-Bugatti-grade memory, we reuse `is_demo` instead of duplicating columns. The seeder marks every insert `is_demo=true`; the existing `clear_demo_data(org_id)` is the counterpart.

**Single-screen `/onboarding` replaced.** The previous `/onboarding` route was a redirect to `CreateProject.tsx` (single-screen "first project" form). The wizard's Step 3 (FirstProject) provides the same UX as a wizard step, so no functionality is lost; Step 1 (RolePick) and Step 2 (OrgDetails) are new context-gathering, and Step 4/5 (InviteTeam + MeetIris) are growth/activation surfaces.

## Live state

| Migration | Shadow row | Apply method |
|---|---|---|
| `20261019000000_brt_sub_2_lockout_threshold_10` | paired | MCP `apply_migration` |
| `20261019010000_brt_sub_3_onboarding_state` | paired | MCP `apply_migration` |

## Verification

After PR merge:
```sql
-- A2 lockout threshold
SELECT prosrc FROM pg_proc WHERE proname='check_login_lockout';
-- threshold int := 10

-- A3 onboarding step
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name='profiles' AND column_name='onboarding_step';
-- onboarding_step | integer | 0

-- A3 sample data seeder
SELECT proname, prosecdef FROM pg_proc WHERE proname='seed_sample_data';
-- exists, security_definer=true
```

— End of Phase 1 Track A receipt —
