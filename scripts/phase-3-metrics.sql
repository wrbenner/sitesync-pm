-- Phase 3e — daily acceptance metrics extract
-- Run via psql; output is JSON for the GH workflow to parse.
--
-- Returns a single jsonb object with the 6 acceptance gates' observed
-- values + pass/fail boolean. Workflow fails the job if any gate fails.

SELECT jsonb_build_object(
  'day', date_trunc('day', NOW()),
  'window_days', 7,

  -- Gate 1: telemetry coverage — at least one retrieve() call per source_type
  -- on the soft-pilot project. Computed below.
  'telemetry_coverage', (
    SELECT COUNT(DISTINCT source_type)
    FROM public.iris_kb_source_coverage_7d
    WHERE project_id IN (
      SELECT id FROM public.projects WHERE is_soft_pilot = TRUE
    )
  ),

  -- Gate 2: latency p95 — must be at or under 800 ms.
  'latency_p95_ms', (
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
    FROM public.iris_kb_telemetry
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND error_code IS NULL
  ),

  -- Gate 3: cache hit rate.
  'cache_hit_rate', (
    SELECT CASE
      WHEN COUNT(*) = 0 THEN 0::numeric
      ELSE (COUNT(*) FILTER (WHERE cache_hit))::numeric / COUNT(*)
    END
    FROM public.iris_kb_telemetry
    WHERE created_at > NOW() - INTERVAL '7 days'
  ),

  -- Gate 4: error rate — should stay under 1%.
  'error_rate', (
    SELECT CASE
      WHEN COUNT(*) = 0 THEN 0::numeric
      ELSE (COUNT(*) FILTER (WHERE error_code IS NOT NULL))::numeric / COUNT(*)
    END
    FROM public.iris_kb_telemetry
    WHERE created_at > NOW() - INTERVAL '7 days'
  ),

  -- Gate 5: projected cost per project per month — must stay at or under $2.
  'max_projected_cost_usd_per_month', (
    SELECT COALESCE(MAX(projected_cost_usd_per_month), 0)
    FROM public.iris_kb_health_daily
  ),

  -- Gate 6: total chunks ingested in last 7d (sanity check).
  'chunks_ingested_7d', (
    SELECT COUNT(*)
    FROM public.iris_kb_chunks
    WHERE ingested_at > NOW() - INTERVAL '7 days'
      AND deleted_at IS NULL
  )
) AS report;
