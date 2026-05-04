-- =============================================================================
-- Materialized views for high-traffic rollups
-- =============================================================================
-- Every dashboard / list-page does aggregate queries on every load. Move
-- them off the live tables and onto a materialized view refreshed every
-- 5 min by the refresh-materialized-views edge function.
--
-- Each view carries a `refreshed_at` column populated at refresh time so
-- the UI can show staleness and the watcher can alert when it's > 30 min
-- old. The fallback path: if a view is missing or stale, the page falls
-- back to a live query and renders a banner ("Showing live data — view
-- refresh delayed").
--
-- 4 views — chosen by request volume and aggregation cost:
--   1. project_health_summary       dashboard project-card data
--   2. rfi_kpi_rollup                top of /rfis page
--   3. punch_list_status_rollup      top of /punch-list page
--   4. pay_app_status_summary         financial dashboard
-- =============================================================================

-- 1. project_health_summary -------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS project_health_summary CASCADE;
CREATE MATERIALIZED VIEW project_health_summary AS
SELECT
  p.id AS project_id,
  p.name,
  p.status,
  p.organization_id,
  -- RFI rollup
  (SELECT count(*) FROM rfis r WHERE r.project_id = p.id AND r.status = 'open')                  AS open_rfis,
  (SELECT count(*) FROM rfis r WHERE r.project_id = p.id AND r.status = 'open' AND r.due_date < CURRENT_DATE) AS overdue_rfis,
  -- Submittal rollup
  (SELECT count(*) FROM submittals s WHERE s.project_id = p.id AND s.status IN ('pending','under_review')) AS pending_submittals,
  -- Punch rollup
  (SELECT count(*) FROM punch_items pi WHERE pi.project_id = p.id AND pi.status NOT IN ('verified','resolved')) AS open_punch_items,
  (SELECT count(*) FROM punch_items pi WHERE pi.project_id = p.id AND pi.priority = 'critical' AND pi.status NOT IN ('verified','resolved')) AS critical_punch_items,
  -- Change order rollup
  (SELECT count(*) FROM change_orders co WHERE co.project_id = p.id AND co.status = 'pending_review') AS pending_change_orders,
  (SELECT COALESCE(SUM(co.amount), 0) FROM change_orders co WHERE co.project_id = p.id AND co.status = 'approved') AS approved_co_amount,
  -- Daily log freshness
  (SELECT MAX(dl.log_date) FROM daily_logs dl WHERE dl.project_id = p.id) AS most_recent_daily_log,
  -- Incidents YTD
  (SELECT count(*) FROM incidents i WHERE i.project_id = p.id AND i.date >= date_trunc('year', CURRENT_DATE)) AS incidents_ytd,
  now() AS refreshed_at
FROM projects p;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phs_project_id ON project_health_summary(project_id);
CREATE INDEX IF NOT EXISTS idx_phs_org ON project_health_summary(organization_id);

-- 2. rfi_kpi_rollup ---------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS rfi_kpi_rollup CASCADE;
CREATE MATERIALIZED VIEW rfi_kpi_rollup AS
SELECT
  r.project_id,
  count(*) FILTER (WHERE r.status = 'open')                                                AS open_count,
  count(*) FILTER (WHERE r.status = 'under_review')                                        AS under_review_count,
  count(*) FILTER (WHERE r.status IN ('answered','closed'))                                AS resolved_count,
  count(*) FILTER (WHERE r.status = 'open' AND r.due_date < CURRENT_DATE)                  AS overdue_count,
  count(*) FILTER (WHERE r.priority = 'critical' AND r.status NOT IN ('answered','closed')) AS critical_open_count,
  AVG((r.closed_date - r.created_at::date)::numeric)
    FILTER (WHERE r.closed_date IS NOT NULL)                                               AS avg_response_days,
  now() AS refreshed_at
FROM rfis r
GROUP BY r.project_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rkr_project ON rfi_kpi_rollup(project_id);

-- 3. punch_list_status_rollup -----------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS punch_list_status_rollup CASCADE;
CREATE MATERIALIZED VIEW punch_list_status_rollup AS
SELECT
  pi.project_id,
  count(*)                                                              AS total,
  count(*) FILTER (WHERE pi.status = 'open')                            AS open_count,
  count(*) FILTER (WHERE pi.status = 'in_progress')                     AS in_progress_count,
  count(*) FILTER (WHERE pi.status = 'resolved')                        AS resolved_count,
  count(*) FILTER (WHERE pi.status = 'verified')                        AS verified_count,
  count(*) FILTER (WHERE pi.priority = 'critical')                      AS critical_count,
  count(*) FILTER (WHERE pi.due_date < CURRENT_DATE
                   AND pi.status NOT IN ('verified','resolved'))         AS overdue_count,
  now() AS refreshed_at
FROM punch_items pi
GROUP BY pi.project_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plr_project ON punch_list_status_rollup(project_id);

-- 4. pay_app_status_summary -------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS pay_app_status_summary CASCADE;
CREATE MATERIALIZED VIEW pay_app_status_summary AS
SELECT
  pa.project_id,
  count(*) FILTER (WHERE pa.status = 'draft')      AS draft_count,
  count(*) FILTER (WHERE pa.status = 'submitted')  AS submitted_count,
  count(*) FILTER (WHERE pa.status = 'certified')  AS certified_count,
  count(*) FILTER (WHERE pa.status = 'paid')       AS paid_count,
  COALESCE(SUM(pa.current_payment_due) FILTER (WHERE pa.status IN ('certified','submitted')), 0) AS pending_payment_due,
  COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'paid'), 0)                            AS total_paid,
  now() AS refreshed_at
FROM pay_applications pa
GROUP BY pa.project_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pass_project ON pay_app_status_summary(project_id);

-- ── Initial population so the views aren't empty until the first cron tick ─
REFRESH MATERIALIZED VIEW project_health_summary;
REFRESH MATERIALIZED VIEW rfi_kpi_rollup;
REFRESH MATERIALIZED VIEW punch_list_status_rollup;
REFRESH MATERIALIZED VIEW pay_app_status_summary;
