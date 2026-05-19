-- Drawings: real scale columns + audit trail
--
-- Before this migration the drawing viewer reads `drawing.scale_text` and
-- `drawing.scale_ratio` via unsafe casts, even though neither column existed
-- on `drawings`. Result: measurement tool always falls back to pixels, and
-- user-set calibrations silently fail to persist across reloads.
--
-- This migration adds the columns + an audit trail (who calibrated, when,
-- which source). All operations are idempotent (IF NOT EXISTS / NULL-guarded
-- backfill) so it is safe to re-run.
--
-- UNIT NOTE — critical:
--   `drawings.scale_ratio`        is "real inches per IMAGE pixel"
--                                 (set when a user calibrates manually).
--   `drawing_pages.scale_ratio`   is "real inches per PAPER inch"
--                                 (extracted by pdfClassifier.ts;
--                                 dimensionless, ~48 for 1/4"=1'-0").
-- These are DIFFERENT QUANTITIES. We never copy the numeric column
-- between them. The TEXT representation (`scale_text`) is unit-free,
-- so it is safe to propagate.

BEGIN;

-- ── Columns ──────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS scale_text text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS scale_ratio numeric;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Audit trail: who/when/where did this scale come from?
-- source: 'ai' (extracted from PDF text), 'user' (manual calibrate), NULL (unset)
DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS scale_source text
    CHECK (scale_source IS NULL OR scale_source IN ('ai','user'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS scale_calibrated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS scale_calibrated_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

COMMENT ON COLUMN drawings.scale_text IS
  'Human-readable scale (e.g. "1/4""=1''-0""", "1:100", "NTS"). Source-of-truth for the measurement tool when scale_ratio is null. Unit-free.';
COMMENT ON COLUMN drawings.scale_ratio IS
  'User-calibrated scale in REAL INCHES PER IMAGE PIXEL. Set only when a user manually calibrates a sheet. NOT the same units as drawing_pages.scale_ratio.';
COMMENT ON COLUMN drawings.scale_source IS
  '"ai" if extracted from PDF text, "user" if a person calibrated, NULL if unknown.';

-- ── Backfill (TEXT only, never the numeric column) ──────────
-- Prefer the first drawing_pages row with a non-null scale_text;
-- fall back to drawing_classifications (legacy classification table)
-- if pages haven't been generated yet.
WITH page_scales AS (
  SELECT DISTINCT ON (drawing_id)
    drawing_id,
    scale_text
  FROM drawing_pages
  WHERE scale_text IS NOT NULL
  ORDER BY drawing_id, page_number ASC
),
classification_scales AS (
  SELECT DISTINCT ON (drawing_id)
    drawing_id,
    scale_text
  FROM drawing_classifications
  WHERE scale_text IS NOT NULL
  ORDER BY drawing_id, classification_confidence DESC NULLS LAST
)
UPDATE drawings d
SET
  scale_text   = COALESCE(p.scale_text, c.scale_text),
  scale_source = 'ai'
FROM page_scales p
FULL OUTER JOIN classification_scales c USING (drawing_id)
WHERE d.id = COALESCE(p.drawing_id, c.drawing_id)
  AND d.scale_text IS NULL                  -- never overwrite existing value
  AND d.scale_ratio IS NULL                 -- never overwrite a user calibration
  AND COALESCE(p.scale_text, c.scale_text) IS NOT NULL;

-- ── Index for filtering uncalibrated sheets in dashboards ───
CREATE INDEX IF NOT EXISTS idx_drawings_scale_calibrated
  ON drawings(project_id)
  WHERE scale_ratio IS NULL AND scale_text IS NULL;

COMMIT;
