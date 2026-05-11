-- ────────────────────────────────────────────────────────────────────────────
-- iris_kb_telemetry — Phase 3c retrieval-event log
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6, §11
--
-- One row per retrieve() invocation. Phase 3e's daily-acceptance workflow
-- aggregates this table to compute the 7-day acceptance gates:
--   - latency_p95 <= 800 ms
--   - cache_hit_rate >= 60% (synthetic-load proxy)
--   - chunks_returned distribution (catches "always empty" failure modes)
--
-- Day-0 SQL bug screen:
--   - No || concat in DDL: PASS (single string COMMENTs).
--   - No expression in PRIMARY KEY: PASS (id UUID PK only).
--   - FK column types match: PASS (project_id UUID -> projects.id UUID).
--   - Timestamp 20261008000005 unique: PASS.

CREATE TABLE IF NOT EXISTS public.iris_kb_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  persona TEXT NOT NULL,
  query_text TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  chunks_returned INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  caller_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT iris_kb_telemetry_latency_nonneg CHECK (latency_ms >= 0),
  CONSTRAINT iris_kb_telemetry_chunks_nonneg CHECK (chunks_returned >= 0)
);

COMMENT ON TABLE public.iris_kb_telemetry IS
  'One row per retrieve() invocation. Joined by phase-3-acceptance.yml to compute latency_p95, cache_hit_rate, and chunks_returned distribution.';

CREATE INDEX IF NOT EXISTS iris_kb_telemetry_project_created_at_idx
  ON public.iris_kb_telemetry (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS iris_kb_telemetry_cache_hit_created_at_idx
  ON public.iris_kb_telemetry (cache_hit, created_at DESC);

CREATE INDEX IF NOT EXISTS iris_kb_telemetry_error_code_created_at_idx
  ON public.iris_kb_telemetry (error_code, created_at DESC)
  WHERE error_code IS NOT NULL;

-- RLS: telemetry visible to project members + service role. Owners/admins
-- see all rows for their projects.
ALTER TABLE public.iris_kb_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iris_kb_telemetry_select ON public.iris_kb_telemetry;
CREATE POLICY iris_kb_telemetry_select ON public.iris_kb_telemetry
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = iris_kb_telemetry.project_id
    )
  );

DROP POLICY IF EXISTS iris_kb_telemetry_insert ON public.iris_kb_telemetry;
CREATE POLICY iris_kb_telemetry_insert ON public.iris_kb_telemetry
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = iris_kb_telemetry.project_id
    )
  );

-- ── Recording helper RPC ──────────────────────────────────────────────────
-- retrieve() calls this from the browser/edge. SECURITY DEFINER so the row
-- write doesn't require client-side INSERT grants on the table; the RPC
-- enforces project membership inline.

CREATE OR REPLACE FUNCTION public.iris_kb_record_retrieve(
  p_project_id UUID,
  p_persona TEXT,
  p_query_text TEXT,
  p_latency_ms INTEGER,
  p_cache_hit BOOLEAN,
  p_chunks_returned INTEGER,
  p_error_code TEXT DEFAULT NULL,
  p_caller_tag TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
BEGIN
  -- Service-role bypasses membership check.
  IF v_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = v_user_id
        AND pm.project_id = p_project_id
    ) THEN
      -- Not a project member — refuse to log. The retrieve() RPC already
      -- returned zero chunks for them, so emitting telemetry would leak the
      -- attempt.
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.iris_kb_telemetry (
    project_id, persona, query_text, latency_ms,
    cache_hit, chunks_returned, error_code, caller_tag
  ) VALUES (
    p_project_id, p_persona, p_query_text, p_latency_ms,
    p_cache_hit, p_chunks_returned, p_error_code, p_caller_tag
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.iris_kb_record_retrieve IS
  'Records a single retrieve() invocation in iris_kb_telemetry. SECURITY DEFINER; refuses to log for non-members.';

GRANT EXECUTE ON FUNCTION public.iris_kb_record_retrieve(UUID, TEXT, TEXT, INTEGER, BOOLEAN, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iris_kb_record_retrieve(UUID, TEXT, TEXT, INTEGER, BOOLEAN, INTEGER, TEXT, TEXT) TO service_role;

-- ── 1-hour rolling p95 view (lightweight; not a matview) ───────────────────
-- Phase 3e's daily-acceptance workflow queries this directly. A matview
-- version with the same shape lands in 3e for the 7-day aggregation.

CREATE OR REPLACE VIEW public.iris_kb_retrieval_p95_1h AS
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS n_calls,
  COUNT(*) FILTER (WHERE cache_hit) AS n_cache_hits,
  COUNT(*) FILTER (WHERE error_code IS NOT NULL) AS n_errors,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS latency_p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS latency_p95,
  AVG(chunks_returned) AS avg_chunks_returned
FROM public.iris_kb_telemetry
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1
ORDER BY 1 DESC;

COMMENT ON VIEW public.iris_kb_retrieval_p95_1h IS
  'Rolling 1-hour p95 latency / cache-hit / error breakdown for retrieve(). Phase 3e daily workflow queries this directly.';

GRANT SELECT ON public.iris_kb_retrieval_p95_1h TO authenticated;
GRANT SELECT ON public.iris_kb_retrieval_p95_1h TO service_role;
