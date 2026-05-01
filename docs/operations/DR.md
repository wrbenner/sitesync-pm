# Disaster Recovery (Operations Reference)

The full DR runbook is in [docs/DR_RUNBOOK.md](../DR_RUNBOOK.md). This page is the operations-team summary — the quick-card you reach for when something has happened.

## Targets

Per the Pro tier — see [business/SLA.md](../business/SLA.md):

- **RTO** — 4 hours full-region restore; 30 minutes for point-in-time within the PITR window.
- **RPO** — 5 minutes within the PITR window; 24 hours for full-region disaster.
- **PITR window** — 7 days on Pro tier; 28 days on Team tier; extensible to 90 days.

Enterprise tier with the residency add-on commits to 1-hour RTO and 1-hour RPO; see [business/SLA.md](../business/SLA.md).

## Where the data lives

| Layer | Location |
| --- | --- |
| Postgres primary | Supabase, `us-west-2` by default (configurable) |
| WAL archive | Supabase-managed, same region |
| Nightly snapshot | Supabase-managed, retained per the PITR window |
| Object storage | Supabase Storage, same region |
| Customer S3 export (optional) | Customer's bucket via [supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts) |

## Common cases

### Point-in-time restore

When: a row was deleted or corrupted within the PITR window.

1. Identify the target time from `audit_log` (use [src/lib/audit/hashChainVerifier.ts](../../src/lib/audit/hashChainVerifier.ts) to confirm the chain hasn't been tampered with at that point).
2. Open Supabase dashboard → Database → Backups → PITR.
3. Pick the target time. Supabase clones the DB at that point.
4. Smoke-test the clone (counts on `projects`, max `created_at` on `activity_feed`, last `audit_chain_checkpoints` row).
5. Promote the clone or cherry-pick rows back into prod.
6. Notify the customer.

Full procedure: [docs/DR_RUNBOOK.md](../DR_RUNBOOK.md).

### Full-region failover

When: the AWS region is down and the primary DB is unrecoverable.

1. Confirm the region is down via the AWS Health Dashboard.
2. Provision a new Supabase project in a healthy region.
3. Restore from the last nightly snapshot.
4. Re-run all migrations in [supabase/migrations](../../supabase/migrations).
5. Switch app DNS / Vercel env to the new project.
6. Backfill from WAL extracts as needed.
7. Notify the customer.

## Monthly drill

The drill runs the first Tuesday of each month per [.github/workflows/restore-drill.yml](../../.github/workflows/restore-drill.yml). It validates:

- Restore target is reachable
- Schema sanity (script TODO; see [STATUS.md](../STATUS.md) pre-existing doc debt)
- Most recent daily_log row is < 25 hours old (PITR window confirmed live)
- Sentinel row in `projects` matches the seed (no drift)

Failures route via the configured alert webhook to ops Slack.

## Audit chain after restore

After any restore, recompute the chain by calling `verify_audit_chain(start_after)` per [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql). If the chain breaks at the restore point, that's expected (the post-restore-point rows were never inserted into the new clone). Document the break in the incident write-up.

## What we tell the customer's CISO

The full questionnaire-friendly doc is [docs/DR_RUNBOOK.md](../DR_RUNBOOK.md). The 12 questions there map directly to a typical vendor risk register.

## Things that block a clean DR run

- **Drift between local migrations and prod schema** — caught by re-running every migration on a fresh DB during the drill.
- **Storage objects not snapshot-aligned with DB** — Supabase Storage and Postgres are coordinated, but cross-table references to storage paths must be revalidated post-restore.
- **Pending wiring** — see [STATUS.md](../STATUS.md). Anything in the wiring backlog can fail in unexpected ways during a drill; flag findings as drill output rather than runtime alarms.
