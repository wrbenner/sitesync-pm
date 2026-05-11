-- ────────────────────────────────────────────────────────────────────────────
-- Phase 1 acceptance metrics — queried daily by phase-1-acceptance.yml
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §11
--
-- Emits one row per metric in the form:
--   metric_name|value|threshold|comparator|status
--
-- The workflow runner parses the rows and aggregates pass/fail. A row's
-- status is 'green' when the value satisfies the comparator vs threshold,
-- 'red' otherwise. Walker-rated rubric metrics are not in this query —
-- they're tracked in the Day 27 review log.
--
-- Lookback window: 7 days. The 7-consecutive-day requirement is enforced
-- by the workflow comparing 7 successive daily-job results, not in SQL.

WITH window AS (
  SELECT (NOW() - INTERVAL '7 days') AS since
),

iris_calls_7d AS (
  SELECT
    a.id,
    (a.metadata ->> 'use_fabric')::boolean AS use_fabric,
    (a.metadata ->> 'fabric_version')      AS fabric_version,
    (a.metadata ->> 'fabric_persona')      AS fabric_persona
  FROM audit_log a, window
  WHERE a.action = 'iris_call.generate'
    AND a.created_at >= window.since
),

fabric_used_pct AS (
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN NULL
      ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE use_fabric IS TRUE) / COUNT(*), 2)
    END AS pct
  FROM iris_calls_7d
),

acceptance_rate AS (
  -- From the existing lap_2_gate_metrics_daily matview (Day 30.75 receipt).
  -- We want the 7-day mean compared to the 7-prior-day mean (the spec's
  -- "no drop > 3 pp vs baseline" check).
  SELECT
    ROUND(AVG(CASE
      WHEN m.metric_date >= NOW() - INTERVAL '7 days' THEN m.acceptance_rate_pct
    END)::numeric, 2) AS current_7d,
    ROUND(AVG(CASE
      WHEN m.metric_date <  NOW() - INTERVAL '7 days'
       AND m.metric_date >= NOW() - INTERVAL '14 days' THEN m.acceptance_rate_pct
    END)::numeric, 2) AS prior_7d
  FROM lap_2_gate_metrics_daily m
)

-- Metric 1: fabric_used_pct ≥ 80
SELECT
  'fabric_used_pct'                                                AS metric_name,
  COALESCE(f.pct::text, 'n/a')                                     AS value,
  '80'                                                             AS threshold,
  '>='                                                             AS comparator,
  CASE
    WHEN f.pct IS NULL THEN 'no_data'
    WHEN f.pct >= 80 THEN 'green'
    ELSE 'red'
  END                                                              AS status
FROM fabric_used_pct f
UNION ALL
-- Metric 2: acceptance_rate (current 7d) within 3 pp of prior 7d
SELECT
  'acceptance_rate_no_regression'                                  AS metric_name,
  COALESCE(a.current_7d::text || ' (prior: ' || a.prior_7d::text || ')', 'n/a') AS value,
  '-3'                                                             AS threshold,
  '>='                                                             AS comparator,
  CASE
    WHEN a.current_7d IS NULL OR a.prior_7d IS NULL THEN 'no_data'
    WHEN (a.current_7d - a.prior_7d) >= -3 THEN 'green'
    ELSE 'red'
  END                                                              AS status
FROM acceptance_rate a;
