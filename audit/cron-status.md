# Cron Job Status

> Generated 2026-04-29T19:27:02Z against project `hypxrmcppjfbtlwuoafc` (ss pm).
> Re-run with: `bun scripts/audit-cron.ts`

## CRITICAL — pg_cron + pg_net are NOT installed

| Extension | Status | Impact |
| --- | --- | --- |
| pg_cron | **NOT INSTALLED** | Every `cron.schedule(...)` call in the codebase is a no-op. Nightly jobs do not fire. |
| pg_net | **NOT INSTALLED** | Even if pg_cron were enabled, scheduled jobs that POST to edge functions cannot — `net.http_post` is unavailable. |

This is the single most important finding in the platform audit. Every
"runs nightly" claim in our docs (morning briefing, materialized-view
refresh, prevailing-wage-sync, preliminary-notice-watcher,
insurance-bond-watcher, weekly-digest, etc.) is currently silent.

### To enable

```sql
-- One-time, requires service-role:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Supabase tier requirement: pg_cron is available on the `Pro` tier and
above. Confirm the project tier first.

## Expected cron schedules (from migrations)

The repo's cron-related migrations: 20260430160000_notification_queue_worker_cron.sql
20260502130000_portfolio_summary_refresh_cron.sql

Schedules are also embedded in code comments + edge-function docstrings:

| Schedule | Function | Source |
| --- | --- | --- |
| `*/5 * * * *` | refresh-materialized-views | docs/PLATINUM_PERFORMANCE.md |
| `0 14 1-7 * 2` | restore-drill (GH Actions, not pg_cron) | .github/workflows/restore-drill.yml |
| Weekly | prevailing-wage-sync | docs/ENTERPRISE_COMPLIANCE_PACK.md |
| Daily | preliminary-notice-watcher | docs/ENTERPRISE_COMPLIANCE_PACK.md |
| Daily | insurance-bond-watcher | docs/ENTERPRISE_COMPLIANCE_PACK.md |
| 6am daily | morning-briefing | (deferred — function not yet built) |

## Currently scheduled jobs (cron.job table)

```
SELECT jobid, jobname, schedule, command, active
  FROM cron.job
 ORDER BY jobid;
```

Cannot query — pg_cron not installed. Auditor reports
"extension not enabled — schedules pending".

## Recent failures (last 24h)

```
SELECT runid, jobid, status, return_message, end_time
  FROM cron.job_run_details
 WHERE end_time > now() - interval '24 hours'
   AND status != 'succeeded'
 ORDER BY end_time DESC;
```

Cannot query — pg_cron not installed.

## Action items

1. **Enable pg_cron + pg_net.** Requires Pro+ tier. One-time SQL above.
2. **After enabling**, schedule the cron-driven edge functions. Recommended
   wrapper SQL is in each migration's docstring; collect them into a
   single `cron-schedules.sql` once the extensions are live.
3. **Add a self-test to platform-health** that verifies (a) the
   extensions are installed and (b) the expected jobs are scheduled.
4. Consider GitHub Actions `schedule:` triggers as a fallback for
   pre-Pro tier customers — the morning-briefing and similar jobs
   work fine via GH Actions cron, just with less scheduling fidelity.
