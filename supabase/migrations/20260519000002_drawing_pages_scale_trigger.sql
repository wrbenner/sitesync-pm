-- Auto-propagate page-level scale text → parent drawing
--
-- When the PDF classifier writes a scale_text onto a drawing_pages row,
-- bubble it up to drawings.scale_text so the viewer reads the right value
-- on first open. We only propagate the TEXT field (unit-free); we never
-- touch drawings.scale_ratio because the two `scale_ratio` columns
-- encode different physical quantities (see migration 20260519000001).
--
-- Hard rules (mitigate the obvious risks):
--   1. NEVER overwrite an existing scale_text on drawings (preserve human
--      edits / first-AI-pass that's already landed).
--   2. NEVER overwrite scale_ratio at all (user calibration is sacred).
--   3. Trigger function uses SECURITY DEFINER + an exception block that
--      RAISES WARNING but never propagates (lesson from the 2026-05-18
--      submittal trigger incident where a missing SECURITY DEFINER
--      blocked unrelated writes).
--   4. Short-circuit via WHEN clause when scale_text didn't change, so
--      bulk classification updates don't trigger 1000s of no-op writes.

BEGIN;

CREATE OR REPLACE FUNCTION fn_propagate_drawing_scale()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  -- Defensive: never fail the parent write because of a propagation issue.
  BEGIN
    UPDATE drawings d
    SET
      scale_text   = NEW.scale_text,
      scale_source = COALESCE(d.scale_source, 'ai'),
      updated_at   = now()
    WHERE d.id = NEW.drawing_id
      AND NEW.scale_text IS NOT NULL
      AND d.scale_text IS NULL          -- preserve any existing scale
      AND d.scale_ratio IS NULL;        -- preserve user calibration
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_propagate_drawing_scale failed for drawing_id=% (sqlstate=%): %',
      NEW.drawing_id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_propagate_drawing_scale() IS
  'Bubbles drawing_pages.scale_text up to drawings.scale_text on insert/update. Never stomps an existing value. SECURITY DEFINER so background workers can write through RLS.';

-- Drop and recreate so re-runs pick up the latest function definition.
DROP TRIGGER IF EXISTS trg_drawing_pages_propagate_scale ON drawing_pages;

CREATE TRIGGER trg_drawing_pages_propagate_scale
  AFTER INSERT OR UPDATE OF scale_text ON drawing_pages
  FOR EACH ROW
  WHEN (NEW.scale_text IS NOT NULL)
  EXECUTE FUNCTION fn_propagate_drawing_scale();

COMMIT;
