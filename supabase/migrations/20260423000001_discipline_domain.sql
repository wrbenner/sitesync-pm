-- ═══════════════════════════════════════════════════════════════
-- Migration: Single source of truth for discipline values
-- Version: 20260423000001
-- Purpose: Replace three parallel CHECK constraints (drawings,
--          drawing_classifications, drawing_pages) with one DOMAIN.
--          Future discipline additions only need one line to change.
--
-- Depends on 20260422200000_fix_drawing_constraints.sql having
-- already widened all three CHECKs to the same 18-value list;
-- if existing data predates that, the ALTER TYPE below fails.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Create the DOMAIN ─────────────────────────────────────
-- Clients still see this as text (DOMAINs are transparent across
-- the wire), so generated types in src/types/database.ts stay as
-- `string | null` and no frontend change is needed.
DO $$ BEGIN
  CREATE DOMAIN construction_discipline AS text
    CHECK (
      VALUE IS NULL OR VALUE IN (
        'architectural','structural','mechanical','electrical','plumbing',
        'civil','fire_protection','landscape','interior','interior_design',
        'mep','unclassified','cover','demolition','survey','geotechnical',
        'hazmat','telecommunications'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON DOMAIN construction_discipline IS
  'Canonical set of discipline values. Frontend constants (src/pages/drawings/constants.ts) must stay in sync — add new values here AND in the frontend in the same PR.';


-- ── 2. drawings.discipline → DOMAIN ──────────────────────────
-- Drop the CHECK (named + any auto-named), then alter the column
-- type. The DOMAIN re-enforces the same check.
DO $$ BEGIN
  ALTER TABLE drawings DROP CONSTRAINT IF EXISTS drawings_discipline_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$
DECLARE _cname text;
BEGIN
  FOR _cname IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'drawings'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%discipline%'
  LOOP
    EXECUTE format('ALTER TABLE drawings DROP CONSTRAINT %I', _cname);
  END LOOP;
END $$;

ALTER TABLE drawings
  ALTER COLUMN discipline TYPE construction_discipline
  USING discipline::construction_discipline;


-- ── 3. drawing_classifications.discipline → DOMAIN ───────────
DO $$
DECLARE _cname text;
BEGIN
  FOR _cname IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'drawing_classifications'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%discipline%'
  LOOP
    EXECUTE format('ALTER TABLE drawing_classifications DROP CONSTRAINT %I', _cname);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawing_classifications
    ALTER COLUMN discipline TYPE construction_discipline
    USING discipline::construction_discipline;
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ── 4. drawing_pages.discipline → DOMAIN ─────────────────────
DO $$
DECLARE _cname text;
BEGIN
  FOR _cname IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'drawing_pages'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%discipline%'
  LOOP
    EXECUTE format('ALTER TABLE drawing_pages DROP CONSTRAINT %I', _cname);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawing_pages
    ALTER COLUMN discipline TYPE construction_discipline
    USING discipline::construction_discipline;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
