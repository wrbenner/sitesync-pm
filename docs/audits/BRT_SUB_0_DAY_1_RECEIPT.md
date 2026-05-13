# BRT Sub-0 — Day 1 Receipt (Verifications + SECURITY INVOKER)

**Date:** 2026-05-12
**Branch:** `brt/sub-0-day-1-verifications` (stacked on `brt/sub-0-day-0-preflight` — rebases to `main` after Day 0 merges)
**Operator:** Claude (Opus 4.7 1M-ctx) via Supabase MCP
**Reviewer / merge approver:** walker@sitesyncai.com
**Linked plan:** `~/.claude/plans/wise-finding-hippo.md`
**Predecessor:** [Day 0 — Preflight](./BRT_SUB_0_DAY_0_RECEIPT.md)

## Purpose

Day 1 closes three findings:

- **P0-B** — 6 SECURITY DEFINER views in `public` bypassed RLS on underlying tables. Convert to SECURITY INVOKER.
- **P0-E** — `iris_call_idempotency` had RLS enabled with zero policies; the edge function uses a user-JWT client to write the cache, so every write silently failed. Add a per-row user-scoped policy.
- **P1-D** — `verify_audit_chain` (the deposition-grade hash-chain verifier) was advertised as service-role-only but live `has_function_privilege` confirmed anon AND authenticated could EXECUTE it. Re-revoke and pin via function comment.

Plus one Walker action (P2-4, no PR): toggle "Leaked Password Protection" ON in Supabase Auth dashboard.

## Verifications captured during Day 0 / morning Day 1

### P0-E — iris-call client + table policy state

Read `supabase/functions/iris-call/index.ts` and `supabase/functions/shared/auth.ts`:

```
shared/auth.ts:172  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
shared/auth.ts:198  const supabase = createClient(supabaseUrl, supabaseAnonKey, {…})
iris-call/index.ts:218  await supabase.from('iris_call_idempotency').upsert(…)
```

The cache writer runs under the user's Bearer JWT as the `authenticated` role.

Live policy state on `iris_call_idempotency`:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='iris_call_idempotency';
-- returns 0 rows
```

RLS-enabled-no-policy under the authenticated role = no SELECT visibility, no INSERT permission. **P0-E confirmed broken in production.**

### P1-D — verify_audit_chain grants

```sql
SELECT proname, prosecdef, has_function_privilege('anon', oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_exec
FROM pg_proc WHERE proname='verify_audit_chain';

-- result:
-- verify_audit_chain | true | true | true | true
```

→ **P1-D confirmed real**, not advisor false-positive. Function is SECURITY DEFINER and executable by anon+authenticated. Audit suspected a prior REVOKE had been undone by a subsequent CREATE OR REPLACE FUNCTION — that's exactly what happened.

### P0-B — 6 views confirmed

Captured during Day 0 (see predecessor receipt § 4). All 6 view names from the audit verified present in live; all 6 have `reloptions IS NULL` and owner = `postgres`.

## Deliverables landed in this PR

| Path | Purpose |
|------|---------|
| `supabase/migrations/20261012010000_p0e_iris_call_idempotency_policy.sql` | `CREATE POLICY iris_call_idempotency_own_row` — user_id = auth.uid() guard for both USING and WITH CHECK; closes P0-E |
| `supabase/migrations/20261012010001_p0b_security_invoker_views.sql` | `ALTER VIEW … SET (security_invoker = true)` on 6 views; closes P0-B |
| `supabase/migrations/20261012010002_p1d_revoke_verify_audit_chain.sql` | `REVOKE EXECUTE` from PUBLIC, anon, authenticated; pin via function COMMENT; closes P1-D |
| `supabase/tests/database/p0b_security_invoker.sql` | 6 pgTAP assertions: each view has `security_invoker=true` in reloptions |
| `supabase/tests/database/p0e_idempotency_policy.sql` | 3 pgTAP assertions: policy exists with cmd=ALL, USING and WITH CHECK reference `user_id` + `auth.uid()` |
| `supabase/tests/database/p1d_verify_audit_chain_revoked.sql` | 3 pgTAP assertions: anon/authenticated lack EXECUTE, service_role retains EXECUTE |

Cross-tenant functional tests (set `request.jwt.claim.sub`, attempt cross-user inserts, expect 42501) live in Day 3a's fixture suite where the seed-user pattern is already established. Day 1 fixtures verify migration shape only.

## Risk + fallback notes

### P0-B SECURITY INVOKER risks

Under invoker, three classes of caller-impact:

1. `iris_ingest_queue_depth` — selects from `pgmq.q_iris_ingest`. Queue has no user-facing RLS. **Under invoker, regular users see 0 rows.** If a user-token dashboard polls this, the dashboard panel goes blank after the migration lands. Walker: confirm on Day 5 smoke whether a Walker-facing Iris-ingest dashboard panel still renders. Mitigation: route through a guarded SECURITY DEFINER function that explicitly checks for an admin role.

2. `iris_kb_health_daily`, `iris_kb_retrieval_p95_1h`, `iris_kb_source_coverage_7d` — select from `iris_kb_telemetry` / `iris_kb_chunks`. Those tables have project-scoped RLS. **Under invoker, users see only their own project rows.** Org-wide aggregates collapse to user-scope, which is the correct posture; this is a behavioral change not a bug.

3. `executor_daily_counts`, `org_executor_cancel_rate_7d` — select from `executor_runs` + `organizations`. **Under invoker, users see only orgs they're members of.** Same behavioral change as (2).

### P0-E policy edge case

The policy uses `(SELECT auth.uid())` instead of `auth.uid()`. This pattern is intentional — it satisfies the `auth_rls_initplan` performance lint (callable once per query, not per row). All recent project migrations use this form. No semantic difference for the security check.

Service role bypasses RLS entirely (Supabase configures `service_role` as a BYPASSRLS role), so any cron / cleanup job written with service-role credentials remains unaffected.

### P1-D pinning

`REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` removes all three vectors. The `COMMENT ON FUNCTION` is a soft pin — anyone writing a future CREATE OR REPLACE FUNCTION on this name will see the comment in `\df+ verify_audit_chain` and should know not to re-grant. A hard pin would require an event trigger; deferred as P2 hardening.

## Exit criteria

- [x] P0-E confirmed broken; fix migration written.
- [x] P0-B confirmed across all 6 views; fix migration written.
- [x] P1-D confirmed real; fix migration written.
- [x] pgTAP test files cover all three migrations.
- [ ] CI green on this PR (pgtap workflow + existing checks).
- [ ] Walker: toggle Leaked Password Protection in Auth dashboard (P2-4, optional this week).
- [ ] Merged to `main`.

## Sign-off

| Role | Name | Date |
|------|------|------|
| Operator | Claude (Opus 4.7 1M-ctx) | 2026-05-12 |
| Reviewer / merge approver | walker@sitesyncai.com | _pending_ |
