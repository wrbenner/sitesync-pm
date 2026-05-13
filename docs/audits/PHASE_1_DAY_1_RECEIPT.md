# Phase 1 — Day 1 Receipt (Roadmap to SOC 2)

**Date:** 2026-05-13
**Operator:** Claude Code (Opus 4.7 1M-ctx) via Supabase MCP
**Standing decisions:** `BRT_SUB_0_STANDING_DECISIONS_2026-05-13.md` (§§1–14)
**Roadmap:** `ROADMAP_TO_SOC2_2026-05-13.md`

## Purpose

First day of Phase 1 execution: complete Phase 0 closeout (CI gates + pre-existing infra reds) and kick off Task #30 (the 83-function SECURITY DEFINER sweep). Parallel: draft the 4 decision artifacts requiring Walker initials.

## What shipped today

### Phase 0 closeout — PR #514 (open, auto-merge queued)

`chore(ci): install audit gates + Phase 0 CI hygiene`

- **Audit gates installed:** `audit-supabase-advisors.yml` (lint-diff vs baseline) + `audit-npm-deps.yml` (CVE gate) + `docs/audits/.supabase-advisor-baseline.json` (Day 5 final state locked).
- **3 pre-existing infra reds fixed:**
  - `platform-health.yml` (the "audit" check), `perf.yml`, `e2e-scenarios.yml` — `bun install --frozen-lockfile` → `npm ci` + `npx tsx` (repo is npm-managed).
  - `rls-writable-check.yml` — tightened `SUPABASE_DB_URL` validation to require `postgres://`/`postgresql://` prefix (rejects `***` placeholder + emits clear warning).
  - `pgtap.yml` — added `--debug` flag to `supabase start` to surface the real migration-chain error for the next forward-fix PR.

**Walker action required:** verify GitHub repo secrets are set — `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF=hypxrmcppjfbtlwuoafc`, `SLACK_ALERTS_WEBHOOK` (optional). The advisor gate fails on first run if `SUPABASE_ACCESS_TOKEN` is missing.

### Task #30 inventory + Batch 1 — PR #515 (open, auto-merge queued)

`chore(security): Task #30 batch 1 — 5 cron-only SD functions hardened`

**Inventory (live snapshot 2026-05-13):**

| Bucket | Count |
|---|---|
| `already-correct` (Sub-0 outputs) | 8 |
| `service-role-only` | 1 |
| `needs-tightening` (no membership gate, anon-callable) | 28 |
| `partial-gate-needs-revoke-or-pin` (has gate, still anon or unpinned) | 27 |
| `trigger` (invoked by INSERT/UPDATE/DELETE) | 19 |
| **Total** | **83** |

Scope is smaller than Walker's "152" rough estimate. Real lift is 47 functions in the "needs work" buckets + 19 trigger hardenings.

**Batch 1 (shipped today): 5 cron-only / service-role-only functions** — `refresh_project_health_summary`, `refresh_submittals_log_mv`, `update_warranty_status`, `enqueue_insights_jobs`, `lap_2_open_incident_count`. Approach: `ALTER FUNCTION ... SET search_path = public` + `REVOKE ALL FROM PUBLIC; REVOKE EXECUTE FROM anon, authenticated; GRANT EXECUTE TO service_role`. No body changes.

**Verified post-state on live:**
```
proconfig = ['search_path=public']      (all 5)
grants    = postgres:EXECUTE, service_role:EXECUTE   (all 5; no anon/auth/PUBLIC)
```

**Projected lint deltas** (Day 5 baseline → Day 1 of Phase 1):
- `anon_security_definer_function_executable`: 74 → **69** (−5)
- `authenticated_security_definer_function_executable`: 82 → **77** (−5)
- `function_search_path_mutable`: 81 → **76** (−5)

### Parallel-track decision docs (filed in PR #515)

Walker-facing markdown with default recommendations + initials slots:

- `BRT_PRICING_DECISION_2026-05-13.md` — Starter plan: $400 (Brief §9.2) vs $499 (current seed). Default $400.
- `BRT_DECISIONS_PENDING_2026-05-13.md` — three lock-ins:
  - CAPTCHA: **Turnstile** (free, Cloudflare)
  - Marketing palette: **Option A (construction navy)** per Brief §13.2
  - Stripe Tax: **enable** (10 min wiring, $0 marginal)

Each defaults are already drafted into respective Sub-2/4/5 specs; Walker's signature locks them into the frontmatter contracts and unblocks downstream subsystems.

## Verifications captured

```sql
-- Batch 1 post-state
SELECT proname, proconfig,
       (SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee)
          FROM information_schema.role_routine_grants
         WHERE routine_schema='public' AND routine_name=proname) AS grants
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
 WHERE proname IN ('refresh_project_health_summary','refresh_submittals_log_mv',
                   'update_warranty_status','enqueue_insights_jobs','lap_2_open_incident_count');
```

5 rows, all `proconfig=['search_path=public']`, all `grants=postgres:EXECUTE,service_role:EXECUTE`.

```sql
-- Shadow row for batch 1
SELECT version, name FROM supabase_migrations.schema_migrations
 WHERE name = 'task_30_batch_1_cron_only_revoke';
```
20260513… (real apply) + 20261015020000 (shadow) — pair confirmed.

## Outstanding (rolling to Day 2)

| Item | Status |
|---|---|
| PR #514 merge | ⏳ Auto-merge queued; CI running |
| PR #515 merge | ⏳ Auto-merge queued; CI running |
| pgTAP forward-fix (post `--debug` output) | ⏳ Watch CI for the actual error then file PR |
| Task #30 Batch 2 (RFI helpers + simple project-scoped, ~10 fns) | ⏳ Next session |
| Task #30 Batch 3-6 | ⏳ Subsequent sessions (~4-7 days total) |
| BRT Sub-1 Org Provisioning kickoff | ⏳ Parallel-track once Task #30 batch cadence is established |
| Walker initials on 4 decision docs | ⏳ Async — review at convenience |
| `SUPABASE_ACCESS_TOKEN` secret confirmation | ⏳ Walker |

## Per Standing Decisions §10 — no pings sent

All work today was in-scope of the Roadmap directive. No novel P0 escalation, no MCP write failure (Batch 1 applied cleanly first try), no live-state surprise. Receipt is the routine async sign-off artifact per §9.

— End of Phase 1 Day 1 receipt —
