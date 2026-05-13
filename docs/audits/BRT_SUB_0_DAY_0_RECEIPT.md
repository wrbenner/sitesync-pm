# BRT Sub-0 — Day 0 Receipt (Preflight)

**Date:** 2026-05-12
**Branch:** `brt/sub-0-day-0-preflight`
**Operator:** Claude (Opus 4.7 1M-ctx)
**Reviewer / advisor-runner:** walker@sitesyncai.com
**Linked plan:** `~/.claude/plans/wise-finding-hippo.md`
**Linked specs:** `BRT_SUBSYSTEM_0_P0_SPRINT_2026-05-12.md`, `STAGE_1_FOUNDATION_AUDIT_2026-05-12.md`, `STAGE_2_SCALE_AUDIT_2026-05-12.md` (in `/sitesync-pm`)

## Purpose

Day 0 prepares the ground for the 5-day P0 hardening sprint:

1. Reconcile live Supabase project against repo migrations — the Stage 2 audit names 7 matviews and 8 cross-tenant buckets, but only 5 matviews and 6 buckets are declared in `supabase/migrations/`. The drift means the repo is not authoritative; later policy fixes can't safely land until live is reflected in migrations.
2. Stand up the pgTAP harness — Days 2–3 cross-tenant fixtures will be written in SQL. Per Walker's Day 0 decision, fixtures go in pgTAP (not pure-manual or TS-only).

## Deliverables landed in this PR

| Path | Purpose |
|------|---------|
| `supabase/migrations/20261012000000_p0_preflight_pgtap.sql` | Installs pgTAP into `extensions` schema, idempotent |
| `supabase/tests/database/000_smoke.sql` | Two-assertion smoke test proving the harness is wired |
| `supabase/tests/database/README.md` | Test conventions: skeleton, two-JWT pattern, naming, CI |
| `.github/workflows/pgtap.yml` | New CI workflow: `supabase start` → `supabase test db` on PRs touching migrations or SQL tests |

**Not in this PR — Walker action required (see § Open items below):**

- Sync migrations for the matviews / buckets / SECURITY DEFINER views that exist in live but not in repo. The DDL has to come from a live `pg_get_viewdef()` / `pg_dump` run; this PR cannot synthesize it. A follow-up `brt/sub-0-day-0-preflight-sync` PR will land the sync migrations once Walker pastes the live output below.

## Live-state inventory — SQL to run in Cowork session

Walker: please run these three queries against the **live** project (read-only) and paste output into the slots below. Once filled in, I'll generate the sync migrations and ship a follow-up PR.

### Matviews

```sql
-- Inventory of materialized views in public schema
SELECT
  schemaname,
  matviewname,
  ispopulated,
  pg_size_pretty(pg_relation_size(format('%I.%I', schemaname, matviewname)::regclass)) AS size
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

-- Per-matview definition (capture for DDL sync)
SELECT
  schemaname,
  matviewname,
  pg_get_viewdef(format('%I.%I', schemaname, matviewname)::regclass) AS definition
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

-- Privileges on matviews (anon + authenticated readability — the P0-A finding)
SELECT
  c.relname AS matview,
  array_agg(format('%s=%s', grantee, privilege_type) ORDER BY grantee, privilege_type) AS grants
FROM information_schema.role_table_grants g
JOIN pg_class c ON c.relname = g.table_name
WHERE c.relkind = 'm'
  AND g.table_schema = 'public'
  AND g.grantee IN ('anon', 'authenticated')
GROUP BY c.relname
ORDER BY c.relname;
```

**Expected names (per Stage 2 audit):** `project_health_summary`, `pay_app_status_summary`, `project_metrics`, `punch_list_status_rollup`, `rfi_kpi_rollup`, `submittals_log_mv`, `lap_2_gate_metrics_daily`.

**Currently declared in repo (`supabase/migrations/20260503110002_materialized_views.sql`):** the first 5.

**Probably-missing-from-repo:** `submittals_log_mv`, `lap_2_gate_metrics_daily`. Confirm with the live query above.

#### Live output paste-in (Walker)

```
<paste pg_matviews query output here>
```

### Storage buckets

```sql
-- Bucket declarations + per-bucket configuration
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY id;

-- Storage policies on objects table (the P0-F finding lives here)
SELECT
  pol.policyname,
  pol.cmd,
  pol.roles::text[] AS roles,
  pol.qual AS using_predicate,
  pol.with_check AS check_predicate
FROM pg_policies pol
WHERE pol.schemaname = 'storage' AND pol.tablename = 'objects'
ORDER BY pol.policyname;

-- Sample of object paths per bucket — confirms folder structure
-- (Day 3b gate depends on whether paths encode project_id at folder level 1)
SELECT
  bucket_id,
  count(*) AS object_count,
  array_agg(DISTINCT split_part(name, '/', 1)) FILTER (
    WHERE split_part(name, '/', 1) <> ''
  ) AS top_level_folders
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;
```

**Expected cross-tenant-policy buckets (per Stage 2 audit P0-F):** `attachments`, `documents`, `reports`, `safety-photos`, `submittal-specs`, `daily-log-photos`, `daily-log-signatures`, `punch-list-photos`.

**Expected properly-scoped buckets:** `drawings`, `exports`, `field-captures`, `project-files`.

**Currently declared in repo (`supabase/migrations/00003_storage_buckets.sql` + `20260506000002_sealed_exports_bucket.sql`):** 6 buckets — `project-files`, `drawings`, `field-captures`, `avatars`, `exports`, sealed-exports.

**Discrepancy:** Walker's note mentioned "6 currently-empty buckets" — needs reconciliation with audit's 8-bucket list. The third query above answers this.

#### Live output paste-in (Walker)

```
<paste buckets + policies + object-folder query output here>
```

### SECURITY DEFINER views

```sql
-- Find all views with security_invoker = false (i.e. SECURITY DEFINER semantics)
SELECT
  n.nspname AS schema,
  c.relname AS view,
  c.reloptions,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND (
    c.reloptions IS NULL
    OR NOT (c.reloptions @> ARRAY['security_invoker=true'])
  )
ORDER BY c.relname;

-- Per-view definition (capture for DDL sync if missing from repo)
SELECT
  n.nspname,
  c.relname,
  pg_get_viewdef(format('%I.%I', n.nspname, c.relname)::regclass) AS definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN (
    'iris_ingest_queue_depth',
    'iris_kb_health_daily',
    'iris_kb_retrieval_p95_1h',
    'iris_kb_source_coverage_7d',
    'org_executor_cancel_rate_7d',
    'executor_daily_counts'
  )
ORDER BY c.relname;
```

**Expected (per Stage 1 audit P0-B):** the 6 listed above.

#### Live output paste-in (Walker)

```
<paste SD view query output here>
```

## pgTAP harness — smoke verification

After this PR merges to `main`, the `pgtap.yml` workflow will fire on the next migration-touching PR. To verify locally before merge:

```bash
cd /Users/walkerbenner/Desktop/sitesync-main
supabase start    # boots ephemeral Postgres with all migrations applied
supabase test db  # discovers supabase/tests/database/*.sql, runs them
supabase stop --no-backup
```

Expected output for `000_smoke.sql`:

```
# Subtest: 000_smoke
ok 1 - pgtap extension is installed
ok 2 - extensions.plan() helper is callable
1..2
ok 1 - 000_smoke
```

### Smoke run result (filled in at CI green)

```
<paste `supabase test db` output once the pgtap.yml workflow has run on this PR>
```

## Open items / hand-off to Day 1

1. **Walker:** paste the three live-inventory query outputs above.
2. **Walker:** sign off on the bucket-count reconciliation question — is the audit's 8-bucket list correct, or do some of those buckets not actually exist in live and the audit was over-reporting? The third storage query (`top_level_folders` per bucket) answers both that and the Day 3b gate question in one shot.
3. **Operator (Claude, next session):** once #1 lands, generate `20261012000001_p0_preflight_sync.sql` with the missing matview / bucket / SD-view DDL and ship as `brt/sub-0-day-0-preflight-sync`. Then proceed to Day 1.
4. **Operator:** `STAGE_1_2_P0_REMEDIATION_RECEIPT_2026-05-12.md` (Day 5 final receipt) will cross-reference this Day 0 receipt under "Preflight reconciliation."

## Exit criteria

- [ ] pgTAP migration applies cleanly on a fresh `supabase db reset`.
- [ ] `000_smoke.sql` passes locally.
- [ ] `pgtap.yml` workflow runs and passes on this PR.
- [ ] All three live-state queries above have output captured.
- [ ] Bucket reconciliation question answered (Walker).
- [ ] Sync migration follow-up PR opened or formally documented as "not needed — repo matches live."

## Sign-off

| Role | Name | Date |
|------|------|------|
| Operator | Claude (Opus 4.7 1M-ctx) | 2026-05-12 |
| Reviewer / merge approver | walker@sitesyncai.com | _pending_ |
