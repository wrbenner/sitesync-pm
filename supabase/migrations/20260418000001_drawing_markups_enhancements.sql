-- Phase 1: Drawing markup annotation engine enhancements.
-- Adds structured columns required by the new AnnotationCanvas to the
-- existing drawing_markups table. All columns are additive so existing
-- data is preserved.

ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS annotation_type text;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS coordinates jsonb;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS color text DEFAULT '#F47820';
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS page_number integer;

-- linked_punch_item_id may already exist; add with guard so migration is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drawing_markups' AND column_name = 'linked_punch_item_id'
  ) THEN
    ALTER TABLE drawing_markups
      ADD COLUMN linked_punch_item_id uuid REFERENCES punch_items(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_drawing_markups_page
  ON drawing_markups(drawing_id, page_number);

CREATE INDEX IF NOT EXISTS idx_drawing_markups_annotation_type
  ON drawing_markups(annotation_type);

COMMENT ON COLUMN drawing_markups.annotation_type IS
  'Type of shape: rectangle | text | polygon | pin | measure | highlight | draw';
COMMENT ON COLUMN drawing_markups.coordinates IS
  'Shape geometry — { x, y, width?, height?, endX?, endY?, points? }';
COMMENT ON COLUMN drawing_markups.color IS
  'Stroke/fill color for the annotation, theme token hex.';
COMMENT ON COLUMN drawing_markups.page_number IS
  'PDF page number the annotation belongs to (1-indexed).';
