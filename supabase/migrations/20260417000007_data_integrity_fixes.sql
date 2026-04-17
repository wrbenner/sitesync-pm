-- Data integrity fixes — audit sections 20, 23
-- DATA-05, DATA-04, DATA-07

-- ── DATA-05: Missing NOT NULL constraints ───────────────────
-- Backfill NULL values with safe defaults before applying NOT NULL.

UPDATE contracts SET contract_amount = 0 WHERE contract_amount IS NULL;
ALTER TABLE contracts ALTER COLUMN contract_amount SET NOT NULL;

-- pay_applications has no `application_date` column; the audit intent maps to
-- `period_to`, which is the application's period-end / application date.
UPDATE pay_applications SET period_to = CURRENT_DATE WHERE period_to IS NULL;
ALTER TABLE pay_applications ALTER COLUMN period_to SET NOT NULL;

UPDATE estimates SET total_amount = 0 WHERE total_amount IS NULL;
ALTER TABLE estimates ALTER COLUMN total_amount SET NOT NULL;

-- ── DATA-04: Duplicate trigger functions ────────────────────
-- Standardize on `set_updated_at`. If an older `update_updated_at_column`
-- exists alongside it, drop the older one only when the new one is present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- Only drop if no triggers still reference the old function.
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
ALTER TABLE progress_detection_results
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

UPDATE progress_detection_results r
SET project_id = p.project_id
FROM photo_pins p
WHERE r.photo_pin_id = p.id
  AND r.project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_progress_detect_project
  ON progress_detection_results(project_id);
