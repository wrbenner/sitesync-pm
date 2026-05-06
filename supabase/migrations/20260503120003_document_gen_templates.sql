-- =============================================================================
-- Document generation runs — provenance for monthly reports, owner digests,
-- meeting minutes, and closeout packages.
-- =============================================================================
-- snapshot_at + content_hash form the tampering-detection signal: if anyone
-- regenerates with a fresher snapshot, the hash differs and downstream
-- consumers can warn.
-- =============================================================================

CREATE TABLE IF NOT EXISTS document_gen_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'monthly_report',
    'owner_weekly_digest',
    'meeting_minutes',
    'closeout_package'
  )),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  snapshot_at timestamptz NOT NULL,
  output_storage_path text,
  content_hash text,
  distribution_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_to_count int NOT NULL DEFAULT 0,
  triggered_by uuid,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_doc_gen_runs_project_kind_started
  ON document_gen_runs (project_id, kind, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_gen_runs_hash
  ON document_gen_runs (content_hash) WHERE content_hash IS NOT NULL;

ALTER TABLE document_gen_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_gen_member_read ON document_gen_runs;
CREATE POLICY doc_gen_member_read ON document_gen_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = document_gen_runs.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doc_gen_admin_write ON document_gen_runs;
CREATE POLICY doc_gen_admin_write ON document_gen_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = document_gen_runs.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = document_gen_runs.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  );
