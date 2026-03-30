-- RLS Permission Enforcement
-- Applies has_project_permission() to UPDATE and DELETE on ALL entity tables.
-- Previously only SELECT policies existed. A viewer could modify any row.

-- ── RFIs ─────────────────────────────────────────────────

DROP POLICY IF EXISTS rfis_update ON rfis;
CREATE POLICY rfis_update ON rfis FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS rfis_delete ON rfis;
CREATE POLICY rfis_delete ON rfis FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS rfis_insert ON rfis;
CREATE POLICY rfis_insert ON rfis FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

-- ── Submittals ───────────────────────────────────────────

DROP POLICY IF EXISTS submittals_update ON submittals;
CREATE POLICY submittals_update ON submittals FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS submittals_delete ON submittals;
CREATE POLICY submittals_delete ON submittals FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS submittals_insert ON submittals;
CREATE POLICY submittals_insert ON submittals FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'subcontractor'));

-- ── Tasks ────────────────────────────────────────────────

DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_delete ON tasks FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

-- ── Punch Items ──────────────────────────────────────────

DROP POLICY IF EXISTS punch_items_update ON punch_items;
CREATE POLICY punch_items_update ON punch_items FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS punch_items_delete ON punch_items;
CREATE POLICY punch_items_delete ON punch_items FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS punch_items_insert ON punch_items;
CREATE POLICY punch_items_insert ON punch_items FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

-- ── Daily Logs ───────────────────────────────────────────

DROP POLICY IF EXISTS daily_logs_update ON daily_logs;
CREATE POLICY daily_logs_update ON daily_logs FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS daily_logs_delete ON daily_logs;
CREATE POLICY daily_logs_delete ON daily_logs FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS daily_logs_insert ON daily_logs;
CREATE POLICY daily_logs_insert ON daily_logs FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

-- ── Change Orders ────────────────────────────────────────

DROP POLICY IF EXISTS change_orders_update ON change_orders;
CREATE POLICY change_orders_update ON change_orders FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS change_orders_delete ON change_orders;
CREATE POLICY change_orders_delete ON change_orders FOR DELETE
  USING (has_project_permission(project_id, 'admin'));

DROP POLICY IF EXISTS change_orders_insert ON change_orders;
CREATE POLICY change_orders_insert ON change_orders FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

-- ── Budget Items ─────────────────────────────────────────

DROP POLICY IF EXISTS budget_items_update ON budget_items;
CREATE POLICY budget_items_update ON budget_items FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS budget_items_delete ON budget_items;
CREATE POLICY budget_items_delete ON budget_items FOR DELETE
  USING (has_project_permission(project_id, 'admin'));

DROP POLICY IF EXISTS budget_items_insert ON budget_items;
CREATE POLICY budget_items_insert ON budget_items FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

-- ── Meetings ─────────────────────────────────────────────

DROP POLICY IF EXISTS meetings_update ON meetings;
CREATE POLICY meetings_update ON meetings FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS meetings_delete ON meetings;
CREATE POLICY meetings_delete ON meetings FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS meetings_insert ON meetings;
CREATE POLICY meetings_insert ON meetings FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

-- ── Files ────────────────────────────────────────────────

DROP POLICY IF EXISTS files_update ON files;
CREATE POLICY files_update ON files FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS files_delete ON files;
CREATE POLICY files_delete ON files FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS files_insert ON files;
CREATE POLICY files_insert ON files FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

-- ── Crews ────────────────────────────────────────────────

DROP POLICY IF EXISTS crews_update ON crews;
CREATE POLICY crews_update ON crews FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS crews_delete ON crews;
CREATE POLICY crews_delete ON crews FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS crews_insert ON crews;
CREATE POLICY crews_insert ON crews FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

-- ── Drawings ─────────────────────────────────────────────

DROP POLICY IF EXISTS drawings_update ON drawings;
CREATE POLICY drawings_update ON drawings FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS drawings_delete ON drawings;
CREATE POLICY drawings_delete ON drawings FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS drawings_insert ON drawings;
CREATE POLICY drawings_insert ON drawings FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

-- ── Safety (Incidents, Inspections, Corrective Actions) ──

DROP POLICY IF EXISTS safety_incidents_update ON safety_incidents;
CREATE POLICY safety_incidents_update ON safety_incidents FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS safety_incidents_insert ON safety_incidents;
CREATE POLICY safety_incidents_insert ON safety_incidents FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS safety_inspections_update ON safety_inspections;
CREATE POLICY safety_inspections_update ON safety_inspections FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS safety_inspections_insert ON safety_inspections;
CREATE POLICY safety_inspections_insert ON safety_inspections FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS corrective_actions_update ON corrective_actions;
CREATE POLICY corrective_actions_update ON corrective_actions FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS corrective_actions_insert ON corrective_actions;
CREATE POLICY corrective_actions_insert ON corrective_actions FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));
