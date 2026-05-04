-- ═══════════════════════════════════════════════════════════════
-- Migration: Widen drawings.status CHECK constraint
-- Version: 20260428100001 (was 20260428100000 — collided with
-- cross_feature_metadata; bumped to keep migration tracker keys unique)
-- Purpose: The original status CHECK (from 00019_document_enhancements)
--          only allowed: current, superseded, void, for_review.
--          The frontend state machine (drawingMachine.ts) and the
--          drawingService.createDrawing() use: draft, for_review,
--          under_review, approved, rejected, published, archived.
--          This mismatch causes a 400 Bad Request on every drawing
--          insert.
--
-- Fix: Drop the old constraint and add one that covers the union
--      of both value sets.
-- ═══════════════════════════════════════════════════════════════

-- Drop any named constraint
DO $$ BEGIN
  ALTER TABLE drawings DROP CONSTRAINT IF EXISTS drawings_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop unnamed/auto-named constraint by finding it dynamically
DO $$
DECLARE
  _cname text;
BEGIN
  FOR _cname IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'drawings'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
       AND pg_get_constraintdef(oid) NOT ILIKE '%processing_status%'
  LOOP
    EXECUTE format('ALTER TABLE drawings DROP CONSTRAINT %I', _cname);
  END LOOP;
END $$;

ALTER TABLE drawings ADD CONSTRAINT drawings_status_check
  CHECK (status IS NULL OR status IN (
    'current','superseded','void','for_review',
    'draft','under_review','approved','rejected','published','archived'
  ));
