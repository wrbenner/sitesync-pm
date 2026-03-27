-- SiteSync AI: Initial Database Schema
-- Run this in the Supabase SQL Editor to set up all tables and RLS policies.

-- ============================================
-- 1. COMPANIES
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'project_manager' CHECK (role IN ('company_admin', 'project_manager', 'superintendent', 'engineer', 'subcontractor', 'viewer')),
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 3. PROJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  project_type TEXT,
  total_value NUMERIC(15,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed')),
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  start_date DATE,
  scheduled_end_date DATE,
  actual_end_date DATE,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. PROJECT MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('project_manager', 'superintendent', 'engineer', 'subcontractor', 'viewer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(project_id, user_id)
);

-- ============================================
-- 5. INVITATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'project_manager',
  invited_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. RFIs
-- ============================================
CREATE TABLE IF NOT EXISTS rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rfi_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'responded', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  due_date DATE,
  ball_in_court_id UUID REFERENCES profiles(id),
  linked_drawing_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfi_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  response_text TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 7. SUBMITTALS
-- ============================================
CREATE TABLE IF NOT EXISTS submittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submittal_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  spec_section TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revise_resubmit')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  due_date DATE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submittal_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID NOT NULL REFERENCES submittals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  review_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revise')),
  reviewed_at TIMESTAMPTZ,
  comments TEXT
);

-- ============================================
-- 8. BUDGET
-- ============================================
CREATE TABLE IF NOT EXISTS budget_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  budgeted_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  spent NUMERIC(15,2) NOT NULL DEFAULT 0,
  committed NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES budget_divisions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost_code TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'LS',
  unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  co_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 9. DAILY LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weather_condition TEXT,
  temperature NUMERIC(5,1),
  wind TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  signature_url TEXT,
  ai_narrative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, log_date)
);

CREATE TABLE IF NOT EXISTS daily_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('manpower', 'equipment', 'incident', 'note', 'photo')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 10. DRAWINGS
-- ============================================
CREATE TABLE IF NOT EXISTS drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  set_number TEXT NOT NULL,
  title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  current_revision TEXT NOT NULL DEFAULT 'A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drawing_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  sheet_number TEXT NOT NULL,
  title TEXT NOT NULL,
  file_id UUID,
  revision TEXT NOT NULL DEFAULT 'A',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drawing_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES drawing_sheets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  markup_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 11. PUNCH LIST
-- ============================================
CREATE TABLE IF NOT EXISTS punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_number SERIAL,
  description TEXT NOT NULL,
  area TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'complete', 'verified')),
  due_date DATE,
  photos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 12. FILES
-- ============================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  folder_path TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 13. MEETINGS
-- ============================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL DEFAULT 'general' CHECK (meeting_type IN ('oac', 'safety', 'coordination', 'general')),
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  location TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  UNIQUE(meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed'))
);

-- ============================================
-- 14. CREWS
-- ============================================
CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  foreman_id UUID REFERENCES profiles(id),
  trade TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'standby', 'off_site')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 15. ACTIVITY LOG
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 16. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rfis_project ON rfis(project_id);
CREATE INDEX IF NOT EXISTS idx_rfis_assigned ON rfis(assigned_to);
CREATE INDEX IF NOT EXISTS idx_submittals_project ON submittals(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_divisions_project ON budget_divisions(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_project ON daily_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_drawings_project ON drawings(project_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_project ON punch_list_items(project_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = false;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfi_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE submittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE submittal_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_markups ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's company_id
CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user is a member of a project
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES: Users can read profiles in their company, update their own
CREATE POLICY profiles_select ON profiles FOR SELECT USING (company_id = auth_company_id() OR id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- COMPANIES: Users can read their own company, admins can update
CREATE POLICY companies_select ON companies FOR SELECT USING (id = auth_company_id());
CREATE POLICY companies_update ON companies FOR UPDATE USING (
  id = auth_company_id() AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'company_admin')
);
CREATE POLICY companies_insert ON companies FOR INSERT WITH CHECK (true);

-- PROJECTS: Company members can read, admins and PMs can create/update
CREATE POLICY projects_select ON projects FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY projects_update ON projects FOR UPDATE USING (company_id = auth_company_id());

-- PROJECT_MEMBERS: Accessible to project members and company admins
CREATE POLICY project_members_select ON project_members FOR SELECT USING (
  is_project_member(project_id) OR EXISTS (
    SELECT 1 FROM projects WHERE id = project_id AND company_id = auth_company_id()
  )
);
CREATE POLICY project_members_insert ON project_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE id = project_id AND company_id = auth_company_id())
);
CREATE POLICY project_members_delete ON project_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE id = project_id AND company_id = auth_company_id())
);

-- INVITATIONS: Company admins can manage
CREATE POLICY invitations_select ON invitations FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY invitations_insert ON invitations FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY invitations_update ON invitations FOR UPDATE USING (company_id = auth_company_id());

-- PROJECT-SCOPED DATA: all project data is accessible to project members
-- RFIs
CREATE POLICY rfis_select ON rfis FOR SELECT USING (is_project_member(project_id));
CREATE POLICY rfis_insert ON rfis FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY rfis_update ON rfis FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY rfi_responses_select ON rfi_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM rfis WHERE id = rfi_id AND is_project_member(project_id))
);
CREATE POLICY rfi_responses_insert ON rfi_responses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM rfis WHERE id = rfi_id AND is_project_member(project_id))
);

-- Submittals
CREATE POLICY submittals_select ON submittals FOR SELECT USING (is_project_member(project_id));
CREATE POLICY submittals_insert ON submittals FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY submittals_update ON submittals FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY submittal_reviewers_select ON submittal_reviewers FOR SELECT USING (
  EXISTS (SELECT 1 FROM submittals WHERE id = submittal_id AND is_project_member(project_id))
);
CREATE POLICY submittal_reviewers_insert ON submittal_reviewers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM submittals WHERE id = submittal_id AND is_project_member(project_id))
);
CREATE POLICY submittal_reviewers_update ON submittal_reviewers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM submittals WHERE id = submittal_id AND is_project_member(project_id))
);

-- Budget
CREATE POLICY budget_divisions_select ON budget_divisions FOR SELECT USING (is_project_member(project_id));
CREATE POLICY budget_divisions_insert ON budget_divisions FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY budget_divisions_update ON budget_divisions FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY budget_line_items_select ON budget_line_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM budget_divisions WHERE id = division_id AND is_project_member(project_id))
);
CREATE POLICY budget_line_items_insert ON budget_line_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM budget_divisions WHERE id = division_id AND is_project_member(project_id))
);
CREATE POLICY budget_line_items_update ON budget_line_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM budget_divisions WHERE id = division_id AND is_project_member(project_id))
);
CREATE POLICY change_orders_select ON change_orders FOR SELECT USING (is_project_member(project_id));
CREATE POLICY change_orders_insert ON change_orders FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY change_orders_update ON change_orders FOR UPDATE USING (is_project_member(project_id));

-- Daily Logs
CREATE POLICY daily_logs_select ON daily_logs FOR SELECT USING (is_project_member(project_id));
CREATE POLICY daily_logs_insert ON daily_logs FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY daily_logs_update ON daily_logs FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY daily_log_entries_select ON daily_log_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM daily_logs WHERE id = daily_log_id AND is_project_member(project_id))
);
CREATE POLICY daily_log_entries_insert ON daily_log_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM daily_logs WHERE id = daily_log_id AND is_project_member(project_id))
);

-- Drawings
CREATE POLICY drawings_select ON drawings FOR SELECT USING (is_project_member(project_id));
CREATE POLICY drawings_insert ON drawings FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY drawings_update ON drawings FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY drawing_sheets_select ON drawing_sheets FOR SELECT USING (
  EXISTS (SELECT 1 FROM drawings WHERE id = drawing_id AND is_project_member(project_id))
);
CREATE POLICY drawing_sheets_insert ON drawing_sheets FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM drawings WHERE id = drawing_id AND is_project_member(project_id))
);
CREATE POLICY drawing_markups_select ON drawing_markups FOR SELECT USING (
  EXISTS (SELECT 1 FROM drawing_sheets ds JOIN drawings d ON ds.drawing_id = d.id WHERE ds.id = sheet_id AND is_project_member(d.project_id))
);
CREATE POLICY drawing_markups_insert ON drawing_markups FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM drawing_sheets ds JOIN drawings d ON ds.drawing_id = d.id WHERE ds.id = sheet_id AND is_project_member(d.project_id))
);

-- Punch List
CREATE POLICY punch_items_select ON punch_list_items FOR SELECT USING (is_project_member(project_id));
CREATE POLICY punch_items_insert ON punch_list_items FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY punch_items_update ON punch_list_items FOR UPDATE USING (is_project_member(project_id));

-- Files
CREATE POLICY files_select ON files FOR SELECT USING (is_project_member(project_id));
CREATE POLICY files_insert ON files FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY files_update ON files FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY file_versions_select ON file_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM files WHERE id = file_id AND is_project_member(project_id))
);
CREATE POLICY file_versions_insert ON file_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM files WHERE id = file_id AND is_project_member(project_id))
);

-- Meetings
CREATE POLICY meetings_select ON meetings FOR SELECT USING (is_project_member(project_id));
CREATE POLICY meetings_insert ON meetings FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY meetings_update ON meetings FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY meeting_attendees_select ON meeting_attendees FOR SELECT USING (
  EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND is_project_member(project_id))
);
CREATE POLICY meeting_attendees_insert ON meeting_attendees FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND is_project_member(project_id))
);
CREATE POLICY action_items_select ON action_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND is_project_member(project_id))
);
CREATE POLICY action_items_insert ON action_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND is_project_member(project_id))
);
CREATE POLICY action_items_update ON action_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND is_project_member(project_id))
);

-- Crews
CREATE POLICY crews_select ON crews FOR SELECT USING (is_project_member(project_id));
CREATE POLICY crews_insert ON crews FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY crews_update ON crews FOR UPDATE USING (is_project_member(project_id));

-- Activity Log
CREATE POLICY activity_log_select ON activity_log FOR SELECT USING (is_project_member(project_id));
CREATE POLICY activity_log_insert ON activity_log FOR INSERT WITH CHECK (is_project_member(project_id));

-- Notifications: Users can only see their own
CREATE POLICY notifications_select ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Run these in the Supabase dashboard or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('drawings', 'drawings', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'companies', 'profiles', 'projects', 'rfis', 'submittals',
      'change_orders', 'daily_logs', 'drawings', 'punch_list_items'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END;
$$;
