# Deployment

This is the release runbook for the deployed app and the deployed edge functions.

## Components

| Component | Hosted on | Source |
| --- | --- | --- |
| Web app | Static (Vite build → CDN) | `src/`, [vite.config.ts](../../vite.config.ts), [vercel.json](../../vercel.json) |
| iOS app | App Store via Capacitor | [capacitor.config.ts](../../capacitor.config.ts), [ios/](../../ios) |
| Android app | Play Store via Capacitor | [capacitor.config.ts](../../capacitor.config.ts), [android/](../../android) |
| Database + RLS | Supabase | [supabase/migrations](../../supabase/migrations) |
| Edge functions | Supabase | [supabase/functions](../../supabase/functions) |
| Object storage | Supabase Storage | (see migrations referencing `storage` schema) |

## Environments

- **Local** — `npm run dev` runs Vite against Supabase using local env vars.
- **Preview** — every PR auto-deploys to a preview URL via the static-host integration.
- **Production** — `main` branch deploys to production. Database migrations are applied via `supabase db push`.

## CI / CD

The GitHub Actions workflows live in [.github/workflows](../../.github/workflows). Notable workflows:

- [build.yml](../../.github/workflows/build.yml) — primary build + test gate
- [test.yml](../../.github/workflows/test.yml) — unit + e2e test runs
- [perf.yml](../../.github/workflows/perf.yml) — performance regression watchdog
- [restore-drill.yml](../../.github/workflows/restore-drill.yml) — monthly DR drill (see [DR.md](DR.md))
- [docs-check.yml](../../.github/workflows/docs-check.yml) — runs the [scripts/check-doc-links.ts](../../scripts/check-doc-links.ts) link checker on every PR

## Release procedure

### Web app

1. PR opened → CI runs build, lint, tests, link checker, perf check.
2. Review approves.
3. PR merges to `main`. Deploy is automatic.
4. Verify the deploy by smoke-testing the primary flows: sign in, project list, RFI list, daily log save.
5. If something breaks: revert the merge or push a forward fix; the host-side deployment auto-promotes the new HEAD.

### Database migrations

Migrations live in [supabase/migrations](../../supabase/migrations). Conventions:

- Strictly increasing timestamp prefix (e.g., `20260503120000_*.sql`)
- Idempotent: `CREATE … IF NOT EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY`, `ADD COLUMN IF NOT EXISTS`
- Runnable via `supabase db push`

Every wave's docs (e.g., [PLATINUM_FINANCIAL.md](../PLATINUM_FINANCIAL.md), [ENTERPRISE_ADOPTION_PACK.md](../ENTERPRISE_ADOPTION_PACK.md)) calls out the latest existing timestamp before its work and the new range it adds, so timestamp collisions are caught at PR time.

### Edge functions

Deployed via `supabase functions deploy <name>`. The function inventory:

- Inventory + descriptions: [supabase/functions/EDGE_FUNCTIONS_GUIDE.md](../../supabase/functions/EDGE_FUNCTIONS_GUIDE.md)
- Quick reference: [supabase/functions/QUICK_REFERENCE.md](../../supabase/functions/QUICK_REFERENCE.md)
- Examples + invocation: [supabase/functions/EXAMPLES.sh](../../supabase/functions/EXAMPLES.sh)

Functions share helpers via [supabase/functions/shared](../../supabase/functions/shared) — Deno can't import from `src/`, so any code needed in both runtimes is duplicated explicitly under `shared/`.

### iOS / Android

Build via:

```
npm run cap:build:ios
npm run cap:build:android
```

(See `package.json` scripts.) Submit to the stores per the team's app-store runbook at [APP_STORE_RUNBOOK.md](../../APP_STORE_RUNBOOK.md). Apple Developer Program enrollment status is tracked in the team's auto-memory; TestFlight unblocks once enrollment finalizes.

## Bundle and performance gates

- Bundle size check: `npm run bundle:check` (script: [scripts/check-bundle-size.js](../../scripts/check-bundle-size.js)).
- Performance ratchet: [scripts/enforce-performance-ratchet.js](../../scripts/enforce-performance-ratchet.js).
- Bundle is currently 1.87 MB against a 250 KB target per [HONEST_STATE.md](../../HONEST_STATE.md). Each new release should hold or improve.

## Cron jobs

Scheduled jobs use either pg_cron in Postgres or Supabase scheduled triggers in `supabase/config.toml`. Active cron registrations include:

- Notification queue worker: [supabase/migrations/20260430160000_notification_queue_worker_cron.sql](../../supabase/migrations/20260430160000_notification_queue_worker_cron.sql)
- Portfolio summary refresh: [supabase/migrations/20260502130000_portfolio_summary_refresh_cron.sql](../../supabase/migrations/20260502130000_portfolio_summary_refresh_cron.sql)

Pending cron registrations (per [STATUS.md](../STATUS.md)):

- COI expiration watcher: [supabase/functions/coi-expiration-watcher/index.ts](../../supabase/functions/coi-expiration-watcher/index.ts) — daily 06:00 UTC
- Digest flusher: [supabase/functions/digest-flusher/index.ts](../../supabase/functions/digest-flusher/index.ts) — every 5 minutes

Confirm `CRON_SECRET` is set in production for any cron-driven function.

## Rollback

- **Web app** — revert the merge or roll the static deploy back via the host's UI.
- **Migrations** — every migration is intended to be additive and idempotent. Rolling back a column add is rarely needed; if it is, a follow-up migration drops the column. Never rewrite a migration after it has run in production.
- **Edge function** — `supabase functions deploy <name>` from a prior commit.

## Observability

See [MONITORING.md](MONITORING.md) for what to watch and where alerts go.
