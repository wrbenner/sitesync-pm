# Disaster Recovery Runbook

> CISO sends a 12-question survey: RTO commitment, RPO, where's the data,
> who has access to backups.

This doc answers all 12 in language the customer's CISO can copy into
their vendor-risk register.

## Commitments

| Metric | Commitment | Source of truth |
| --- | --- | --- |
| RTO  | 4 hours for full-region restore. 30 minutes for point-in-time within the PITR window. | Supabase Pro/Team SLA + this team's restore drill |
| RPO  | 5 minutes within the PITR window; 24 hours for full-region disaster | Supabase WAL-archive + nightly snapshot |
| PITR window | 7 days on Pro tier; 28 days on Team tier (current); extensible to 90 days as a paid add-on | Supabase Project Settings → Backups |

## Where the data lives

- **Primary**: Supabase Postgres in `us-west-2` (configurable per organization).
- **WAL archive**: Supabase-managed, same region.
- **Nightly snapshot**: Supabase-managed, retained per the PITR window above.
- **Customer S3 export** (optional, see `customer-s3-export` edge function): customer-managed bucket in customer's account. We never have ongoing access to the customer's analytics warehouse.
- **Object storage** (uploaded photos, drawings, files): Supabase Storage, same region.

## Who has access

- **Production write access**: limited to two engineers via a quarterly-rotated short-lived token. Audited in `audit_log` via the `service_role` connection trail.
- **Production read-only**: any engineer on call. Read-only connections do not assume `service_role`.
- **Customer's data**: only the customer's `project_members`. RLS enforced at every table; no app-side bypass.
- **Backups**: Supabase platform team only. We do not export Supabase-managed snapshots — the customer's own S3 export (above) is the customer-controlled copy.

## Restore procedure (PITR — common case)

When: data was deleted or corrupted within the PITR window. RTO target: 30 min.

1. **Identify the target time.** From `audit_log`, find the last known-good state. If the corruption span is uncertain, prefer "10 minutes before the first impacted action."
2. **Open Supabase dashboard → Database → Backups → Point-in-time recovery.**
3. **Pick the target time.** Supabase clones the DB at that point into a new project.
4. **Smoke-test the clone:**
   - `SELECT count(*) FROM projects;` matches expected
   - `SELECT max(created_at) FROM activity_feed;` is consistent with the target time
   - `SELECT * FROM audit_chain_checkpoints ORDER BY sequence DESC LIMIT 1;` chain hash matches the last known-good (see PLATINUM_FIELD.md verifier)
5. **Promote the clone OR cherry-pick.** If the entire DB needs replacing: switch the app's connection string to the clone, run a backfill of any post-restore writes that should survive. If only specific rows: `pg_dump --table=...` from the clone, restore selectively into prod.
6. **Notify the customer.** Even if they never noticed, tell them what happened, when, and what's restored. Their CISO will ask anyway.

## Restore procedure (full-region disaster)

When: AWS region outage, primary DB unrecoverable. RTO target: 4 hours.

1. **Confirm the region is down via the AWS Health Dashboard.**
2. **Provision a new Supabase project in a healthy region.**
3. **Restore from the last nightly snapshot** (Supabase will surface the most recent snapshot for the affected project). If the snapshot is in the same region as the failure, escalate to Supabase support — they keep cross-region copies.
4. **Re-run all migrations** to confirm schema consistency on the restored DB.
5. **Switch app DNS / Vercel env to the new project.** Smoke-test the app's primary flows: sign in, project list, RFI list.
6. **Backfill** any writes that landed in WAL after the snapshot but before the failure — Supabase will provide WAL extracts on request.
7. **Notify the customer.**

## Monthly drill (`.github/workflows/restore-drill.yml`)

Runs the first Tuesday of each month. Validates:
- Restore target is reachable
- Schema sanity check (full implementation TODO in `scripts/restore-sanity.ts`)
- Most recent daily_log row is < 25 hours old (PITR window confirmed live)
- Sentinel row in `projects` matches the seed (no drift)

Failure routes via `RESTORE_ALERT_WEBHOOK` to ops Slack.

## Things to confirm with the customer's CISO

- [ ] Is their data residency requirement compatible with `us-west-2`? Supabase regions: `us-west-1`, `us-east-1`, `us-east-2`, `eu-west-1`, `eu-central-1`, `ap-southeast-1`, `ap-southeast-2`, `ap-south-1`, `ap-northeast-1`, `ca-central-1`, `sa-east-1`.
- [ ] Does their compliance regime require longer than 28-day PITR? If so, quote the extended-retention add-on.
- [ ] Does their security review require SSAE-18 / SOC 2 attestations? Supabase's are linked from their platform docs.
- [ ] Do they need their own customer-managed encryption keys (BYOK)? Currently we use Supabase platform keys; BYOK is a roadmap item for Team-tier customers.
- [ ] Do they require a tabletop exercise of the restore procedure with their SOC team? We've run the monthly drill; we can co-run a tabletop with their team for a flat fee.

## Escalation paths

| Scenario | Primary | Secondary | Vendor |
| --- | --- | --- | --- |
| Suspected data loss | On-call engineer (PagerDuty) | Engineering lead | Supabase support — paid tier opens within 1 hour |
| Region outage | Engineering lead | CTO | AWS support + Supabase support |
| Customer-reported corruption | Account manager | Engineering lead | Supabase, after we've reproduced |

## Audit trail

Every restore action writes to `audit_log` with `entity_type='dr_action'` and the runbook step ID. The customer's CISO can pull a CSV via the audit-log export.
