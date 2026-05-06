-- =============================================================================
-- AI extraction results — confidence-gated AI-extracted payloads
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_extraction_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  source_storage_path text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('spec_pdf','inspection_report','quote_pdf')),
  extracted_payload jsonb NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  field_confidence jsonb,
  pdf_page int,
  bbox jsonb,
  status text NOT NULL CHECK (status IN ('auto_apply','auto_apply_with_warning','manual_review','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_decision text CHECK (reviewer_decision IN ('accept','reject','modify')),
  applied_resource_type text,
  applied_resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_extract_project_status
  ON ai_extraction_results (project_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_extract_pending_review
  ON ai_extraction_results (project_id) WHERE status = 'manual_review' AND reviewed_at IS NULL;

ALTER TABLE ai_extraction_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_extract_member_read ON ai_extraction_results;
CREATE POLICY ai_extract_member_read ON ai_extraction_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = ai_extraction_results.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_extract_admin_write ON ai_extraction_results;
CREATE POLICY ai_extract_admin_write ON ai_extraction_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = ai_extraction_results.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = ai_extraction_results.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  );
