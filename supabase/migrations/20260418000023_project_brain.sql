-- Project Brain (RAG) — Vector search across all project documents.
-- Uses pgvector with OpenAI ada-002 (1536 dims) embeddings.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  document_id uuid,
  document_name text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_chunks' AND column_name = 'project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_chunks_project ON document_chunks(project_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_chunks' AND column_name = 'document_id') THEN
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
  END IF;
END $$;

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_chunks_select ON document_chunks;
CREATE POLICY document_chunks_select ON document_chunks FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS document_chunks_insert ON document_chunks;
CREATE POLICY document_chunks_insert ON document_chunks FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS document_chunks_delete ON document_chunks;
CREATE POLICY document_chunks_delete ON document_chunks FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Similarity search helper: returns top-K chunks for a project given a query embedding.
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  p_project_id uuid,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  document_name text,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.document_name,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.project_id = p_project_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
