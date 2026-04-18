-- Phase 3: Drawing Intelligence Engine
-- Tables for AI-detected architectural/structural drawing pairs and
-- dimensional discrepancies, which feed the clash-detection + auto-RFI
-- pipeline. Works on top of drawing_classifications (Phase 2 migration).

CREATE TABLE IF NOT EXISTS drawing_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  arch_drawing_id uuid REFERENCES drawings(id) ON DELETE CASCADE,
  struct_drawing_id uuid REFERENCES drawings(id) ON DELETE CASCADE,
  arch_page_number integer,
  struct_page_number integer,
  arch_classification_id uuid REFERENCES drawing_classifications(id) ON DELETE SET NULL,
  struct_classification_id uuid REFERENCES drawing_classifications(id) ON DELETE SET NULL,
  pairing_confidence numeric,
  pairing_method text DEFAULT 'ai',
  pairing_reason text,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','detecting_edges','edges_detected','analyzing','completed','failed')),
  overlap_image_url text,
  detected_edges jsonb,
  discrepancies jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_pairs_project
  ON drawing_pairs(project_id);
CREATE INDEX IF NOT EXISTS idx_drawing_pairs_status
  ON drawing_pairs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_drawing_pairs_arch
  ON drawing_pairs(arch_drawing_id);
CREATE INDEX IF NOT EXISTS idx_drawing_pairs_struct
  ON drawing_pairs(struct_drawing_id);

CREATE TABLE IF NOT EXISTS drawing_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid REFERENCES drawing_pairs(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  arch_dimension text,
  struct_dimension text,
  location_on_drawing jsonb,
  severity text CHECK (severity IN ('high','medium','low')),
  confidence numeric,
  auto_rfi_id uuid REFERENCES rfis(id) ON DELETE SET NULL,
  user_confirmed boolean DEFAULT false,
  is_false_positive boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_discrepancies_pair
  ON drawing_discrepancies(pair_id);
CREATE INDEX IF NOT EXISTS idx_drawing_discrepancies_project
  ON drawing_discrepancies(project_id);
CREATE INDEX IF NOT EXISTS idx_drawing_discrepancies_severity
  ON drawing_discrepancies(project_id, severity);
CREATE INDEX IF NOT EXISTS idx_drawing_discrepancies_rfi
  ON drawing_discrepancies(auto_rfi_id);

-- Mark RFIs that were created by the drawing intelligence pipeline so the
-- RFIs page can render an "Auto-Generated" badge.
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS is_auto_generated boolean DEFAULT false;
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS source_discrepancy_id uuid
    REFERENCES drawing_discrepancies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rfis_auto_generated
  ON rfis(project_id, is_auto_generated);

ALTER TABLE drawing_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_discrepancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drawing_pairs_select ON drawing_pairs;
CREATE POLICY drawing_pairs_select
  ON drawing_pairs FOR SELECT
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_pairs_insert ON drawing_pairs;
CREATE POLICY drawing_pairs_insert
  ON drawing_pairs FOR INSERT
  WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_pairs_update ON drawing_pairs;
CREATE POLICY drawing_pairs_update
  ON drawing_pairs FOR UPDATE
  USING (is_project_member(project_id))
  WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_pairs_delete ON drawing_pairs;
CREATE POLICY drawing_pairs_delete
  ON drawing_pairs FOR DELETE
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_discrepancies_select ON drawing_discrepancies;
CREATE POLICY drawing_discrepancies_select
  ON drawing_discrepancies FOR SELECT
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_discrepancies_insert ON drawing_discrepancies;
CREATE POLICY drawing_discrepancies_insert
  ON drawing_discrepancies FOR INSERT
  WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_discrepancies_update ON drawing_discrepancies;
CREATE POLICY drawing_discrepancies_update
  ON drawing_discrepancies FOR UPDATE
  USING (is_project_member(project_id))
  WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS drawing_discrepancies_delete ON drawing_discrepancies;
CREATE POLICY drawing_discrepancies_delete
  ON drawing_discrepancies FOR DELETE
  USING (is_project_member(project_id));

COMMENT ON TABLE drawing_pairs IS
  'AI-paired architectural <-> structural drawings for clash detection. Populated by extract-drawing-pairs edge function.';
COMMENT ON TABLE drawing_discrepancies IS
  'Dimensional discrepancies detected by analyze-discrepancies edge function. Auto-creates draft RFIs for high-severity items.';
COMMENT ON COLUMN drawing_pairs.detected_edges IS
  'Roboflow edge detection output: { arch: [{x,y,w,h,confidence}...], struct: [...] }';
COMMENT ON COLUMN drawing_pairs.overlap_image_url IS
  'URL of generated overlay image stored in Supabase Storage.';
COMMENT ON COLUMN rfis.is_auto_generated IS
  'TRUE when the RFI was auto-drafted by the drawing intelligence pipeline.';
