-- ────────────────────────────────────────────────────────────────────────────
-- kb_retrieve — Phase 3a hybrid retrieval RPC
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
-- ADR-020: every Iris call retrieves through one canonical entrypoint
--
-- SECURITY DEFINER + explicit RLS scope checks inside the function. Returns
-- the top-k chunks scored by a hybrid blend:
--   score = vector_weight * (1 - cosine_distance) + tsv_weight * normalized_ts_rank
--           - freshness_decay * days_since_ingest
--
-- Default weights tuned during Phase 3e hybrid-blend tuning (Days 28-30 per
-- spec §6.3). Phase 3a ships placeholder weights; 3e re-balances.
--
-- The function NEVER reads chunks the caller's persona can't see. RLS scope
-- enforcement is INSIDE the function body (not table RLS), because the
-- ranking touches all candidate chunks and table-RLS would have already
-- filtered them before scoring.
--
-- Rollback: DROP FUNCTION kb_retrieve;

CREATE OR REPLACE FUNCTION public.kb_retrieve(
  q_embedding vector(1536),
  q_text TEXT,
  p_project_id UUID,
  p_persona TEXT DEFAULT 'pm',
  p_top_k INTEGER DEFAULT 5,
  p_vector_weight REAL DEFAULT 0.7,
  p_tsv_weight REAL DEFAULT 0.3,
  p_freshness_decay REAL DEFAULT 0.001,
  p_min_score REAL DEFAULT 0.1
)
RETURNS TABLE (
  chunk_id UUID,
  source_type public.iris_source_type,
  source_id TEXT,
  source_anchor JSONB,
  chunk_text TEXT,
  sensitivity public.iris_sensitivity,
  score REAL,
  ingested_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_max_role TEXT;
BEGIN
  -- 1. Resolve caller's role on the project (highest-permission row wins).
  --    Service-role calls bypass auth.uid() and read everything.
  IF v_user_id IS NULL THEN
    v_max_role := 'service_role';
  ELSE
    SELECT pm.role INTO v_max_role
    FROM public.project_members pm
    WHERE pm.user_id = v_user_id AND pm.project_id = p_project_id
    ORDER BY
      CASE pm.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'project_executive' THEN 3
        WHEN 'project_manager' THEN 4
        WHEN 'superintendent' THEN 5
        ELSE 99
      END
    LIMIT 1;

    -- Not a project member: return zero rows.
    IF v_max_role IS NULL THEN
      RETURN;
    END IF;
  END IF;

  -- 2. Score + rank candidates. The hybrid blend treats the cosine distance
  --    + ts_rank as competing signals; freshness gently penalizes stale rows.
  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.id,
      c.source_type,
      c.source_id,
      c.source_anchor,
      c.chunk_text,
      c.sensitivity,
      c.ingested_at,
      c.metadata,
      -- Cosine similarity is 1 - cosine_distance. Score is in [0, 1].
      CASE
        WHEN c.embedding IS NULL OR q_embedding IS NULL THEN 0.0::real
        ELSE (1.0 - (c.embedding <=> q_embedding))::real
      END AS vector_score,
      ts_rank(c.text_tsv, plainto_tsquery('english', q_text))::real AS tsv_score_raw
    FROM public.iris_kb_chunks c
    WHERE c.project_id = p_project_id
      AND c.deleted_at IS NULL
      -- Sensitivity gate (defense-in-depth alongside table RLS).
      AND (
        c.sensitivity = 'public_to_project'
        OR (c.sensitivity = 'gc_only' AND v_max_role IN ('owner', 'admin', 'project_executive', 'project_manager', 'superintendent', 'foreman', 'project_engineer', 'field_engineer', 'safety_manager', 'service_role'))
        OR (c.sensitivity = 'owner_only' AND v_max_role IN ('owner', 'owner_rep', 'service_role'))
        OR (c.sensitivity = 'finance_only' AND v_max_role IN ('admin', 'project_executive', 'service_role'))
      )
  ),
  normalized AS (
    SELECT
      *,
      -- Normalize ts_rank to [0, 1] across the candidate set.
      CASE
        WHEN MAX(tsv_score_raw) OVER () > 0
          THEN tsv_score_raw / MAX(tsv_score_raw) OVER ()
        ELSE 0.0::real
      END AS tsv_score
    FROM candidates
  ),
  scored AS (
    SELECT
      n.id,
      n.source_type,
      n.source_id,
      n.source_anchor,
      n.chunk_text,
      n.sensitivity,
      n.ingested_at,
      n.metadata,
      (
        p_vector_weight * n.vector_score
        + p_tsv_weight * n.tsv_score
        - p_freshness_decay * EXTRACT(epoch FROM (NOW() - n.ingested_at)) / 86400.0
      )::real AS final_score
    FROM normalized n
  )
  SELECT
    s.id AS chunk_id,
    s.source_type,
    s.source_id,
    s.source_anchor,
    s.chunk_text,
    s.sensitivity,
    s.final_score AS score,
    s.ingested_at,
    s.metadata
  FROM scored s
  WHERE s.final_score >= p_min_score
  ORDER BY s.final_score DESC
  LIMIT p_top_k;
END;
$$;

COMMENT ON FUNCTION public.kb_retrieve IS
  'Hybrid retrieval RPC: cosine + ts_rank blend with freshness decay. SECURITY DEFINER with explicit role/sensitivity gates inside the function body. Returns top-k chunks above p_min_score, ordered by score DESC.';

GRANT EXECUTE ON FUNCTION public.kb_retrieve(vector, TEXT, UUID, TEXT, INTEGER, REAL, REAL, REAL, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kb_retrieve(vector, TEXT, UUID, TEXT, INTEGER, REAL, REAL, REAL, REAL) TO service_role;
