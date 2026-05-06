-- ═══════════════════════════════════════════════════════════════
-- Migration: Extend construction_discipline DOMAIN
-- Version: 20260428000000
-- Purpose: Add food_service, laundry, vertical_transportation so the
--          auto-classifier can route Procore-style sets that include
--          these special-trade disciplines (e.g. "11 Food Service.pdf",
--          "12 Laundry.pdf", "13 Vertical Transportation.pdf").
--
-- Depends on 20260423000001_discipline_domain.sql having created the
-- DOMAIN. Frontend constants live in src/pages/drawings/constants.ts
-- and were updated in the same commit.
-- ═══════════════════════════════════════════════════════════════

-- Drop any constraint currently attached to the DOMAIN (named or auto)
DO $$
DECLARE _cname text;
BEGIN
  FOR _cname IN
    SELECT conname FROM pg_constraint
     WHERE contypid = 'construction_discipline'::regtype
       AND contype = 'c'
  LOOP
    EXECUTE format('ALTER DOMAIN construction_discipline DROP CONSTRAINT %I', _cname);
  END LOOP;
END $$;

ALTER DOMAIN construction_discipline
  ADD CONSTRAINT construction_discipline_check
  CHECK (
    VALUE IS NULL OR VALUE IN (
      'architectural','structural','mechanical','electrical','plumbing',
      'civil','fire_protection','landscape','interior','interior_design',
      'mep','unclassified','cover','demolition','survey','geotechnical',
      'hazmat','telecommunications',
      'food_service','laundry','vertical_transportation'
    )
  );

COMMENT ON DOMAIN construction_discipline IS
  'Canonical set of discipline values. Frontend constants (src/pages/drawings/constants.ts) and the auto-classifier patterns (src/lib/pdfClassifier.ts) must stay in sync — add new values in all three places in the same PR.';
