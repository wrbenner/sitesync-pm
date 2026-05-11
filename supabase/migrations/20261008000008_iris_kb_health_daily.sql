-- ────────────────────────────────────────────────────────────────────────────
-- iris_kb_health_daily — Phase 3e
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §11
--
-- Rolling 7-day rollup of retrieval health. Phase 3e's daily-acceptance
-- workflow queries this view to verify the 7-day acceptance gates:
--   - retrieve_count >= 1 per source_type (telemetry coverage)
--   - latency_p95 <= 800 ms
--   - cache_hit_rate >= 60% (synthetic load proxy)
--   - cost projected at $0.0X per project per month
--
-- Implemented as a view (not a matview) so it's always live. The daily
-- workflow caches its result for reporting, not the view itself.
--
-- Day-0 SQL bug screen:
--   - No || concat in DDL: PASS (|| inside SELECT body is fine).
--   - No expression in PRIMARY KEY: PASS (no PKs added; view only).
--   - FK column types match: PASS (no FKs).
--   - Timestamp 20261008000008 unique: PASS.

CREATE OR REPLACE VIEW public.iris_kb_health_daily AS
WITH last_7d AS (
  SELECT *
  FROM public.iris_kb_telemetry
  WHERE created_at > NOW() - INTERVAL '7 days'
),
per_day AS (
  SELECT
    date_trunc('day', created_at) AS day,
    project_id,
    COUNT(*) AS n_calls,
    COUNT(*) FILTER (WHERE cache_hit) AS n_cache_hits,
    COUNT(*) FILTER (WHERE error_code IS NOT NULL) AS n_errors,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS latency_p50,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS latency_p95,
    AVG(chunks_returned)::numeric(10,2) AS avg_chunks_returned,
    SUM(LENGTH(query_text)) AS total_query_chars
  FROM last_7d
  GROUP BY 1, 2
)
SELECT
  day,
  project_id,
  n_calls,
  n_cache_hits,
  n_errors,
  latency_p50,
  latency_p95,
  avg_chunks_returned,
  CASE
    WHEN n_calls > 0 THEN (n_cache_hits::numeric / n_calls)
    ELSE 0::numeric
  END AS cache_hit_rate,
  CASE
    WHEN n_calls > 0 THEN (n_errors::numeric / n_calls)
    ELSE 0::numeric
  END AS error_rate,
  -- Rough cost projection per project per month, assuming embedding cost
  -- scales linearly with total query chars (~$0.13 per 1M tokens for
  -- text-embedding-3-large @ ~4 chars/token, only for cache-miss calls).
  CASE
    WHEN n_calls = 0 THEN 0::numeric
    ELSE (
      (total_query_chars::numeric / 4.0)  -- approx tokens
      * (1.0 - n_cache_hits::numeric / n_calls)  -- cache-miss rate
      * 0.00000013  -- $0.13 per 1M tokens
      * (30.0 / 7.0)  -- scale 7d window to monthly
    )::numeric(10,4)
  END AS projected_cost_usd_per_month
FROM per_day
ORDER BY day DESC, project_id;

COMMENT ON VIEW public.iris_kb_health_daily IS
  'Rolling 7-day retrieval health rollup per project. Phase 3e daily-acceptance workflow queries this view to verify acceptance gates.';

GRANT SELECT ON public.iris_kb_health_daily TO authenticated;
GRANT SELECT ON public.iris_kb_health_daily TO service_role;

-- ── Source-type coverage view ─────────────────────────────────────────────
-- Acceptance gate: every iris_source_type ingested at least once over 7d.
-- The view rolls chunk-counts per source_type per project.

CREATE OR REPLACE VIEW public.iris_kb_source_coverage_7d AS
SELECT
  c.project_id,
  c.source_type,
  COUNT(*) AS chunk_count,
  MAX(c.ingested_at) AS most_recent_ingest_at
FROM public.iris_kb_chunks c
WHERE c.ingested_at > NOW() - INTERVAL '7 days'
  AND c.deleted_at IS NULL
GROUP BY c.project_id, c.source_type
ORDER BY c.project_id, c.source_type;

COMMENT ON VIEW public.iris_kb_source_coverage_7d IS
  'Per-project per-source-type 7-day ingest coverage. Phase 3e acceptance gate requires every iris_source_type to have at least one fresh chunk for the soft-pilot project.';

GRANT SELECT ON public.iris_kb_source_coverage_7d TO authenticated;
GRANT SELECT ON public.iris_kb_source_coverage_7d TO service_role;
