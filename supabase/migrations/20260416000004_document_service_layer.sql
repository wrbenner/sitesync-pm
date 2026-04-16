-- Document service layer: formal documents with lifecycle management
-- Separate from `files` (raw storage) to allow approval workflow without migration risk.
-- DocumentSearch.tsx already queries this table via supabase.from('documents').

CREATE TABLE IF NOT EXISTS documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  status        text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'under_review', 'approved', 'archived')),
  file_url      text,
  file_size     bigint,
  content_type  text,
  folder        text,
  tags          jsonb,
  discipline    text,
  trade         text,
  reviewer_id   uuid        REFERENCES auth.users(id),
  -- Provenance
  created_by    uuid        REFERENCES auth.users(id),
  updated_by    uuid        REFERENCES auth.users(id),
  -- Soft-delete
  deleted_at    timestamptz,
  deleted_by    uuid        REFERENCES auth.users(id),
  -- Timestamps
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS documents_project_id_idx  ON documents (project_id);
CREATE INDEX IF NOT EXISTS documents_status_idx       ON documents (status);
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx   ON documents (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_created_by_idx   ON documents (created_by);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Project members can read non-deleted documents for their project
DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Project members can insert documents (created_by enforced in service layer)
DROP POLICY IF EXISTS documents_insert ON documents;
CREATE POLICY documents_insert ON documents
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Members can update non-deleted documents. Status transitions enforced in service layer.
DROP POLICY IF EXISTS documents_update ON documents;
CREATE POLICY documents_update ON documents
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Hard delete is disabled. Use soft-delete via UPDATE.
DROP POLICY IF EXISTS documents_delete ON documents;
CREATE POLICY documents_delete ON documents
  FOR DELETE
  USING (false);

-- Semantic search RPC support: match_documents uses pgvector or trgm.
-- If document_embeddings table exists, it references documents.id.
-- The RPC is already referenced in DocumentSearch.tsx and is expected by the app.
