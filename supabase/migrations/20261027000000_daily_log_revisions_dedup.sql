-- =============================================================================
-- FMEA I.DL.1 / A.DL.1 — Fix #584: daily_log_revisions parallel-insert race
-- =============================================================================
-- Surfaced by Wave-1 race-prober (PR #581 →
-- tests/concurrency/daily-log-amend-race.spec.ts). Two concurrent INSERTs of
-- the same logical amendment (same daily_log_id, field, new_value tuple) both
-- land because there is no UNIQUE constraint and the revision_hash chain is
-- built after the row is written.
--
-- Strategy: partial UNIQUE INDEX on (daily_log_id, field, md5(new_value::text))
-- with a `WHERE new_value IS NOT NULL` predicate. We hash the JSONB body
-- because:
--   - new_value is `jsonb` and may exceed the btree row-size limit (~2.7 KB)
--     when callers store rich edits, so indexing it directly is unsafe.
--   - md5 is deterministic and fast; collision risk is negligible at this
--     table's scale (one log → tens of revisions, low millions of rows
--     total).
--
-- Behavior under the race:
--   - First INSERT lands.
--   - Second INSERT raises SQLSTATE 23505 (unique_violation).
--   - The caller can catch & treat as "already recorded" — the legitimate
--     dedup outcome the test asserts (row count ≤ 1).
--
-- Idempotent: `CREATE UNIQUE INDEX IF NOT EXISTS`. Safe to re-run.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_log_revisions_dedup
  ON public.daily_log_revisions (
    daily_log_id,
    field,
    md5(new_value::text)
  )
  WHERE new_value IS NOT NULL;

COMMENT ON INDEX public.uniq_daily_log_revisions_dedup IS
  'FMEA I.DL.1 / A.DL.1 dedup guard (#584). Prevents two concurrent INSERTs '
  'of the same (daily_log_id, field, new_value) tuple. The md5(new_value::text) '
  'expression keeps the btree key small because new_value can be large jsonb. '
  'Second concurrent INSERT raises SQLSTATE 23505 — caller treats as no-op.';
