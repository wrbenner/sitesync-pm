-- =============================================================================
-- 001_enable_rls.sql
-- Comprehensive RLS enforcement for all SiteSync data tables.
-- Idempotent: safe to run against a database that already has partial RLS.
-- Depends on has_project_permission() from 00032_permission_system.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- project_members: ensure table exists with full role set
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_members_role_check'
  ) THEN
    ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
      CHECK (role IN ('owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer', 'member'));
  END IF;
END $$;

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_members_select ON project_members;
CREATE POLICY project_members_select ON project_members FOR SELECT
  USING (user_id = (select auth.uid()) OR has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS project_members_insert ON project_members;
CREATE POLICY project_members_insert ON project_members FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'admin'));

DROP POLICY IF EXISTS project_members_update ON project_members;
CREATE POLICY project_members_update ON project_members FOR UPDATE
  USING (has_project_permission(project_id, 'admin'));

DROP POLICY IF EXISTS project_members_delete ON project_members;
CREATE POLICY project_members_delete ON project_members FOR DELETE
  USING (has_project_permission(project_id, 'admin'));

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select ON projects;
CREATE POLICY projects_select ON projects FOR SELECT
  USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()))
    OR owner_id = (select auth.uid())
  );

DROP POLICY IF EXISTS projects_insert ON projects;
CREATE POLICY projects_insert ON projects FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS projects_update ON projects;
CREATE POLICY projects_update ON projects FOR UPDATE
  USING (has_project_permission(id, 'admin'));

DROP POLICY IF EXISTS projects_delete ON projects;
CREATE POLICY projects_delete ON projects FOR DELETE
  USING (has_project_permission(id, 'owner'));

-- ---------------------------------------------------------------------------
-- rfis
-- ---------------------------------------------------------------------------

ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfis_select ON rfis;
CREATE POLICY rfis_select ON rfis FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS rfis_insert ON rfis;
CREATE POLICY rfis_insert ON rfis FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS rfis_update ON rfis;
CREATE POLICY rfis_update ON rfis FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS rfis_delete ON rfis;
CREATE POLICY rfis_delete ON rfis FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- submittals
-- ---------------------------------------------------------------------------

ALTER TABLE submittals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS submittals_select ON submittals;
CREATE POLICY submittals_select ON submittals FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS submittals_insert ON submittals;
CREATE POLICY submittals_insert ON submittals FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'subcontractor'));

DROP POLICY IF EXISTS submittals_update ON submittals;
CREATE POLICY submittals_update ON submittals FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS submittals_delete ON submittals;
CREATE POLICY submittals_delete ON submittals FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- change_orders
-- ---------------------------------------------------------------------------

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_orders_select ON change_orders;
CREATE POLICY change_orders_select ON change_orders FOR SELECT
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS change_orders_insert ON change_orders;
CREATE POLICY change_orders_insert ON change_orders FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS change_orders_update ON change_orders;
CREATE POLICY change_orders_update ON change_orders FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS change_orders_delete ON change_orders;
CREATE POLICY change_orders_delete ON change_orders FOR DELETE
  USING (has_project_permission(project_id, 'admin'));

-- ---------------------------------------------------------------------------
-- budget_items
-- ---------------------------------------------------------------------------

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_items_select ON budget_items;
CREATE POLICY budget_items_select ON budget_items FOR SELECT
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS budget_items_insert ON budget_items;
CREATE POLICY budget_items_insert ON budget_items FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS budget_items_update ON budget_items;
CREATE POLICY budget_items_update ON budget_items FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS budget_items_delete ON budget_items;
CREATE POLICY budget_items_delete ON budget_items FOR DELETE
  USING (has_project_permission(project_id, 'admin'));

-- ---------------------------------------------------------------------------
-- daily_logs
-- ---------------------------------------------------------------------------

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_logs_select ON daily_logs;
CREATE POLICY daily_logs_select ON daily_logs FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS daily_logs_insert ON daily_logs;
CREATE POLICY daily_logs_insert ON daily_logs FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS daily_logs_update ON daily_logs;
CREATE POLICY daily_logs_update ON daily_logs FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS daily_logs_delete ON daily_logs;
CREATE POLICY daily_logs_delete ON daily_logs FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- punch_items
-- ---------------------------------------------------------------------------

ALTER TABLE punch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS punch_items_select ON punch_items;
CREATE POLICY punch_items_select ON punch_items FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS punch_items_insert ON punch_items;
CREATE POLICY punch_items_insert ON punch_items FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS punch_items_update ON punch_items;
CREATE POLICY punch_items_update ON punch_items FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS punch_items_delete ON punch_items;
CREATE POLICY punch_items_delete ON punch_items FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_delete ON tasks FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- schedule_phases
-- ---------------------------------------------------------------------------

ALTER TABLE schedule_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_phases_select ON schedule_phases;
CREATE POLICY schedule_phases_select ON schedule_phases FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS schedule_phases_insert ON schedule_phases;
CREATE POLICY schedule_phases_insert ON schedule_phases FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS schedule_phases_update ON schedule_phases;
CREATE POLICY schedule_phases_update ON schedule_phases FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS schedule_phases_delete ON schedule_phases;
CREATE POLICY schedule_phases_delete ON schedule_phases FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- crews
-- ---------------------------------------------------------------------------

ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crews_select ON crews;
CREATE POLICY crews_select ON crews FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS crews_insert ON crews;
CREATE POLICY crews_insert ON crews FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS crews_update ON crews;
CREATE POLICY crews_update ON crews FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS crews_delete ON crews;
CREATE POLICY crews_delete ON crews FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- directory_contacts
-- ---------------------------------------------------------------------------

ALTER TABLE directory_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS directory_contacts_select ON directory_contacts;
CREATE POLICY directory_contacts_select ON directory_contacts FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS directory_contacts_insert ON directory_contacts;
CREATE POLICY directory_contacts_insert ON directory_contacts FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS directory_contacts_update ON directory_contacts;
CREATE POLICY directory_contacts_update ON directory_contacts FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS directory_contacts_delete ON directory_contacts;
CREATE POLICY directory_contacts_delete ON directory_contacts FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------------

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_select ON meetings;
CREATE POLICY meetings_select ON meetings FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS meetings_insert ON meetings;
CREATE POLICY meetings_insert ON meetings FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS meetings_update ON meetings;
CREATE POLICY meetings_update ON meetings FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS meetings_delete ON meetings;
CREATE POLICY meetings_delete ON meetings FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- files
-- ---------------------------------------------------------------------------

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS files_select ON files;
CREATE POLICY files_select ON files FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS files_insert ON files;
CREATE POLICY files_insert ON files FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS files_update ON files;
CREATE POLICY files_update ON files FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS files_delete ON files;
CREATE POLICY files_delete ON files FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- drawings
-- ---------------------------------------------------------------------------

ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drawings_select ON drawings;
CREATE POLICY drawings_select ON drawings FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS drawings_insert ON drawings;
CREATE POLICY drawings_insert ON drawings FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS drawings_update ON drawings;
CREATE POLICY drawings_update ON drawings FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

DROP POLICY IF EXISTS drawings_delete ON drawings;
CREATE POLICY drawings_delete ON drawings FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- field_captures
-- ---------------------------------------------------------------------------

ALTER TABLE field_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_captures_select ON field_captures;
CREATE POLICY field_captures_select ON field_captures FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS field_captures_insert ON field_captures;
CREATE POLICY field_captures_insert ON field_captures FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS field_captures_update ON field_captures;
CREATE POLICY field_captures_update ON field_captures FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS field_captures_delete ON field_captures;
CREATE POLICY field_captures_delete ON field_captures FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- activity_feed
-- ---------------------------------------------------------------------------

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_feed_select ON activity_feed;
CREATE POLICY activity_feed_select ON activity_feed FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS activity_feed_insert ON activity_feed;
CREATE POLICY activity_feed_insert ON activity_feed FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'viewer'));

-- activity_feed rows are append only; no UPDATE or DELETE policies

-- ---------------------------------------------------------------------------
-- ai_insights
-- ---------------------------------------------------------------------------

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_insights_select ON ai_insights;
CREATE POLICY ai_insights_select ON ai_insights FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

DROP POLICY IF EXISTS ai_insights_insert ON ai_insights;
CREATE POLICY ai_insights_insert ON ai_insights FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS ai_insights_update ON ai_insights;
CREATE POLICY ai_insights_update ON ai_insights FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

DROP POLICY IF EXISTS ai_insights_delete ON ai_insights;
CREATE POLICY ai_insights_delete ON ai_insights FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- Indexes for RLS performance (project_members is queried on every policy check)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_project_members_user_project
  ON project_members(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project_user
  ON project_members(project_id, user_id);
