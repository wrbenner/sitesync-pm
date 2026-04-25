-- ═══════════════════════════════════════════════════════════════
-- Migration: Fix Drawing Constraint Violations
-- Version: 20260422200000 (unique, after all existing 20260422 migrations)
-- Purpose: Unblock drawing uploads by fixing CHECK constraint
--          mismatches between frontend code and database schema.
--
-- Problems fixed:
--   1. processing_status='needs_review' rejected by CHECK
--   2. discipline='cover' (and 5 others) rejected by CHECK
--   3. Three tables have inconsistent discipline CHECKs
-- ═══════════════════════════════════════════════════════════════

-- The full discipline list used by the frontend (constants.ts):
--   architectural, structural, mechanical, electrical, plumbing,
--   civil, fire_protection, landscape, interior, interior_design,
--   mep, unclassified, cover, demolition, survey, geotechnical,
--   hazmat, telecommunications

-- ─── 1. Fix processing_status on drawings ────────────────────
-- The upload code writes 'needs_review' (index.tsx line 886)
-- but the CHECK only allowed 5 values.

-- Drop any named constraint first
DO $$ BEGIN
  ALTER TABLE drawings DROP CONSTRAINT IF EXISTS drawings_processing_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop unnamed/auto-named constraint by finding it dynamically
DO $$
DECLARE
  _cname text;
BEGIN
  SELECT conname INTO _cname
    FROM pg_constraint
   WHERE conrelid = 'drawings'::regclass
     AND pg_get_constraintdef(oid) ILIKE '%processing_status%'
   LIMIT 1;

  IF _cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE drawings DROP CONSTRAINT %I', _cname);
  END IF;
END $$;

ALTER TABLE drawings ADD CONSTRAINT drawings_processing_status_check
  CHECK (processing_status IN (
    'pending','splitting','classifying','completed','failed','needs_review'
  ));


-- ─── 2. Fix discipline on drawings ──────────────────────────
-- Original schema had 9 values. Migration 20260420000005 widened
-- to 12 (named drawings_discipline_check). Frontend uses 18.

DO $$ BEGIN
  ALTER TABLE drawings DROP CONSTRAINT IF EXISTS drawings_discipline_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Also drop any unnamed/auto-named constraint
DO $$
DECLARE
  _cname text;
BEGIN
  FOR _cname IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'drawings'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%discipline%'
  LOOP
    EXECUTE format('ALTER TABLE drawings DROP CONSTRAINT %I', _cname);
  END LOOP;
END $$;

ALTER TABLE drawings ADD CONSTRAINT drawings_discipline_check
  CHECK (discipline IS NULL OR discipline IN (
    'architectural','structural','mechanical','electrical','plumbing',
    'civil','fire_protection','landscape','interior','interior_design',
    'mep','unclassified','cover','demolition','survey','geotechnical',
    'hazmat','telecommunications'
  ));


-- ─── 3. Fix discipline on drawing_classifications ────────────
-- Had a narrower 9-value set missing fire_protection, landscape.

DO $$
DECLARE
  _cname text;
BEGIN
  FOR _cname IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'drawing_classifications'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%discipline%'
  LOOP
    EXECUTE format('ALTER TABLE drawing_classifications DROP CONSTRAINT %I', _cname);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE drawing_classifications ADD CONSTRAINT drawing_classifications_discipline_check
    CHECK (discipline IS NULL OR discipline IN (
      'architectural','structural','mechanical','electrical','plumbing',
      'civil','fire_protection','landscape','interior','interior_design',
      'mep','unclassified','cover','demolition','survey','geotechnical',
      'hazmat','telecommunications'
    ));
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;


-- ─── 4. Fix discipline on drawing_pages ──────────────────────
-- Had 12 values (the widest) but still missing cover, demo, etc.
-- The table may not exist yet — handle gracefully.

DO $$
DECLARE
  _cname text;
BEGIN
  FOR _cname IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'drawing_pages'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%discipline%'
  LOOP
    EXECUTE format('ALTER TABLE drawing_pages DROP CONSTRAINT %I', _cname);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE drawing_pages ADD CONSTRAINT drawing_pages_discipline_check
    CHECK (discipline IS NULL OR discipline IN (
      'architectural','structural','mechanical','electrical','plumbing',
      'civil','fire_protection','landscape','interior','interior_design',
      'mep','unclassified','cover','demolition','survey','geotechnical',
      'hazmat','telecommunications'
    ));
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;


-- ─── 5. Add indexes (IF NOT EXISTS = safe to re-run) ─────────
CREATE INDEX IF NOT EXISTS idx_drawings_project_discipline_status
  ON drawings (project_id, discipline, processing_status);

CREATE INDEX IF NOT EXISTS idx_drawings_project_sheet
  ON drawings (project_id, sheet_number);
