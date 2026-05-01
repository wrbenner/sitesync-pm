-- =============================================================================
-- view_refresh_metadata — track materialized view freshness
-- =============================================================================
-- Centralized table for the refresh-materialized-views edge function to
-- record when each view was last successfully refreshed (and how long it
-- took). The UI's stale-data banner reads from this. The watcher alerts
-- when last_refresh_started_at is more than 30 min ago AND the view's
-- refreshed_at column is older than the heartbeat — that distinguishes
-- "cron didn't run" from "refresh ran but failed".
-- =============================================================================

CREATE TABLE IF NOT EXISTS view_refresh_metadata (
  view_name           text PRIMARY KEY,
  last_refresh_started_at  timestamptz,
  last_refresh_completed_at timestamptz,
  last_refresh_status text CHECK (last_refresh_status IN ('success','running','failed','unknown')),
  last_refresh_duration_ms integer,
  last_error          text,
  /** Target refresh interval in seconds. Watcher uses this for the
   *  "stale > 6× target" alert. */
  target_interval_seconds int NOT NULL DEFAULT 300,  -- 5 min
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO view_refresh_metadata (view_name, last_refresh_status, target_interval_seconds)
VALUES
  ('project_health_summary',  'unknown', 300),
  ('rfi_kpi_rollup',          'unknown', 300),
  ('punch_list_status_rollup','unknown', 300),
  ('pay_app_status_summary',  'unknown', 300)
ON CONFLICT DO NOTHING;

-- Helper: caller-friendly view that joins the refresh metadata to the views'
-- own refreshed_at columns, returning a single "freshness" view the UI uses.
CREATE OR REPLACE FUNCTION view_freshness_status()
RETURNS TABLE(
  view_name text,
  refreshed_at timestamptz,
  status text,
  age_seconds bigint,
  is_stale boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT v.view_name,
         CASE v.view_name
           WHEN 'project_health_summary' THEN (SELECT MAX(refreshed_at) FROM project_health_summary)
           WHEN 'rfi_kpi_rollup' THEN (SELECT MAX(refreshed_at) FROM rfi_kpi_rollup)
           WHEN 'punch_list_status_rollup' THEN (SELECT MAX(refreshed_at) FROM punch_list_status_rollup)
           WHEN 'pay_app_status_summary' THEN (SELECT MAX(refreshed_at) FROM pay_app_status_summary)
           ELSE NULL
         END AS refreshed_at,
         v.last_refresh_status AS status,
         EXTRACT(epoch FROM (now() - v.last_refresh_completed_at))::bigint AS age_seconds,
         (v.last_refresh_completed_at IS NULL OR
          now() - v.last_refresh_completed_at > make_interval(secs => v.target_interval_seconds * 6)) AS is_stale
    FROM view_refresh_metadata v;
$$;
