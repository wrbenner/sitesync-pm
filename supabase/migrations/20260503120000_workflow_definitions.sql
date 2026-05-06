-- =============================================================================
-- Workflow definitions + runs
-- =============================================================================
-- Versioned workflow graphs. Items in flight pin to the version effective at
-- start; editing a workflow creates a new version row, the old version stays
-- alive for already-in-flight items.
-- =============================================================================

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  entity_type text NOT NULL,
  version int NOT NULL DEFAULT 1,
  name text NOT NULL,
  start_step text NOT NULL,
  definition jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT workflow_def_entity_type_check
    CHECK (entity_type IN ('rfi','submittal','change_order','punch_item','pay_app','inspection','daily_log'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_def_project_entity_active
  ON workflow_definitions (project_id, entity_type) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_def_project_entity_version
  ON workflow_definitions (project_id, entity_type, version);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id uuid NOT NULL REFERENCES workflow_definitions(id),
  entity_id uuid NOT NULL,
  current_step text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  history jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_def
  ON workflow_runs (workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_entity
  ON workflow_runs (entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_open
  ON workflow_runs (workflow_definition_id) WHERE completed_at IS NULL;

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_def_member_read ON workflow_definitions;
CREATE POLICY workflow_def_member_read ON workflow_definitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = workflow_definitions.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workflow_def_admin_write ON workflow_definitions;
CREATE POLICY workflow_def_admin_write ON workflow_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = workflow_definitions.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = workflow_definitions.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  );

DROP POLICY IF EXISTS workflow_runs_member_read ON workflow_runs;
CREATE POLICY workflow_runs_member_read ON workflow_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_definitions wd
      JOIN project_members pm ON pm.project_id = wd.project_id
      WHERE wd.id = workflow_runs.workflow_definition_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workflow_runs_admin_write ON workflow_runs;
CREATE POLICY workflow_runs_admin_write ON workflow_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflow_definitions wd
      JOIN project_members pm ON pm.project_id = wd.project_id
      WHERE wd.id = workflow_runs.workflow_definition_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_definitions wd
      JOIN project_members pm ON pm.project_id = wd.project_id
      WHERE wd.id = workflow_runs.workflow_definition_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin','owner','pm')
    )
  );
