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
