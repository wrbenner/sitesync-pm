-- Drawing Revisions table
-- Tracks revision history for each drawing sheet.
-- Referenced by getDrawings() in documents.ts — MUST exist or the drawings page crashes.

CREATE TABLE IF NOT EXISTS drawing_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  revision_number integer NOT NULL DEFAULT 1,
  issued_date timestamptz,
  issued_by text,
  change_description text,
  file_url text,
  superseded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (drawing_id, revision_number)
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drawing_revisions' AND column_name = 'drawing_id') THEN

    CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing
  ON drawing_revisions(drawing_id);

  END IF;

END $$;
CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing_rev
  ON drawing_revisions(drawing_id, revision_number DESC);

ALTER TABLE drawing_revisions ENABLE ROW LEVEL SECURITY;

-- Users can see revisions for drawings in projects they are members of.
DROP POLICY IF EXISTS drawing_revisions_select ON drawing_revisions;
CREATE POLICY drawing_revisions_select
  ON drawing_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drawings d
      JOIN project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_revisions.drawing_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drawing_revisions_insert ON drawing_revisions;
CREATE POLICY drawing_revisions_insert
  ON drawing_revisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drawings d
      JOIN project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_revisions.drawing_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drawing_revisions_update ON drawing_revisions;
CREATE POLICY drawing_revisions_update
  ON drawing_revisions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM drawings d
      JOIN project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_revisions.drawing_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drawing_revisions_delete ON drawing_revisions;
CREATE POLICY drawing_revisions_delete
  ON drawing_revisions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM drawings d
      JOIN project_members pm ON pm.project_id = d.project_id
      WHERE d.id = drawing_revisions.drawing_id
        AND pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE drawing_revisions IS
  'Revision history for construction drawings. Each row is one revision of a sheet.';
