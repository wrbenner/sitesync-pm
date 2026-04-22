-- Safety Photo AI Analysis — store AI-generated OSHA safety scan results for photos.

CREATE TABLE IF NOT EXISTS safety_photo_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  safety_score integer CHECK (safety_score BETWEEN 0 AND 100),
  violations jsonb DEFAULT '[]'::jsonb,
  summary text,
  scene_description text,
  analyzed_at timestamptz DEFAULT now(),
  analyzed_by text DEFAULT 'gemini-vision',
  created_by uuid REFERENCES auth.users(id)
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'safety_photo_analyses' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_safety_photo_project ON safety_photo_analyses(project_id);

  END IF;

END $$;
CREATE INDEX IF NOT EXISTS idx_safety_photo_analyzed_at ON safety_photo_analyses(analyzed_at DESC);

ALTER TABLE safety_photo_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_photo_select ON safety_photo_analyses;
CREATE POLICY safety_photo_select ON safety_photo_analyses FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS safety_photo_insert ON safety_photo_analyses;
CREATE POLICY safety_photo_insert ON safety_photo_analyses FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS safety_photo_delete ON safety_photo_analyses;
CREATE POLICY safety_photo_delete ON safety_photo_analyses FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
