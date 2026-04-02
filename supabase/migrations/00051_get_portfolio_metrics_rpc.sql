-- Ensure the project_metrics materialized view exists before referencing it.
-- The full definition lives in 00054_metrics_views.sql; this is a forward-
-- declaration so the RPC function below can compile.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'project_metrics' AND relkind = 'm') THEN
    EXECUTE $mv$
      CREATE MATERIALIZED VIEW project_metrics AS
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        p.contract_value,
        COALESCE(AVG(sp.percent_complete), 0)::int AS overall_progress,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.percent_complete >= 100) AS milestones_completed,
        COUNT(DISTINCT sp.id) AS milestones_total,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('open', 'under_review')) AS rfis_open,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('open', 'under_review') AND r.due_date < CURRENT_DATE) AS rfis_overdue,
        COUNT(DISTINCT r.id) AS rfis_total,
        COALESCE(AVG(EXTRACT(DAY FROM (COALESCE(r.updated_at, NOW()) - r.created_at))) FILTER (WHERE r.status = 'closed'), 0)::numeric(10,1) AS avg_rfi_response_days,
        COUNT(DISTINCT pi.id) FILTER (WHERE pi.status IN ('open', 'in_progress')) AS punch_open,
        COUNT(DISTINCT pi.id) AS punch_total,
        COALESCE(SUM(DISTINCT bi.original_amount), 0) AS budget_total,
        COALESCE(SUM(DISTINCT bi.actual_amount), 0) AS budget_spent,
        COALESCE(SUM(DISTINCT bi.committed_amount), 0) AS budget_committed,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') AS crews_active,
        COALESCE(SUM(c.size) FILTER (WHERE c.status = 'active'), 0) AS workers_onsite,
        0 AS safety_incidents_this_month,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('in_review', 'submitted')) AS submittals_pending,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'approved') AS submittals_approved,
        COUNT(DISTINCT s.id) AS submittals_total,
        0 AS schedule_variance_days
      FROM projects p
      LEFT JOIN schedule_phases sp ON sp.project_id = p.id
      LEFT JOIN rfis r ON r.project_id = p.id
      LEFT JOIN punch_items pi ON pi.project_id = p.id
      LEFT JOIN budget_items bi ON bi.project_id = p.id
      LEFT JOIN crews c ON c.project_id = p.id
      LEFT JOIN submittals s ON s.project_id = p.id
      GROUP BY p.id, p.name, p.contract_value
    $mv$;
    EXECUTE 'CREATE UNIQUE INDEX idx_project_metrics_pid ON project_metrics(project_id)';
  END IF;
END $$;

-- RPC: aggregate portfolio metrics for an org in a single query.
-- Returns one row per call, eliminating the previous fetch-all-projects pattern.
-- Joins project_metrics (materialized view) for schedule variance and completion data.
-- schedule_variance_days defaults to 0 (on schedule) when NULL or view not yet populated.
--
-- Performance: single seq-scan + hash-join on projects + project_metrics.
-- Recommended index: CREATE INDEX idx_projects_org_id ON projects(organization_id);
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
