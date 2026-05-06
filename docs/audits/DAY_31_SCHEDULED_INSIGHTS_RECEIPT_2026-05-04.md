# Day 31 — Scheduled Insights Foundation + Aging Detector Live

**Date:** 2026-05-04
**Lap:** Lap 2 Week 5, Day 31 (executed during Day-30.x pre-flight push because the foundation must precede the daily detector wiring).
**Spec:** `docs/audits/SCHEDULED_INSIGHTS_SPEC_2026-05-04.md`
**ADR:** `docs/audits/ADR_003_HYBRID_CRON_2026-05-04.md` (promoted to standalone today)
**Depends on:** Day 30.5 telemetry, Day 30.75 gate matview/CI.

---

## What shipped (Day 31 scope: foundation + aging detector)

### 4 SQL migrations — 519 net lines

1. **`20260504020003_organizations_soft_pilot_flag.sql` (35 lines)** — adds `is_soft_pilot`, `soft_pilot_started_at`, `soft_pilot_agreement_signed_at` columns + partial index. Load-bearing for both this spec AND `SOFT_PILOT_PLAYBOOK`. Default FALSE → no behavior change for existing orgs until Walker explicitly flips one.

2. **`20260504020000_scheduled_insights_heartbeat.sql` (180 lines)** — Tier 1 + Tier 2 of ADR-003.
   - `pgmq.create('insights_jobs')` — the queue.
   - `enqueue_insights_jobs()` SECURITY DEFINER fn — fans out 1 job per (active pilot project × 5 detectors) per tick.
   - Two cron schedules: `insights-heartbeat` (every 15 min) and `insights-worker-invoke` (every 5 min — picks up jobs more often than they're enqueued so latency stays low).
   - Graceful no-op when pg_cron / pg_net / pgmq are absent (mirrors `notification-queue-worker-cron` pattern). Migration applies cleanly even before extensions are enabled; the very next tick fans out once they are.

3. **`20260504020001_drafted_action_dedupe.sql` (211 lines)** — the atomic-promotion contract.
   - `projects.max_drafts_per_day` column (default 50, range [0, 1000]).
   - `drafted_action_dedupe` table keyed on `(insight_kind, primary_entity_id, project_id, created_at)` with FK CASCADE to drafts.
   - `promote_insight_to_draft(jsonb, uuid)` SECURITY DEFINER RPC — enforces every spec gate atomically:
     - severity ∈ {high, critical}
     - confidence ≥ 0.7
     - 24h dedupe (kind + entity + project)
     - per-project daily cap
     - pause-on-incident (uses `lap_2_open_incident_count()` from Day 30.75; tolerates absence via plpgsql exception handler so this migration applies standalone)
   - `withdraw_stale_draft(uuid, text)` RPC — uses the same telemetry GUC bypass as the user-driven mutation so the trigger doesn't reject the system write. Decision note prefixed `[withdrawn by system]` so the gate matview's `auto_withdrawn_count` diagnostic and the spec's exclusion rule both pick it up.

4. **`20260504020002_scheduled_insights_log.sql` (93 lines)** — observability table + 30-day retention prune.
   - `scheduled_insights_log` keyed per-(project × detector × invocation) with `computed_count`, `promoted_count`, `withdrawn_count`, `duration_ms`, `outcome`, `error_message`.
   - 3 indexes: throughput, per-project drill-down, partial on failed/abandoned.
   - RLS — admin-of-related-org SELECT only; service-role inserts.
   - Daily prune cron at 04:13 UTC (off-peak; out of the 18:00-UTC gate-workflow window).

### 1 edge function — 424 lines

`supabase/functions/scheduled-insights-worker/index.ts` (single file, mirroring the `notification-queue-worker` pattern):

- **Auth** via cron-shared secret OR service-role bearer; 401 otherwise.
- **Pull-N-at-once**: `pgmq_read` with batch size 10, vt 60s. 5s/job timeout × 10 = 50s budget within edge-fn 60s ceiling, 10s slack.
- **Detector dispatch** via `DETECTORS` map. Day 31 ships `aging` only; Days 32–35 add `cascade`/`variance`/`staffing`/`weather` by dropping a function into the same map (queue contract unchanged).
- **Aging detector** (`detectAndPromoteAgingRfis`) — mirrors `src/services/iris/insights.ts:detectAgingRfis`:
  - Pulls open RFIs ≥ 5 days overdue
  - Joins linked critical-path activities
  - Computes inferred slip (uses `schedule_impact_days` field if set, else `overdue - max(0, float_days)`)
  - Severity keyed on slip: ≥10d critical, ≥5d high, otherwise medium (medium drops below the promotion floor and is filtered)
  - Builds the insight envelope with action_type `rfi.draft`, primary entity `rfi`, two citations (rfi_reference + schedule_phase), `payload.insightKind = 'aging'` for the withdrawal sweep
  - Calls `promote_insight_to_draft` RPC; the RPC enforces the gates atomically
- **Stale-draft sweep** (`sweepStaleAgingDrafts`) — for every pending aging draft in the project, queries the underlying RFI's current status; withdraws via `withdraw_stale_draft` RPC if the RFI moved out of an open state. Defensive: when the RFI's status is unknown (e.g. transient query failure) the draft is left alone — the spec's auto-withdraw policy (ADR-007) is "withdraw only on confirmed state change."
- **Retry/abandon**: failed jobs get exponential vt backoff (2^attempt minutes, capped 15 min). After 3 attempts the job archives and a `scheduled_insights_log` row lands with `outcome='abandoned'`.
- **Per-job timeout** (5s) wrapped via `withTimeout` so a single hung detector doesn't starve the batch.
- **Logging best-effort** — failure to write the log row never crashes the worker. The matview metrics are gathered from `drafted_actions` directly.

### 1 ADR promoted to standalone

`docs/audits/ADR_003_HYBRID_CRON_2026-05-04.md` (120 lines) — the full ADR, previously inline in the spec, now a citable document. Includes failure-mode table, rollback plan, and the locked/tunable inventory.

### INDEX.md, spec status

- ADR-003 row points at the new file (was inline-only).
- `SCHEDULED_INSIGHTS_SPEC` status flipped from "🟢 Spec ready" to "🟡 Foundation + aging shipped (Day 31); Days 32–35 add cascade/variance/staffing/weather".
- Day 31 row added.

---

## Verification

- `npm run typecheck` — **0 errors**. Both tsconfigs green. Bugatti gate holds.
- The 4 migrations apply cleanly **in isolation** — each one tolerates the absence of its predecessors via `IF NOT EXISTS` / extension-presence guards. Order-dependent calls (e.g. `promote_insight_to_draft` calling `lap_2_open_incident_count()`) are wrapped in plpgsql exception handlers so a partial deploy doesn't error.

**Tests deferred** to staging-deploy: pgmq + worker integration is intrinsically DB-bound. Vitest unit coverage of the worker's pure logic (severity assignment, dedupe envelope construction) is queued for Day 32 alongside the cascade detector — the test fixtures generalize across detectors.

---

## What's now possible

- **Pilot users wake up to drafts.** Once an org gets `is_soft_pilot = TRUE` and pg_cron/pgmq are enabled, the heartbeat fans out every 15 min and the worker promotes eligible aging insights every 5 min.
- **Backlog is observable in SQL.** `SELECT count(*) FROM pgmq.q_insights_jobs;` is the dashboard-of-one for the pipeline.
- **Stale drafts withdraw themselves.** When an architect answers an aged RFI mid-flight, the next worker tick withdraws the matching draft with a `[withdrawn by system]` note. The gate's rate metric stays honest (excludes withdrawals from numerator and denominator per spec).
- **Adding a detector = adding a function.** Days 32–35 land cascade, variance, staffing, weather by dropping handlers into `DETECTORS` in the worker. Migrations don't change. RPC contract doesn't change.

---

## What's blocked, but only on extensions / ops

- **pgmq, pg_cron, pg_net** must be enabled on staging Supabase. Each migration's `RAISE NOTICE` no-op path means the deploy doesn't fail; the heartbeat just enqueues 0 jobs until ops enables them.
- **`app.supabase_url` and `app.service_role_key` GUCs** must be set on staging for `net.http_post` to invoke the worker (same requirement as `notification-queue-worker`).

These are one-time ops steps already documented for the existing notification worker; no new burden.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/migrations/20260504020003_organizations_soft_pilot_flag.sql` | NEW | 35 |
| `supabase/migrations/20260504020000_scheduled_insights_heartbeat.sql` | NEW | 180 |
| `supabase/migrations/20260504020001_drafted_action_dedupe.sql` | NEW | 211 |
| `supabase/migrations/20260504020002_scheduled_insights_log.sql` | NEW | 93 |
| `supabase/functions/scheduled-insights-worker/index.ts` | NEW | 424 |
| `docs/audits/ADR_003_HYBRID_CRON_2026-05-04.md` | NEW (promoted from inline) | 120 |
| `docs/audits/INDEX.md` | EDIT — ADR-003 row, spec status, Day 31 receipt | +1 |
| `docs/audits/DAY_31_SCHEDULED_INSIGHTS_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new:** ~1,060 lines of production code + ADR. **Combined session pre-flight total** (Day 30.5 + 30.75 + 31): ~2,710 lines / 27 unit tests.

---

## Next-day pickup

Day 32 plan, in order:
1. Add `cascade` detector to the worker's `DETECTORS` map (pulls submittals × schedule joins; severity from days-of-slip).
2. Add Vitest unit coverage of the **insight-envelope construction** logic — severity assignment, payload shape, citation ordering. Pure functions, no DB mocking required (extract them from the worker into `supabase/functions/scheduled-insights-worker/insightEnvelope.ts` and import-test from `scripts/__tests__/`).
3. Verify on staging: enable pgmq/pg_cron/pg_net; flip a test project's org to `is_soft_pilot=TRUE`; seed an aging RFI; wait one tick; assert a draft lands; mark the RFI answered; wait another tick; assert the draft withdraws.

Day 33: variance detector. Day 34: staffing. Day 35: weather + Walker reviews 30 drafts and rates them.
