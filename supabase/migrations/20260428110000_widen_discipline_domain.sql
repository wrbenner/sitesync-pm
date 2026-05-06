-- ═══════════════════════════════════════════════════════════════
-- Migration: Widen construction_discipline domain
-- Version: 20260428110000
-- Purpose: The inferDisciplineFromFilename() function can return
--          'food_service', 'laundry', 'vertical_transportation'
--          but the construction_discipline domain (from 20260423000001)
--          only had 18 values. This adds the missing 3 values.
--
--          PostgreSQL doesn't support ALTER DOMAIN ... ADD VALUE for
--          CHECK constraints, so we must drop + recreate.
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Remove the domain from all columns that use it
-- (ALTER COLUMN TYPE text removes the domain reference)

DO $$ BEGIN
  ALTER TABLE drawings
    ALTER COLUMN discipline TYPE text
    USING discipline::text;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawing_classifications
    ALTER COLUMN discipline TYPE text
    USING discipline::text;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawing_pages
    ALTER COLUMN discipline TYPE text
    USING discipline::text;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN undefined_column THEN NULL; END $$;

-- Step 2: Drop and recreate the domain with the wider set
DROP DOMAIN IF EXISTS construction_discipline;

CREATE DOMAIN construction_discipline AS text
  CHECK (
    VALUE IS NULL OR VALUE IN (
      'architectural','structural','mechanical','electrical','plumbing',
      'civil','fire_protection','landscape','interior','interior_design',
      'mep','unclassified','cover','demolition','survey','geotechnical',
      'hazmat','telecommunications','food_service','laundry','vertical_transportation'
    )
  );

COMMENT ON DOMAIN construction_discipline IS
  'Canonical set of discipline values. Frontend constants (src/pages/drawings/constants.ts) and pdfClassifier.ts Discipline type must stay in sync.';

-- Step 3: Re-apply the domain to all columns

DO $$ BEGIN
  ALTER TABLE drawings
    ALTER COLUMN discipline TYPE construction_discipline
    USING discipline::construction_discipline;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawing_classifications
    ALTER COLUMN discipline TYPE construction_discipline
    USING discipline::construction_discipline;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawing_pages
    ALTER COLUMN discipline TYPE construction_discipline
    USING discipline::construction_discipline;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN undefined_column THEN NULL; END $$;
