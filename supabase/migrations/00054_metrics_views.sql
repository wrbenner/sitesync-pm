-- Materialized view for project dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS project_metrics AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.contract_value,
  -- Schedule
  COALESCE(AVG(sp.percent_complete), 0)::int AS overall_progress,
  COUNT(DISTINCT sp.id) FILTER (WHERE sp.percent_complete >= 100) AS milestones_completed,
  COUNT(DISTINCT sp.id) AS milestones_total,
  -- RFIs
  COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('open', 'under_review')) AS rfis_open,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('open', 'under_review') AND r.due_date < CURRENT_DATE) AS rfis_overdue,
  COUNT(DISTINCT r.id) AS rfis_total,
  COALESCE(AVG(EXTRACT(DAY FROM (COALESCE(r.updated_at, NOW()) - r.created_at))) FILTER (WHERE r.status = 'closed'), 0)::numeric(10,1) AS avg_rfi_response_days,
  -- Punch Items
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
  COUNT(DISTINCT s.id) AS submittals_total
FROM projects p
LEFT JOIN schedule_phases sp ON sp.project_id = p.id
LEFT JOIN rfis r ON r.project_id = p.id
LEFT JOIN punch_items pi ON pi.project_id = p.id
LEFT JOIN budget_items bi ON bi.project_id = p.id
LEFT JOIN crews c ON c.project_id = p.id
LEFT JOIN submittals s ON s.project_id = p.id
GROUP BY p.id, p.name, p.contract_value;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_metrics_pid ON project_metrics(project_id);

-- Function to refresh metrics (call via cron or trigger)
CREATE OR REPLACE FUNCTION refresh_project_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_metrics;
END;
$$ LANGUAGE plpgsql;
