-- ────────────────────────────────────────────────────────────────────────────
-- iris_kb_chunks — Phase 3a knowledge-base substrate (Universal Knowledge Absorption)
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
-- ADRs: ADR-017 (embedding model: text-embedding-3-large @ 1536 dims)
--       ADR-021 (cross-project anonymization — within-tenant only in Phase 3-6)
--       ADR-004 (citations open in side panel — kept untouched here)
--
-- One table, one retrieval surface. Every chunk carries:
--   - the embedding (vector(1536), HNSW-indexed, cosine distance)
--   - a tsvector for keyword search (GIN-indexed)
--   - source_type + source_id + source_anchor for "where did this come from"
--   - sensitivity flag for RLS scope enforcement
--   - embedding_model_version so future model swaps don't destroy chunks
--   - soft-delete columns (tombstone-on-update, restore-on-rebuild)
--
-- Rollback: DROP TABLE iris_kb_chunks CASCADE; DROP TYPE iris_source_type;
-- DROP TYPE iris_sensitivity. Extensions stay (other features use them).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.iris_source_type AS ENUM (
    'drawing',
    'spec_section',
    'submittal',
    'rfi',
    'daily_log',
    'photo',
    'conversation',
    'contract',
    'change_order',
    'bulletin',
    'asi',
    'spreadsheet',
    'pay_app',
    'lien_waiver',
    'punch_item',
    'unclassified'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.iris_sensitivity AS ENUM (
    'public_to_project',
    'gc_only',
    'owner_only',
    'finance_only'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Main table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.iris_kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source tracking
  source_type public.iris_source_type NOT NULL,
  source_id TEXT NOT NULL,
  source_anchor JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Scope (RLS keys)
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sensitivity public.iris_sensitivity NOT NULL DEFAULT 'public_to_project',
  -- Content
  chunk_text TEXT NOT NULL,
  chunk_token_count INTEGER,
  text_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  -- Vector
  embedding vector(1536),
  embedding_model_version TEXT NOT NULL DEFAULT 'text-embedding-3-large',
  -- Versioning + soft delete
  version_hash TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  -- Free-form metadata for per-source-type fields
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

-- HNSW vector index (cosine). Soft-delete-aware partial index keeps the
-- working set small. m=16/ef_construction=64 is the spec §7 sweet spot.
CREATE INDEX IF NOT EXISTS idx_iris_kb_chunks_embedding_hnsw
  ON public.iris_kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE deleted_at IS NULL;

-- Keyword search index (hybrid blend with vector).
CREATE INDEX IF NOT EXISTS idx_iris_kb_chunks_text_tsv
  ON public.iris_kb_chunks USING gin (text_tsv)
  WHERE deleted_at IS NULL;

-- Metadata GIN for filter queries (e.g. WHERE metadata @> '{"discipline":"MEP"}').
CREATE INDEX IF NOT EXISTS idx_iris_kb_chunks_metadata
  ON public.iris_kb_chunks USING gin (metadata)
  WHERE deleted_at IS NULL;

-- Project + source lookup (re-ingest tombstone path).
CREATE INDEX IF NOT EXISTS idx_iris_kb_chunks_source_lookup
  ON public.iris_kb_chunks (project_id, source_type, source_id)
  WHERE deleted_at IS NULL;

-- Per-org telemetry rollups.
CREATE INDEX IF NOT EXISTS idx_iris_kb_chunks_org_ingested
  ON public.iris_kb_chunks (org_id, ingested_at DESC)
  WHERE deleted_at IS NULL;

-- ── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.iris_kb_chunks IS
  'Universal knowledge-base chunks. One row per indexed segment of a source artifact. Retrieved via kb_retrieve() RPC. Soft-delete via deleted_at; HNSW index excludes tombstoned rows for speed.';

COMMENT ON COLUMN public.iris_kb_chunks.source_anchor IS
  'Per-source-type anchor metadata. drawing -> {sheet, bbox}; spec -> {section, page}; rfi -> {rfi_id, response_idx}; daily_log -> {section}; photo -> {asset_id}; etc.';

COMMENT ON COLUMN public.iris_kb_chunks.version_hash IS
  'SHA-256 of the source artifact at ingest time. Re-ingest with same hash is a no-op; different hash tombstones old chunks + inserts new.';

COMMENT ON COLUMN public.iris_kb_chunks.embedding_model_version IS
  'Model that produced the embedding. Future model swaps re-embed lazily; existing chunks stay valid until re-embed lands.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Defense in depth: the kb_retrieve() RPC enforces RLS server-side, AND
-- the table itself blocks direct reads. Sensitivity tiers gate cross-role
-- visibility within the same project.

ALTER TABLE public.iris_kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iris_kb_chunks: project members read public + role-scoped"
  ON public.iris_kb_chunks FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      -- public_to_project: any project member can read
      (sensitivity = 'public_to_project' AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
      ))
      OR
      -- gc_only: GC-side roles only
      (sensitivity = 'gc_only' AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('admin', 'project_manager', 'superintendent', 'foreman', 'project_engineer', 'field_engineer', 'safety_manager')
      ))
      OR
      -- owner_only: owner / owner_rep only
      (sensitivity = 'owner_only' AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'owner_rep')
      ))
      OR
      -- finance_only: office persona surfaces (admin + office)
      (sensitivity = 'finance_only' AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid() AND pm.role IN ('admin', 'project_executive')
      ))
    )
  );

CREATE POLICY "iris_kb_chunks: service-role writes only"
  ON public.iris_kb_chunks FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "iris_kb_chunks: service-role tombstones + re-embeds only"
  ON public.iris_kb_chunks FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);
