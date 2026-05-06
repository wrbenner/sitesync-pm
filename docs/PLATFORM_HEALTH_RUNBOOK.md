# Platform Health Runbook

> Mortenson's IT director: "Of the 60+ edge functions in your repo,
> how many are actually deployed? Of the 200+ migrations, how many are
> actually applied to my org's database? Of the cron jobs you say run
> nightly, how many actually fire?"

This runbook answers all three questions from real data, every day.

## The audit at a glance — current snapshot

As of the most recent audit (see `audit/platform-health-baseline.json`):

| Layer | Repo | Cloud | Drift |
| --- | --- | --- | --- |
| Edge functions | 101 | 54 | **47 missing** |
| Migrations | 214 | 160 | **54 missing** |
| Cron extensions | expected | NONE | **pg_cron + pg_net not installed** |
| Secrets | 40 distinct keys referenced | — | 0 undocumented |

**Status: degraded.** Three blocking issues:
1. pg_cron + pg_net not installed → every nightly job is silent
2. 47 edge functions in repo but not deployed (recent session work)
3. 54 migrations in repo but not applied (schema is behind code)

## How the audit runs

```
┌─────────────────────────────────────────────────────────────────────┐
│  scripts/audit-edge-functions.ts                                    │
│    → Supabase API GET /v1/projects/<ref>/functions                  │
│    → cross-reference supabase/functions/<dir>                       │
│    → audit/edge-function-status.md                                  │
│                                                                     │
│  scripts/audit-migrations.ts                                        │
│    → SELECT version FROM supabase_migrations.schema_migrations      │
│    → ls supabase/migrations/*.sql                                   │
│    → audit/migration-status.md                                      │
│                                                                     │
│  scripts/audit-cron.ts                                              │
│    → SELECT * FROM cron.job + cron.job_run_details                  │
│    → check pg_cron + pg_net in pg_extension                         │
│    → audit/cron-status.md                                           │
│                                                                     │
│  supabase/functions/platform-health/index.ts                        │
│    → GET — returns JSON with overall_status: green/degraded/critical│
│    → 200 only when green; 503 with detail otherwise                 │
│    → service-role required; never returns counts to anonymous       │
│                                                                     │
│  scripts/sync-platform.ts                                           │
│    → composes the audits + applies fixes with explicit confirmation │
│    → migrations FIRST (functions often depend on new schema)        │
└─────────────────────────────────────────────────────────────────────┘
```

## Triggers

- **Daily at 09:00 UTC** via `.github/workflows/platform-health.yml`
- **On every PR** that touches `supabase/functions/**` or `supabase/migrations/**`
- **Manual** via `workflow_dispatch` from the Actions tab
- **Live** via `GET /functions/v1/platform-health` with service-role auth

## How to fix the current drift

### 1. Install pg_cron + pg_net (if on Pro+ tier)

```sql
-- Via Supabase SQL editor as service-role:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

If the project is on Free tier, neither extension is available.
Workaround: GitHub Actions `schedule:` triggers for the most important
nightly jobs. Trade-off: less scheduling fidelity, no in-DB job history.

### 2. Apply the 54 missing migrations

```bash
export SUPABASE_PROJECT_REF=hypxrmcppjfbtlwuoafc
export DATABASE_URL='<from supabase status>'

# Dry-run first
bun scripts/audit-migrations.ts

# Apply
supabase db push --include-all --project-ref $SUPABASE_PROJECT_REF
```

The 54 missing migrations all have timestamps later than the latest
applied (`20260428110000`), so the apply order is unambiguous.

### 3. Deploy the 47 missing edge functions

**Apply migrations first** — several of the missing functions reference
tables that only exist after the new migrations.

```bash
# Dry-run plan
bun scripts/sync-platform.ts

# Apply with prompt
SUPABASE_ACCESS_TOKEN=sbp_... bun scripts/sync-platform.ts --apply

# CI-friendly (no prompt)
SUPABASE_ACCESS_TOKEN=sbp_... bun scripts/sync-platform.ts --apply --yes
```

### 4. Schedule cron-driven jobs

Once pg_cron is installed:

```sql
-- Materialized view refresh every 5 min
SELECT cron.schedule(
  'refresh-materialized-views',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://hypxrmcppjfbtlwuoafc.supabase.co/functions/v1/refresh-materialized-views',
       headers := jsonb_build_object('authorization', 'Bearer ' || current_setting('app.cron_secret'))
     ) $$
);

-- Preliminary-notice watcher daily at 7am
SELECT cron.schedule(
  'preliminary-notice-watcher',
  '0 7 * * *',
  $$ SELECT net.http_post(
       url := 'https://hypxrmcppjfbtlwuoafc.supabase.co/functions/v1/preliminary-notice-watcher',
       headers := jsonb_build_object('authorization', 'Bearer ' || current_setting('app.cron_secret'))
     ) $$
);

-- Insurance + bond watcher daily at 7:15am
SELECT cron.schedule(
  'insurance-bond-watcher',
  '15 7 * * *',
  $$ SELECT net.http_post(
       url := 'https://hypxrmcppjfbtlwuoafc.supabase.co/functions/v1/insurance-bond-watcher',
       headers := jsonb_build_object('authorization', 'Bearer ' || current_setting('app.cron_secret'))
     ) $$
);

-- Prevailing wage sync weekly Sunday at 4am
SELECT cron.schedule(
  'prevailing-wage-sync',
  '0 4 * * 0',
  $$ SELECT net.http_post(
       url := 'https://hypxrmcppjfbtlwuoafc.supabase.co/functions/v1/prevailing-wage-sync',
       headers := jsonb_build_object('authorization', 'Bearer ' || current_setting('app.cron_secret'))
     ) $$
);
```

`current_setting('app.cron_secret')` requires a one-time `ALTER DATABASE`:

```sql
ALTER DATABASE postgres SET app.cron_secret TO '<value of CRON_SECRET env var>';
```

## Verifying after sync

```bash
# Should return 200 + green
curl -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     https://hypxrmcppjfbtlwuoafc.supabase.co/functions/v1/platform-health

# Re-audit + commit the new reports
bun scripts/audit-edge-functions.ts
bun scripts/audit-migrations.ts
bun scripts/audit-cron.ts
git add audit/
git commit -m "platform: post-sync audit"
```

## Bullet-proofing (failure modes addressed)

| Failure | Handling |
| --- | --- |
| Multiple Supabase projects (we have 2: ss pm + wrbenner's) | Audit each separately via `SUPABASE_PROJECT_REF` env. Primary is `hypxrmcppjfbtlwuoafc`. |
| pg_cron not yet enabled | Cron audit reports "extension not enabled" with non-zero exit. Sync runner detects + advises. |
| Migration order has gaps | `audit-migrations.ts` flags out-of-order timestamps. Sync runner refuses to apply backdated migrations without explicit override. |
| Edge function deploy fails | sync-platform iterates per-function; failure of one doesn't abort the rest. Final exit code reflects any failure. |
| pg_net not enabled | Cron audit explicit error. Cron migrations no-op via existing `IF EXISTS` guards on the extension. |
| Old migration was hand-edited in prod | Manual-SQL detection in `audit-migrations.ts`. Never auto-overwrite. |
| Health endpoint exposed publicly | `platform-health/index.ts` requires bearer to match service-role key. Anonymous gets 401. |

## Out of scope for sync-platform

The runner identifies and reports drift; it does **not**:
- modify edge function source
- modify migration files
- modify cron schedules

All three would be silent disasters in production. Source changes go
through PRs, migrations go through `supabase/migrations/`, schedules go
through SQL the operator runs explicitly. The runner's job is to apply
what's already in the repo, never invent.

## Per-deployment checklist (new project / new environment)

1. Run `bun scripts/audit-edge-functions.ts` and `bun scripts/audit-migrations.ts` — capture baseline drift
2. Confirm `pg_cron` + `pg_net` extensions enabled (or document that scheduled jobs are deferred)
3. Run `bun scripts/sync-platform.ts --apply` to bring functions + migrations in sync
4. Set required secrets per `audit/secrets-checklist.md`
5. Schedule cron-driven jobs from the SQL block above
6. Verify `GET /functions/v1/platform-health` returns 200
7. Commit the resulting `audit/*.md` files as the "deploy baseline"
