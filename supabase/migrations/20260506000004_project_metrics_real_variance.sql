-- ═══════════════════════════════════════════════════════════════
-- Migration: project_metrics — real schedule_variance_days
-- Version:   20260506000004
--
-- Drives:    P0 #11 hotfix — Avery Oaks dashboard schedule rollup.
--
-- Problem:   The `project_metrics` materialized view (introduced in
--            00051_get_portfolio_metrics_rpc.sql + 00054_metrics_views.sql)
--            hardcoded `0 AS schedule_variance_days`. Every project's Plan
--            page therefore read "On schedule" regardless of actual progress
--            vs. elapsed time, which broke the soft-pilot demo (Brad Cameron
--            walks an Avery Oaks Day-31 project and sees a flat zero).
--
-- Fix:       Redefine the view so `schedule_variance_days` is computed from
--            duration-weighted progress vs. elapsed time. The unweighted AVG
--            for `overall_progress` is preserved for backward compatibility
--            (other consumers depend on it as-is).
--
--            variance_days =
--              (weighted_pct/100) × total_schedule_days  -- "should be done by today"
--              − GREATEST(0, days_since_start)            -- "actually elapsed"
--
--            Positive → ahead of schedule.  Negative → behind.
--
--            Duration-weighted progress avoids the AVG bug where a 9-day
--            mobilization phase at 100% counts the same as a 180-day
--            framing phase at 15% — an honest demo number, not a flat
--            mean.
--
-- Idempotent: safe to rerun. Drops the view CASCADE so dependent objects
--             are reseeded; the only known dependent (get_portfolio_metrics)
--             is re-created here too.
-- ═══════════════════════════════════════════════════════════════

-- The materialized view is created WITH NO DATA so the migration step itself
-- doesn't block on the population query (~10s+ on a project with full join
-- fan-out). Hosted Supabase's migration channel times out around 30s, so
-- creation and refresh are split: refresh runs in a separate transaction
-- after CREATE INDEX establishes the unique key needed for CONCURRENTLY.
DROP MATERIALIZED VIEW IF EXISTS project_metrics CASCADE;

CREATE MATERIALIZED VIEW project_metrics AS
WITH phase_progress AS (
  -- Duration-weighted percent for variance, plus the unweighted AVG kept
  -- for the overall_progress column so existing consumers don't shift.
  SELECT
    sp.project_id,
    COALESCE(AVG(sp.percent_complete), 0)::numeric AS unweighted_pct,
    COALESCE(
      SUM(
        COALESCE(sp.percent_complete, 0)
          * GREATEST(1, EXTRACT(day FROM (sp.end_date::timestamptz - sp.start_date::timestamptz)))
      )
        / NULLIF(
            SUM(GREATEST(1, EXTRACT(day FROM (sp.end_date::timestamptz - sp.start_date::timestamptz)))),
            0
          ),
      0
    )::numeric AS weighted_pct
  FROM schedule_phases sp
  GROUP BY sp.project_id
)
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.contract_value,
  -- Schedule
  COALESCE(pp.unweighted_pct, 0)::int AS overall_progress,
  COUNT(DISTINCT sp.id) FILTER (WHERE sp.percent_complete >= 100) AS milestones_completed,
  COUNT(DISTINCT sp.id) AS milestones_total,
  -- RFIs
  COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('open', 'under_review')) AS rfis_open,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('open', 'under_review') AND r.due_date < CURRENT_DATE) AS rfis_overdue,
  COUNT(DISTINCT r.id) AS rfis_total,
  COALESCE(
    AVG(EXTRACT(DAY FROM (COALESCE(r.updated_at, NOW()) - r.created_at)))
      FILTER (WHERE r.status = 'closed'),
    0
  )::numeric(10,1) AS avg_rfi_response_days,
  -- Punch
  COUNT(DISTINCT pi.id) FILTER (WHERE pi.status IN ('open', 'in_progress')) AS punch_open,
  COUNT(DISTINCT pi.id) AS punch_total,
  -- Budget
  COALESCE(SUM(DISTINCT bi.original_amount), 0) AS budget_total,
  COALESCE(SUM(DISTINCT bi.actual_amount), 0) AS budget_spent,
  COALESCE(SUM(DISTINCT bi.committed_amount), 0) AS budget_committed,
  -- Crews
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') AS crews_active,
  COALESCE(SUM(c.size) FILTER (WHERE c.status = 'active'), 0) AS workers_onsite,
  -- Safety
  0 AS safety_incidents_this_month,
  -- Submittals
  COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('in_review', 'submitted')) AS submittals_pending,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'approved') AS submittals_approved,
  COUNT(DISTINCT s.id) AS submittals_total,
  -- Schedule variance — positive = ahead, negative = behind. Computed from
  -- duration-weighted progress vs. elapsed days. Returns 0 when project
  -- dates are missing (no anchor to compute against).
  CASE
    WHEN p.start_date IS NULL OR p.target_completion IS NULL THEN 0
    ELSE
      (
        (COALESCE(pp.weighted_pct, 0) / 100.0)
          * GREATEST(1, EXTRACT(day FROM (p.target_completion::timestamptz - p.start_date::timestamptz)))
        - GREATEST(0, EXTRACT(day FROM (now() - p.start_date::timestamptz)))
      )::int
  END AS schedule_variance_days
FROM projects p
LEFT JOIN phase_progress pp ON pp.project_id = p.id
LEFT JOIN schedule_phases sp ON sp.project_id = p.id
LEFT JOIN rfis r ON r.project_id = p.id
LEFT JOIN punch_items pi ON pi.project_id = p.id
LEFT JOIN budget_items bi ON bi.project_id = p.id
LEFT JOIN crews c ON c.project_id = p.id
LEFT JOIN submittals s ON s.project_id = p.id
GROUP BY p.id, p.name, p.contract_value, pp.unweighted_pct, pp.weighted_pct,
         p.start_date, p.target_completion
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_metrics_pid ON project_metrics(project_id);

-- Refresh function — kept identical to the original signature so cron
-- jobs and edge functions don't need to change.
CREATE OR REPLACE FUNCTION refresh_project_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_metrics;
END;
$$ LANGUAGE plpgsql;

-- Recreate the get_portfolio_metrics RPC (it was dropped CASCADE above).
-- Same shape and semantics as 00051_get_portfolio_metrics_rpc.sql so callers
-- don't need to change.
CREATE OR REPLACE FUNCTION get_portfolio_metrics(org_id uuid)
RETURNS TABLE (
  total_projects            bigint,
  active_projects           bigint,
  total_contract_value      numeric,
  avg_completion_percentage int,
  projects_on_schedule      bigint,
  projects_at_risk          bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COUNT(p.id)                                                               AS total_projects,
    COUNT(p.id) FILTER (WHERE p.status = 'active')                           AS active_projects,
    COALESCE(SUM(p.contract_value), 0)                                        AS total_contract_value,
    COALESCE(AVG(pm.overall_progress), 0)::int                               AS avg_completion_percentage,
    COUNT(p.id) FILTER (WHERE COALESCE(pm.schedule_variance_days, 0) >= 0)   AS projects_on_schedule,
    COUNT(p.id) FILTER (
      WHERE pm.schedule_variance_days IS NOT NULL
        AND pm.schedule_variance_days < -7
    )                                                                          AS projects_at_risk
  FROM projects p
  LEFT JOIN project_metrics pm ON pm.project_id = p.id
  WHERE p.organization_id = org_id;
$$;

GRANT EXECUTE ON FUNCTION get_portfolio_metrics(uuid) TO authenticated;

-- Initial population — runs in its own transaction. CONCURRENTLY isn't valid
-- on a fresh empty MV, so the first refresh is non-concurrent; subsequent
-- refreshes (via refresh_project_metrics() / cron) use CONCURRENTLY.
COMMIT;
REFRESH MATERIALIZED VIEW project_metrics;
