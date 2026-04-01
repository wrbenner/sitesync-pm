-- Project Membership RLS SELECT Enforcement
-- Replaces SELECT policies on all sensitive project-scoped tables with an
-- explicit membership subquery: project_id IN (SELECT project_id FROM
-- project_members WHERE user_id = auth.uid()).
-- This makes the membership check transparent and independent of
-- has_project_permission(), which may be bypassed by role changes.

-- ── rfis ─────────────────────────────────────────────────

DROP POLICY IF EXISTS rfis_select ON rfis;
CREATE POLICY rfis_select ON rfis FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── submittals ───────────────────────────────────────────

DROP POLICY IF EXISTS submittals_select ON submittals;
CREATE POLICY submittals_select ON submittals FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── budget_items ─────────────────────────────────────────

DROP POLICY IF EXISTS budget_items_select ON budget_items;
CREATE POLICY budget_items_select ON budget_items FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── change_orders ────────────────────────────────────────

DROP POLICY IF EXISTS change_orders_select ON change_orders;
CREATE POLICY change_orders_select ON change_orders FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── daily_logs ───────────────────────────────────────────

DROP POLICY IF EXISTS daily_logs_select ON daily_logs;
CREATE POLICY daily_logs_select ON daily_logs FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── field_captures ───────────────────────────────────────

DROP POLICY IF EXISTS field_captures_select ON field_captures;
CREATE POLICY field_captures_select ON field_captures FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── punch_items ──────────────────────────────────────────

DROP POLICY IF EXISTS punch_items_select ON punch_items;
CREATE POLICY punch_items_select ON punch_items FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── crews ────────────────────────────────────────────────

DROP POLICY IF EXISTS crews_select ON crews;
CREATE POLICY crews_select ON crews FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── directory_contacts ───────────────────────────────────

DROP POLICY IF EXISTS directory_contacts_select ON directory_contacts;
CREATE POLICY directory_contacts_select ON directory_contacts FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── meetings ─────────────────────────────────────────────

DROP POLICY IF EXISTS meetings_select ON meetings;
CREATE POLICY meetings_select ON meetings FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── schedule_phases ──────────────────────────────────────

DROP POLICY IF EXISTS schedule_phases_select ON schedule_phases;
CREATE POLICY schedule_phases_select ON schedule_phases FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── drawings ─────────────────────────────────────────────

DROP POLICY IF EXISTS drawings_select ON drawings;
CREATE POLICY drawings_select ON drawings FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── files ────────────────────────────────────────────────

DROP POLICY IF EXISTS files_select ON files;
CREATE POLICY files_select ON files FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── activity_feed ────────────────────────────────────────

DROP POLICY IF EXISTS activity_feed_select ON activity_feed;
CREATE POLICY activity_feed_select ON activity_feed FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- ── audit_log ────────────────────────────────────────────

DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));
