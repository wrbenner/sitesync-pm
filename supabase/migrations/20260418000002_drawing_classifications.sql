-- Phase 2: Drawing Classifications (AI-powered)
-- Stores the structured output of the Gemini classifier for each drawing page
-- so downstream pairing, discrepancy, and overlay workflows can use the data
-- without re-running expensive vision calls.

CREATE TABLE IF NOT EXISTS drawing_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid REFERENCES drawings(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  sheet_number text,
  drawing_title text,
  building_name text,
  floor_level text,
  discipline text CHECK (discipline IN (
    'architectural','structural','mechanical','electrical',
    'plumbing','mep','civil','interior_design','unclassified'
  )),
  plan_type text,
  scale_text text,
  scale_ratio numeric,
  design_description jsonb,
  viewport_details jsonb,
  pairing_tokens jsonb,
  classification_confidence numeric,
  processing_status text DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processing','completed','failed')),
  processed_at timestamptz,
  ai_cost_cents integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_classifications_drawing
  ON drawing_classifications(drawing_id);
CREATE INDEX IF NOT EXISTS idx_drawing_classifications_project
  ON drawing_classifications(project_id);
CREATE INDEX IF NOT EXISTS idx_drawing_classifications_discipline
  ON drawing_classifications(project_id, discipline);
CREATE INDEX IF NOT EXISTS idx_drawing_classifications_status
  ON drawing_classifications(processing_status);

ALTER TABLE drawing_classifications ENABLE ROW LEVEL SECURITY;

-- Users can only see classifications for projects they are members of.
DROP POLICY IF EXISTS drawing_classifications_select ON drawing_classifications;
CREATE POLICY drawing_classifications_select
  ON drawing_classifications FOR SELECT
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_classifications_insert ON drawing_classifications;
CREATE POLICY drawing_classifications_insert
  ON drawing_classifications FOR INSERT
  WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_classifications_update ON drawing_classifications;
CREATE POLICY drawing_classifications_update
  ON drawing_classifications FOR UPDATE
  USING (is_project_member(project_id))
  WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_classifications_delete ON drawing_classifications;
CREATE POLICY drawing_classifications_delete
  ON drawing_classifications FOR DELETE
  USING (is_project_member(project_id));

COMMENT ON TABLE drawing_classifications IS
  'AI-generated classification of each drawing/page. Powered by Gemini plan-classification-v2.';
COMMENT ON COLUMN drawing_classifications.scale_ratio IS
  'Numeric scale ratio (e.g. 1/8" = 1''-0" -> 96.0). Null when unreadable.';
COMMENT ON COLUMN drawing_classifications.pairing_tokens IS
  '{ areaToken, sectionToken } used by drawing-pair extraction.';
COMMENT ON COLUMN drawing_classifications.ai_cost_cents IS
  'Cost of the Gemini call in integer cents.';
