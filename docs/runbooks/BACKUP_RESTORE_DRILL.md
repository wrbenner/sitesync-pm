# Backup / Restore Drill — Procedure

**Cadence:** Monthly. Owner: Founder.
**Spec source:** BRT_SUBSYSTEM_8_PRODUCTION_HARDENING.md §4.3.
**Last drill:** _(record below after each run)_

The point of this drill is not to prove that Supabase's backups exist — they do. The point is to prove that *we know how to use them*, that we've measured restore time, and that the restored state is verifiably correct. Drills surface tooling gaps before an incident does.

---

## Pre-conditions

- Supabase Pro plan active (PITR available)
- Supabase project ID and access token in `.env.local` (or 1Password vault entry "Supabase Prod")
- `supabase` CLI installed and authenticated (`supabase login`)
- Sentinel data: a row in `audit_log` with `entity_type='drill_sentinel'` written at the start of the drill window so we can verify the restored snapshot has it

## Procedure (≈ 90 minutes wall clock)

### Phase 1 — Pre-drill setup (5 min)

1. Note the current UTC time. Pick a target restore point 2 hours in the past.
2. Insert a sentinel row to make the drill verifiable:
   ```sql
   INSERT INTO audit_log (organization_id, user_id, entity_type, entity_id, action, metadata)
   VALUES ('<your-org-id>', auth.uid(), 'drill_sentinel', gen_random_uuid(), 'create',
           jsonb_build_object('drill_run_id', '<random-uuid>', 'phase', 'pre_restore'));
   ```
3. Capture baseline: row counts for the 5 highest-volume tables.
   ```sql
   SELECT 'projects' AS t, count(*) FROM projects
   UNION ALL SELECT 'rfis', count(*) FROM rfis
   UNION ALL SELECT 'submittals', count(*) FROM submittals
   UNION ALL SELECT 'audit_log', count(*) FROM audit_log
   UNION ALL SELECT 'documents', count(*) FROM documents;
   ```
   Save output to `docs/audits/BRT_SUB_8_BACKUP_DRILL_<DATE>.md`.

### Phase 2 — Restore to a clone project (60–80 min)

4. From the Supabase Dashboard → Project Settings → Database → Backups, click **Restore from PITR**. Pick the target restore point from step 1.
5. **Restore to a NEW project**, not over production. The new project name should be `sitesync-drill-<DATE>`.
6. Note the **restore start time**. The clone project will spin up Postgres + Auth + Storage in a fresh region.
7. Wait for the dashboard to show the clone as "Active". Note the **restore complete time**. This is the **restore RTO** — record it in the drill log.
8. Connect to the clone with `psql`:
   ```bash
   psql 'postgresql://postgres:<pass>@<clone-host>:5432/postgres' -c '\dt'
   ```

### Phase 3 — Verify (15 min)

9. Confirm the sentinel row from step 2 is present in the clone:
   ```sql
   SELECT count(*) FROM audit_log
   WHERE entity_type = 'drill_sentinel'
     AND metadata->>'drill_run_id' = '<random-uuid>';
   -- expected: 1
   ```
10. Compare row counts vs the baseline from step 3. Differences are expected (target was 2h before sentinel insert) but should be plausibly close on append-only tables.
11. Run the schema audit:
    ```bash
    SUPABASE_PROJECT_ID=<clone-id> npm run db-types:check
    # expected: clean diff vs HEAD
    ```
12. Spot-check one customer-facing read path: open the clone in the Supabase SQL editor, run a `SELECT` against a real org's projects table. Confirm RLS policies survived the restore.

### Phase 4 — Tear down (5 min)

13. From the Dashboard → Project Settings → General → Delete project. Confirm.
14. Insert post-drill sentinel into PROD audit_log:
    ```sql
    INSERT INTO audit_log (organization_id, user_id, entity_type, entity_id, action, metadata)
    VALUES ('<your-org-id>', auth.uid(), 'drill_sentinel', gen_random_uuid(), 'create',
            jsonb_build_object('drill_run_id', '<random-uuid>', 'phase', 'post_restore',
                              'rto_minutes', <number>, 'verified', true));
    ```

## Pass criteria

- Restore completes in **< 2 hours** for a 30-day-old PITR target on the live database size
- Sentinel row is present in the clone (proves the target restore point worked)
- Schema diff is clean (proves the restore is consistent with current code)
- Spot-check read path returns the expected rows under RLS

## Storage backup verification

Storage buckets are not covered by Postgres PITR. They're replicated nightly to S3 cold by `scripts/storage-backup.ts` (BRT sub-8 §4.3 followup slice).

Verify monthly:
```bash
aws s3 ls s3://sitesync-storage-backup/$(date -u +%Y/%m/%d --date='yesterday')/ \
  | wc -l
# expected: > 0 objects (yesterday's snapshot exists)
```

If the count is zero for two consecutive days, page Founder.

## Drill log

| Date | Drill run id | RTO (min) | Sentinel verified | Notes |
|---|---|---:|:---:|---|
| _example_ | 2026-05-12-abc | _86_ | ✓ | first formal drill; tooling gaps logged separately |

## Tooling gaps to address before next drill

(Populate after first drill. Anything that took manual fiddling goes here so the second drill is faster.)
