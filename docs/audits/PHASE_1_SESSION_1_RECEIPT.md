# Phase 1 — Session 1 Receipt (Sub-1 close + Sub-2 start)

**Date:** 2026-05-14 (Phase 1 close-out, Session 1 of 3–6)
**Operator:** Claude Code (Opus 4.7 1M-ctx)
**Plan:** `~/.claude/plans/lucky-watching-bird.md` (Walker-approved)
**Standing decisions:** `BRT_SUB_0_STANDING_DECISIONS_2026-05-13.md` §§1–15

## What shipped

### Day 4 carry-over (uncommitted → committed)

- `20261017000000_brt_sub_1_provision_org_v2_idempotent.sql` — (canonical_slug, owner) idempotency + role catalogue integration
- `20261017010000_brt_sub_1_unprotected_org_table_remediation.sql` — 7 policies + 12 documented exemptions (19 → 13)
- `docs/audits/RLS_POLICY_MATRIX_2026-05-14.md` — baseline artifact (45 org-scoped tables, 32 full-CRUD, 13 exempt)
- `supabase/tests/database/sub_1_adversarial_rls_matrix.sql` — adversarial pgTAP scaffold (now 11 assertions)

### Sub-1 §4.3 — JWT org_id custom claim + active-org switch

- **NEW migration** `20261018000000_brt_sub_1_jwt_org_claim_hook.sql` — applied to live via MCP:
  - `profiles.active_org_id uuid` (nullable FK to organizations.id, ON DELETE SET NULL) + partial index
  - `public.custom_access_token_hook(event jsonb)` STABLE SECURITY DEFINER — injects `org_id` into JWT claims on token mint/refresh. Reads from `profiles.active_org_id`, falls back to user's first owner→admin→member membership.
  - `public.set_active_org(p_target_org_id uuid)` SECURITY DEFINER — membership-gated; raises 42501 if caller is not a member.
  - Grants per Sub-0 template: REVOKE FROM PUBLIC, GRANT to supabase_auth_admin (hook) + authenticated/service_role (set_active_org).
- **NEW edge function** `supabase/functions/switch-active-org/index.ts` — validates membership server-side via `set_active_org()` RPC; returns 403 on non-membership.
- **authStore.ts** extended with `switchActiveOrg(targetOrgId)` action — invokes edge fn, calls `supabase.auth.refreshSession()` to pick up the new `org_id` JWT claim, then routes through `setCurrentOrg()` (which cancels in-flight queries + clears the React Query cache — atomic switch per Day 4 P0-G pattern).
- **useActiveOrg** hook (existing, Sub-0 P0-A) is already the read path — no changes needed; the new switchActiveOrg is the write path.

**Adversarial pgTAP harness extended from 5 → 11 assertions:**
- audit_log INSERT denial under user A → org B
- organization_members self-promotion denial
- organizations UPDATE rowcount = 0 (RLS-filtered)
- find_unprotected_tables() ≤ 13 invariant
- v_writable_restrictive_coverage: every non-exempt has 3 restrictive policies
- has_function check on `custom_access_token_hook`

### Sub-2 — Self-Serve Signup polish (started)

- **NEW** `src/components/auth/Turnstile.tsx` — Cloudflare Turnstile widget wrapper. Lazy-loads CF script, mounts widget into ref container, fires `onVerify(token)` on challenge pass. Reads `VITE_TURNSTILE_SITE_KEY`; dev-bypass sentinel when unset.
- **`src/pages/auth/Signup.tsx`** — Turnstile mounted below ToS checkbox + above submit. Submit gated until token captured. On success, navigates to `/verify-pending` with `state.email` (replaces orphaned inline success card). Resolved-slug surfacing dropped from this page (moves to onboarding wizard in Session 2).
- **`src/pages/auth/VerifyPending.tsx`** — promoted from untracked WIP to tracked; "Check your inbox" landing with resend-button driven by Supabase `auth.resend({ type: 'signup', email })`.
- **`src/App.tsx`** — `/verify-pending` route wired; `isAuthPage` allowlist updated so the auth chrome shows.
- **`supabase/functions/provision-org/index.ts`** — `verifyTurnstile(token, clientIp)` siteverify call via Cloudflare endpoint. Opt-out path when `TURNSTILE_SECRET_KEY` is unset (local dev); production rejects DEV_BYPASS sentinel when the secret is set.

### Walker pre-authorized decisions — status

| Decision | Status |
|---|---|
| CAPTCHA = Cloudflare Turnstile | ✅ widget shipped; siteverify shipped; needs `VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` set in dashboard for production gate to engage |
| Pricing $400/$4,080 | ✅ live (Day 3 plan_reseed_brt) |
| Plan disposition (`pro` canonical) | ✅ live; legacy plans `archived=true` |
| Marketing palette = Option A | Deferred Sub-5 (Session 4) |
| Stripe Tax = enable | Deferred Sub-4 (Session 3) |

## Live-state apply (this session)

| Migration | Shadow row | Apply method |
|---|---|---|
| `20261018000000_brt_sub_1_jwt_org_claim_hook` | paired | MCP `apply_migration` |

Live now has: `profiles.active_org_id` column, `custom_access_token_hook(jsonb)`, `set_active_org(uuid)`. **Dashboard hook registration remains a Walker step** — Supabase dashboard → Authentication → Hooks → Custom Access Token Hook → select `public.custom_access_token_hook`.

## Outstanding (rolling to Session 2)

- Sub-1 §4.4 nightly RLS-policy-drift cron edge fn
- Sub-1 §4.2 codegen script `scripts/gen-adversarial-rls-tests.ts` (mechanically emit per-table assertions from `v_rls_table_coverage` + information_schema)
- Sub-2 finish: Google OAuth + pwned-password k-anon + disposable email blocklist + lockout expansion + signup_* PostHog events
- Sub-3 onboarding wizard (Steps 3-5 + sample-data seed)
- Sub-4/5/6/7/8 per the plan

## Ping points held

None fired this session. All four standing ping conditions (novel P0, architectural exceeds spec, MCP write failure, live-state surprise) — none triggered.

## Verification artifacts

After PR merges, the Sub-1 §4.1 + §4.3 invariants can be verified with:

```sql
-- §4.1 idempotency
SELECT provision_organization('Test Idem', 'test-idem', '00000000-0000-0000-0000-000000000001'::uuid);
SELECT provision_organization('Test Idem', 'test-idem', '00000000-0000-0000-0000-000000000001'::uuid);
-- expect: same uuid both calls

-- §4.1 role catalogue
SELECT count(*) FROM org_custom_roles WHERE organization_id = '<test_org>'; -- expect 6

-- §4.2 unprotected bound
SELECT count(*) FROM find_unprotected_tables(); -- expect 13

-- §4.3 hook present
SELECT proname FROM pg_proc WHERE proname IN ('custom_access_token_hook','set_active_org');
```

— End of Phase 1 Session 1 receipt —
