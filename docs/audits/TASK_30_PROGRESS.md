# Task #30 — SECURITY DEFINER Sweep — Progress Log

**Started:** 2026-05-13 (post-BRT-sub-0)
**Scope:** Bring every `public.*` SECURITY DEFINER function to the Sub-0 template (Standing Decisions §2):
- `SET search_path = public` pinned
- Inline membership gate (project_members or organization_members)
- `REVOKE EXECUTE … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated, service_role` after every `CREATE OR REPLACE`
- `(SELECT auth.uid())` not bare `auth.uid()`

## Live-state inventory (snapshot @ 2026-05-13)

```sql
-- See queries in docs/audits/TASK_30_INVENTORY_QUERY.sql for reproducibility.
```

| Bucket | Count | Action |
|---|---|---|
| `already-correct` | 8 | None (Sub-0 outputs) |
| `service-role-only` | 1 | None (`verify_audit_chain`) |
| `needs-tightening` (no membership gate, anon-callable) | 28 | **Batch 1–3** — add gate, pin path, revoke anon |
| `partial-gate-needs-revoke-or-pin` (has gate, still anon or unpinned) | 27 | **Batch 4–5** — pin path + REVOKE FROM anon (no body changes) |
| `trigger` (invoked by INSERT/UPDATE/DELETE) | 19 | **Batch 6** — search_path pin + REVOKE FROM anon (no gate; trigger context) |
| **Total** | **83** | |

## Pre-sweep advisor (Day 5 final, locked baseline)

- `authenticated_security_definer_function_executable`: 82
- `anon_security_definer_function_executable`: 74
- `function_search_path_mutable`: 81

## Batch plan

| Batch | Functions | Theme | PR title pattern |
|---|---|---|---|
| 1 | ~10 | RFI + audit helpers + simple project-scoped | `chore(security): Task #30 batch 1 — RFI helpers + audit gates` |
| 2 | ~10 | Submittal RPC family (submittal_advance_status, submittal_close, etc.) — all share `submittal → project_id` lookup pattern | `chore(security): Task #30 batch 2 — submittal RPC family` |
| 3 | ~8 | Cron/refresh + draft + notification helpers | `chore(security): Task #30 batch 3 — refresh & notification` |
| 4 | ~14 | partial-gate functions (has gate, needs pin + REVOKE) | `chore(security): Task #30 batch 4 — pin + revoke partial-gates` |
| 5 | ~13 | partial-gate continuation | `chore(security): Task #30 batch 5 — pin + revoke partial-gates II` |
| 6 | 19 | Trigger functions (search_path pin + anon revoke) | `chore(security): Task #30 batch 6 — trigger hardening` |

## User-self / pre-auth exemptions (document, don't gate)

These functions must remain anon/authenticated-callable by design; the fix is to pin search_path + document the why, not add a membership gate:

- `check_login_lockout(email)` — pre-auth login flow
- `record_failed_login(email, ip_hint, user_agent)` — pre-auth login flow
- `check_ai_rate_limit(p_user_id, p_limit)` — caller asserts they're the user; gate becomes `p_user_id = (SELECT auth.uid())` instead of project-membership

These count toward batch totals but use a different fix template.

## Service-role-only exemptions

These should have `anon` + `authenticated` REVOKE'd entirely (no GRANT to authenticated); only `service_role` keeps EXECUTE:

- `refresh_project_health_summary()`
- `refresh_submittals_log_mv(p_concurrent)`
- `update_warranty_status()` (no args; cron-only)
- `enqueue_insights_jobs()` (no args; cron-only)
- `verify_audit_chain(timestamptz)` — already correct from Day 1

## Per-batch progress

### Batch 1 — 5 cron-only / service-role-only functions
**Status:** ✅ **APPLIED to live 2026-05-13** (migration `20261015020000_task_30_batch_1_cron_only_revoke.sql`, shadow row paired).
**Functions hardened:**
- `refresh_project_health_summary()` — service-role-only (portfolio-summary-refresh edge fn + pg_cron)
- `refresh_submittals_log_mv(boolean)` — service-role-only (trg_refresh + pg_cron)
- `update_warranty_status()` — service-role-only (warranty expiry sweep)
- `enqueue_insights_jobs()` — service-role-only (scheduled-insights heartbeat)
- `lap_2_open_incident_count()` — service-role-only (lap-2-acceptance.yml direct SQL)

**Approach:** `ALTER FUNCTION ... SET search_path = public` + `REVOKE ALL FROM PUBLIC; REVOKE EXECUTE FROM anon, authenticated; GRANT EXECUTE TO service_role`. **No body changes** — lowest-blast-radius template for cron-only functions. Verified zero frontend callers via grep of `src/` + `supabase/functions/` + `scripts/`.

**Post-state verified:** all 5 show `proconfig=['search_path=public']` + `grants=postgres:EXECUTE,service_role:EXECUTE` (no anon, no authenticated, no PUBLIC).

**Projected lint deltas (vs Day 5 baseline):**
- `anon_security_definer_function_executable`: 74 → 69 (−5)
- `authenticated_security_definer_function_executable`: 82 → 77 (−5)
- `function_search_path_mutable`: 81 → 76 (−5)

### Batch 2 — RFI helpers + simple project-scoped (next session)
**Status:** ⏳ Pending
**Functions:**
- `fn_rfi_project_id(p_rfi_id)` — RLS helper, looks up project from RFI
- `fn_user_is_rfi_assignee(p_rfi_id, p_user_id)` — assignee check
- `restore_rfi(p_rfi_id)` — undelete with project-membership gate
- `is_pilot_project(p_project_id)` — RLS helper
- `is_pilot_user(p_user_id)` — RLS helper (user-self pattern)
- `reorder_tasks(task_ids[], new_orders[])` — bulk reorder, project gate via tasks' project_id
- `withdraw_stale_draft(p_draft_id, p_reason)` — gate via draft's project
- `promote_insight_to_draft(p_insight jsonb, p_project_id)` — direct project gate
- `lap_2_open_incident_count()` — internal stat; service-role-only
- `iris_enqueue_ingest(...)` — has p_project_id; project gate

### Batch 2 — Submittal RPC family (post-Batch-1)
**Status:** ⏳ Pending

### Batch 3 — Cron/refresh + notification
**Status:** ⏳ Pending

### Batch 4–5 — partial-gate pin + revoke
**Status:** ⏳ Pending

### Batch 6 — Trigger hardening
**Status:** ⏳ Pending

## Target end-state

After all 6 batches:

| Lint family | Day 5 baseline | Task #30 target | Δ |
|---|---|---|---|
| `anon_security_definer_function_executable` | 74 | ≤10 (only true user-self + pre-auth functions) | −60+ |
| `authenticated_security_definer_function_executable` | 82 | ≤25 (only functions where the inline gate doesn't fully scope, e.g. RLS helpers) | −55+ |
| `function_search_path_mutable` | 81 | ≤10 (only the legacy non-DEFINER ones we don't touch) | −70+ |

— End of progress log —
