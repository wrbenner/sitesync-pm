-- Phase 5: AI Training Corrections
-- Captures every user correction to an AI prediction (classification, edge
-- detection, discrepancy). Exported in batches to Roboflow by the
-- export-training-data edge function so the models improve with every project.

CREATE TABLE IF NOT EXISTS ai_training_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  correction_type text CHECK (correction_type IN (
    'classification','discrepancy','edge_detection','entity'
  )),
  original_value jsonb,
  corrected_value jsonb,
  source_record_id uuid,
  source_table text,
  drawing_id uuid REFERENCES drawings(id) ON DELETE SET NULL,
  page_image_url text,
  annotation_coordinates jsonb,
  is_exported boolean DEFAULT false,
  exported_at timestamptz,
  export_batch_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_training_corrections_project
  ON ai_training_corrections(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_corrections_type_exported
  ON ai_training_corrections(correction_type, is_exported);
CREATE INDEX IF NOT EXISTS idx_ai_training_corrections_drawing
  ON ai_training_corrections(drawing_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_corrections_source
  ON ai_training_corrections(source_table, source_record_id);

ALTER TABLE ai_training_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_training_corrections_select ON ai_training_corrections;
CREATE POLICY ai_training_corrections_select
  ON ai_training_corrections FOR SELECT
  USING (
    project_id IS NULL
    OR is_project_member(project_id)
  );

DROP POLICY IF EXISTS ai_training_corrections_insert ON ai_training_corrections;
CREATE POLICY ai_training_corrections_insert
  ON ai_training_corrections FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (project_id IS NULL OR is_project_member(project_id))
  );

DROP POLICY IF EXISTS ai_training_corrections_update ON ai_training_corrections;
CREATE POLICY ai_training_corrections_update
  ON ai_training_corrections FOR UPDATE
  USING (
    user_id = auth.uid()
    AND is_exported = false
  )
  WITH CHECK (
    user_id = auth.uid()
    AND is_exported = false
  );

COMMENT ON TABLE ai_training_corrections IS
  'User corrections of AI predictions. Aggregated by export-training-data Edge Function for Roboflow retraining.';
COMMENT ON COLUMN ai_training_corrections.correction_type IS
  'classification = discipline/plan_type fix. discrepancy = false positive / confirm. edge_detection = missing or wrong edge. entity = entity instance label fix.';
