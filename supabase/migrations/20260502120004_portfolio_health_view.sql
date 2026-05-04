-- ═══════════════════════════════════════════════════════════════
-- Migration: project_health_summary materialized view + refresh fn
-- Version: 20260502120004
--
-- Pre-aggregates per-project metrics for the portfolio dashboard.
-- Refreshed every 5 minutes via pg_cron — see ENTERPRISE_ADOPTION_PACK.md
-- for the cron entry to add.
--
-- Uses CONCURRENTLY-safe REFRESH so dashboard reads don't block.
-- The unique index on `project_id` is the precondition for that.
--
-- Note: this view is fully replaced by 20260503110002_materialized_views.sql
-- with a richer schema. The version here is intentionally minimal so it
-- references only columns that are guaranteed to exist on `projects`.
-- ═══════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS project_health_summary;

CREATE MATERIALIZED VIEW project_health_summary AS
WITH rfi_counts AS (
  SELECT
    project_id,
    COUNT(*) FILTER (WHERE status NOT IN ('closed','answered')
                       AND due_date < now()) AS rfis_overdue
  FROM rfis
  GROUP BY project_id
),
incident_counts AS (
  SELECT
    project_id,
    COUNT(*) AS incidents_ytd
  FROM incidents
  WHERE created_at >= date_trunc('year', now())
  GROUP BY project_id
),
sched AS (
  SELECT
    p.id AS project_id,
    -- Negative = behind, positive = ahead. Days until target completion.
    COALESCE(
      EXTRACT(epoch FROM (MAX(p.target_completion::timestamptz) - now())) / 86400, 0
    )::int AS schedule_variance_days
  FROM projects p
  GROUP BY p.id
)
SELECT
  p.id                                            AS project_id,
  p.organization_id,
  p.name                                          AS project_name,
  p.status,
  COALESCE(p.contract_value, 0)                   AS contract_value,
  0::numeric                                      AS percent_complete,
  COALESCE(rc.rfis_overdue, 0)                    AS rfis_overdue,
  COALESCE(ic.incidents_ytd, 0)                   AS safety_incidents_ytd,
  COALESCE(sc.schedule_variance_days, 0)          AS schedule_variance_days,
  0::numeric                                      AS profit_margin_pct,
  'unknown'::text                                 AS payapp_status,
  now()                                           AS refreshed_at
FROM projects p
LEFT JOIN rfi_counts rc ON rc.project_id = p.id
LEFT JOIN incident_counts ic ON ic.project_id = p.id
LEFT JOIN sched sc ON sc.project_id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS project_health_summary_pk
  ON project_health_summary (project_id);

CREATE INDEX IF NOT EXISTS idx_project_health_summary_org
  ON project_health_summary (organization_id);

-- Refresh function — used by both pg_cron and the
-- portfolio-summary-refresh edge function.
CREATE OR REPLACE FUNCTION refresh_project_health_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_health_summary;
END;
$$;
