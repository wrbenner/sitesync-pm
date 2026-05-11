-- ────────────────────────────────────────────────────────────────────────────
-- iris_kb_sources — Phase 3a ingest tracker
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
--
-- One row per (source_type, source_id) the system has ever seen. Workers
-- write here on ingest start + finish so we can distinguish "chunks were
-- generated" from "ingest is still running" from "ingest failed". The
-- iris_kb_chunks table doesn't have status — only the source tracker does.
--
-- Rollback: DROP TABLE iris_kb_sources.

CREATE TABLE IF NOT EXISTS public.iris_kb_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type public.iris_source_type NOT NULL,
  source_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Latest ingest cycle
  last_ingested_at TIMESTAMPTZ,
  ingestion_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ingestion_status IN ('pending', 'running', 'succeeded', 'failed', 'tombstoned')),
  last_version_hash TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  -- Failure tracking
  error_log TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  -- Bookkeeping
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_iris_kb_sources_status
  ON public.iris_kb_sources (ingestion_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_iris_kb_sources_org_type
  ON public.iris_kb_sources (org_id, source_type);

COMMENT ON TABLE public.iris_kb_sources IS
  'One row per source artifact the system has tried to ingest. Tracks ingest status, last successful version_hash, chunk count, failure history. The iris_kb_chunks table holds the indexed content; this table holds the ingest book.';

COMMENT ON COLUMN public.iris_kb_sources.last_version_hash IS
  'Hash of the source content at last successful ingest. If a fresh attempt computes the same hash, skip re-embed. Different hash triggers tombstone+rebuild.';

ALTER TABLE public.iris_kb_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iris_kb_sources: project members read own-project"
  ON public.iris_kb_sources FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "iris_kb_sources: service-role manages"
  ON public.iris_kb_sources FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
