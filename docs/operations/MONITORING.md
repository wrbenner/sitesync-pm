# Monitoring

This is the runbook for observability. It tells the on-call engineer what to watch, where the signals come from, and where alerts route.

## What is instrumented

| Layer | Signal source |
| --- | --- |
| Frontend errors | [src/lib/sentry.ts](../../src/lib/sentry.ts) |
| Frontend perf vitals | [src/lib/vitals.ts](../../src/lib/vitals.ts) |
| App-level errors | [src/lib/errorTracking.ts](../../src/lib/errorTracking.ts) |
| AI observability | [src/lib/aiObservability.ts](../../src/lib/aiObservability.ts) |
| Audit log integrity | [src/lib/audit/hashChainVerifier.ts](../../src/lib/audit/hashChainVerifier.ts) and the SQL function in [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql) |
| Performance regression | [src/lib/perf/queryRegression.ts](../../src/lib/perf/queryRegression.ts), [src/lib/perf/budgetCheck.ts](../../src/lib/perf/budgetCheck.ts) |

## Dashboards

- **Sentry** — frontend errors, performance, release-tagged. Alert routing per Sentry project config.
- **Supabase dashboard** — DB performance, query plans, slow queries, edge-function invocation stats.
- **Performance dashboard** — built from the perf gates in [scripts/enforce-performance-ratchet.js](../../scripts/enforce-performance-ratchet.js) and the perf workflow at [.github/workflows/perf.yml](../../.github/workflows/perf.yml).

## What to watch on a normal day

| Metric | Threshold | Where to look |
| --- | --- | --- |
| Frontend error rate | > 1% of sessions | Sentry |
| API edge-function p95 latency | > 1500 ms | Supabase function logs |
| DB query regression | any new query in the slow list | Supabase + the PR-time perf workflow |
| Audit chain | non-zero `verify_audit_chain` mismatches | scheduled verifier (see below) |
| Bundle size | > 1.9 MB on main | [scripts/check-bundle-size.js](../../scripts/check-bundle-size.js) |

## Audit chain verification

The chain verifier should run nightly. The SQL function `verify_audit_chain(start_after)` is `SECURITY DEFINER, service_role only` per [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql). Cron the call (or run it on-demand) and alert on any returned row — that row's `broken_at_id` is your debug entry point. See [docs/HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md) for the contract.

## Edge function logs

Each edge function logs to Supabase function logs. Notable functions to watch:

- [supabase/functions/payapp-audit/index.ts](../../supabase/functions/payapp-audit/index.ts) — every override should be paired with a `payapp_audit_overrides` row
- [supabase/functions/coi-expiration-watcher/index.ts](../../supabase/functions/coi-expiration-watcher/index.ts) — every reminder writes to `coi_expiration_alerts` even on email-channel failure
- [supabase/functions/sla-escalator/index.ts](../../supabase/functions/sla-escalator/index.ts) — escalation events
- [supabase/functions/digest-flusher/index.ts](../../supabase/functions/digest-flusher/index.ts) — every 5 minutes when running
- [supabase/functions/portfolio-summary-refresh/index.ts](../../supabase/functions/portfolio-summary-refresh/index.ts) — every 5 minutes when running

## AI cost + behavior

The AI observability surface at [src/lib/aiObservability.ts](../../src/lib/aiObservability.ts) records per-request cost, latency, model, and confidence. Watch:

- Total AI cost per day (budget: TBD; per [PRICING.md](../business/PRICING.md), AI is bundled into seat pricing)
- Per-suggestion confidence distribution (Iris policy in [src/lib/iris/suggestPolicy.ts](../../src/lib/iris/suggestPolicy.ts) is sensitive to confidence)
- Manual-review queue depth from confidence-gated extractions ([src/lib/aiExtract/confidenceGate.ts](../../src/lib/aiExtract/confidenceGate.ts))

## Health-check endpoints

The health-check workflow at [.github/workflows/health-check.yml](../../.github/workflows/health-check.yml) runs continuous synthetic checks against the deployed app.

## Alert routing

| Severity | Channel |
| --- | --- |
| Sev 1 | PagerDuty → on-call engineer |
| Sev 2 | Slack #ops + email to ops list |
| Sev 3 | Slack #ops |

Severity rules: [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md). Rotation: [ONCALL.md](ONCALL.md).

## What is NOT monitored (gaps)

- We do not currently track per-user performance budgets. Per [HONEST_STATE.md](../../HONEST_STATE.md), the bundle is 7.5× over target; first-load is slower than benchmark.
- We do not have a real-time AI cost dashboard. Cost is queryable but not live-graphed.
- We do not auto-track the wiring backlog from [STATUS.md](../STATUS.md) — that list is curated by hand.
