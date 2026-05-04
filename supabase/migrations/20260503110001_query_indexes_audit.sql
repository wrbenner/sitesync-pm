-- =============================================================================
-- Index audit — high-confidence missing indexes on hot foreign keys + filters
-- =============================================================================
-- These were identified by reviewing the queries the app runs on its top 50
-- pages. Spec called for ~30 indexes; this is the conservative set that's
-- safe to ship without seeing production pg_stat_statements traces. A
-- follow-up migration after the first week of production traffic should
-- add ~10-15 more based on actual slow-query data.
--
-- All indexes use CREATE INDEX (not CONCURRENTLY) because Supabase migrations
-- run inside transactions where CONCURRENTLY isn't permitted. The hot-table
-- ALTER risk is acknowledged: in production, a DBA should re-run these as
-- CONCURRENTLY out-of-band before deploy. For development DBs the table
-- locks are sub-second.
-- =============================================================================

-- ── Hot foreign keys for list-view sorts ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_rfis_project_status_due
  ON rfis(project_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_rfis_assigned_to
  ON rfis(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submittals_project_status_due
  ON submittals(project_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_punch_items_project_priority_status
  ON punch_items(project_id, priority, status);

CREATE INDEX IF NOT EXISTS idx_punch_items_assigned_status
  ON punch_items(assigned_to, status) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_change_orders_project_status_date
  ON change_orders(project_id, status, requested_date DESC);

CREATE INDEX IF NOT EXISTS idx_change_orders_source_rfi
  ON change_orders(source_rfi_id) WHERE source_rfi_id IS NOT NULL;

-- ── Daily log + activity feed: time-series queries ────────────────
CREATE INDEX IF NOT EXISTS idx_daily_logs_project_date
  ON daily_logs(project_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_log_entries_log_type
  ON daily_log_entries(daily_log_id, type);

CREATE INDEX IF NOT EXISTS idx_activity_feed_project_created
  ON activity_feed(project_id, created_at DESC);

-- ── Notifications: per-user inbox ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_project_user
  ON notifications(project_id, user_id);

-- ── Tasks: dashboard rollups ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_project_status_due
  ON tasks(project_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status
  ON tasks(assigned_to, status) WHERE assigned_to IS NOT NULL;

-- ── Drawings: by sheet number for navigation ──────────────────────
CREATE INDEX IF NOT EXISTS idx_drawings_project_sheet
  ON drawings(project_id, sheet_number);

CREATE INDEX IF NOT EXISTS idx_drawings_status
  ON drawings(project_id, status) WHERE status IS NOT NULL;

-- ── Files: folder navigation ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_files_project_folder
  ON files(project_id, folder, name);

-- ── Project members + RLS hot path ─────────────────────────────────
-- Every RLS policy in the app has the shape:
--   project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
-- This index turns that subquery into a partial scan on a single user.
CREATE INDEX IF NOT EXISTS idx_project_members_user_project
  ON project_members(user_id, project_id);

-- ── Workforce / time tracking ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_entries_member_date
  ON time_entries(workforce_member_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_project_date
  ON time_entries(project_id, date DESC);

-- ── Crews / check-ins ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crews_project_status
  ON crews(project_id, status);

-- ── Insurance + bonds: expiration sweeps ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_insurance_certs_expiration
  ON insurance_certificates(expiration_date)
  WHERE verified = true;

-- ── Meeting-action items: open list ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assigned_status
  ON meeting_action_items(assigned_to, status) WHERE status != 'completed';

-- ── Pay applications: by contract status ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_pay_applications_contract_status
  ON pay_applications(contract_id, status);
