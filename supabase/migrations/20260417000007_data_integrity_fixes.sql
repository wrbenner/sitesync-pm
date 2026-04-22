-- Data integrity fixes — audit sections 20, 23
-- DATA-05, DATA-04, DATA-07
--
-- Each block guards on column/table existence so this migration can apply
-- cleanly against DBs where the referenced table hasn't been created yet
-- (e.g. contracts.contract_amount lives in 20260418000008_contracts_module,
-- which runs after this file). When the guarded condition is false, we skip
-- silently — the later migration will create the column in the right shape.

-- ── DATA-05: Missing NOT NULL constraints ───────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'contract_amount'
  ) THEN
    UPDATE contracts SET contract_amount = 0 WHERE contract_amount IS NULL;
    ALTER TABLE contracts ALTER COLUMN contract_amount SET NOT NULL;
  END IF;
END $$;

-- pay_applications has no `application_date` column; the audit intent maps to
-- `period_to`, which is the application's period-end / application date.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pay_applications' AND column_name = 'period_to'
  ) THEN
    UPDATE pay_applications SET period_to = CURRENT_DATE WHERE period_to IS NULL;
    ALTER TABLE pay_applications ALTER COLUMN period_to SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'total_amount'
  ) THEN
    UPDATE estimates SET total_amount = 0 WHERE total_amount IS NULL;
    ALTER TABLE estimates ALTER COLUMN total_amount SET NOT NULL;
  END IF;
END $$;

-- ── DATA-04: Duplicate trigger functions ────────────────────
-- Standardize on `set_updated_at`. If an older `update_updated_at_column`
-- exists alongside it, drop the older one only when no triggers still
-- reference it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE p.proname = 'update_updated_at_column'
    ) THEN
      DROP FUNCTION update_updated_at_column() CASCADE;
    END IF;
  END IF;
END $$;

-- ── DATA-07: Missing project_id for RLS ─────────────────────
-- progress_detection_results currently reaches project_id via photo_pins.
-- Add a direct project_id column and backfill from the parent photo pin.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'progress_detection_results') THEN
    ALTER TABLE progress_detection_results
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photo_pins') THEN
      UPDATE progress_detection_results r
      SET project_id = p.project_id
      FROM photo_pins p
      WHERE r.photo_pin_id = p.id
        AND r.project_id IS NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_progress_detect_project
      ON progress_detection_results(project_id);
  END IF;
END $$;
