-- IFC Model storage for BIM viewer cache.
-- Stores parsed IFC model data keyed by file hash to avoid re-parsing.

CREATE TABLE IF NOT EXISTS ifc_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_size   BIGINT,
  metadata    JSONB DEFAULT '{}',
  hash        VARCHAR(64) NOT NULL,
  storage_key TEXT,  -- Supabase Storage path for the raw IFC file
  created_by  UUID REFERENCES auth.users,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, hash)
);

CREATE INDEX idx_ifc_models_project ON ifc_models(project_id);
CREATE INDEX idx_ifc_models_hash ON ifc_models(hash);

-- RLS: users can only access models for projects they belong to
ALTER TABLE ifc_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY ifc_models_select ON ifc_models FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY ifc_models_insert ON ifc_models FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY ifc_models_delete ON ifc_models FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'project_manager')
  ));
