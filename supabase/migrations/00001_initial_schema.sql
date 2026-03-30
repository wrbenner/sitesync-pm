-- =============================================================================
-- SiteSync AI: Initial Database Schema
-- Construction Project Management Platform
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Projects
CREATE TABLE projects (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    address     text,
    city        text,
    state       text,
    zip         text,
    owner_id    uuid REFERENCES auth.users,
    general_contractor text,
    contract_value     numeric,
    start_date         date,
    target_completion  date,
    status      text DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- Project members (join table for user access)
CREATE TABLE project_members (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users,
    role        text NOT NULL
                CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    company     text,
    trade       text,
    invited_at  timestamptz DEFAULT now(),
    accepted_at timestamptz,
    UNIQUE (project_id, user_id)
);

-- RFIs (Requests for Information)
CREATE TABLE rfis (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    number            serial,
    title             text NOT NULL,
    description       text,
    priority          text CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status            text DEFAULT 'open'
                      CHECK (status IN ('open', 'under_review', 'answered', 'closed')),
    created_by        uuid REFERENCES auth.users,
    assigned_to       uuid REFERENCES auth.users,
    ball_in_court     uuid REFERENCES auth.users,
    drawing_reference text,
    due_date          date,
    closed_date       date,
    created_at        timestamptz DEFAULT now(),
    updated_at        timestamptz DEFAULT now()
);

-- RFI responses
CREATE TABLE rfi_responses (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rfi_id      uuid NOT NULL REFERENCES rfis ON DELETE CASCADE,
    author_id   uuid REFERENCES auth.users,
    content     text NOT NULL,
    attachments jsonb DEFAULT '[]',
    created_at  timestamptz DEFAULT now()
);

-- Submittals
CREATE TABLE submittals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    number           serial,
    title            text NOT NULL,
    spec_section     text,
    subcontractor    text,
    status           text DEFAULT 'pending'
                     CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'resubmit')),
    revision_number  int DEFAULT 1,
    lead_time_weeks  int,
    submitted_date   date,
    due_date         date,
    approved_date    date,
    created_by       uuid REFERENCES auth.users,
    assigned_to      uuid REFERENCES auth.users,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- Submittal approvals
CREATE TABLE submittal_approvals (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submittal_id uuid NOT NULL REFERENCES submittals ON DELETE CASCADE,
    approver_id  uuid REFERENCES auth.users,
    role         text,
    status       text DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
    comments     text,
    reviewed_at  timestamptz
);

-- Punch list items
CREATE TABLE punch_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    number        serial,
    title         text NOT NULL,
    description   text,
    location      text,
    floor         text,
    area          text,
    trade         text,
    priority      text CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status        text DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'resolved', 'verified')),
    assigned_to   uuid REFERENCES auth.users,
    reported_by   uuid REFERENCES auth.users,
    due_date      date,
    resolved_date date,
    verified_date date,
    photos        jsonb DEFAULT '[]',
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    title            text NOT NULL,
    description      text,
    status           text DEFAULT 'todo'
                     CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
    priority         text CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assigned_to      uuid REFERENCES auth.users,
    due_date         date,
    is_critical_path boolean DEFAULT false,
    sort_order       int,
    parent_task_id   uuid REFERENCES tasks,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- Drawings
CREATE TABLE drawings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    title               text NOT NULL,
    discipline          text CHECK (discipline IN (
                            'architectural', 'structural', 'mechanical', 'electrical',
                            'plumbing', 'civil', 'fire_protection', 'landscape', 'interior'
                        )),
    sheet_number        text,
    revision            text,
    file_url            text,
    uploaded_by         uuid REFERENCES auth.users,
    ai_changes_detected int DEFAULT 0,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Daily logs
CREATE TABLE daily_logs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    log_date         date NOT NULL,
    weather          text,
    temperature_high int,
    temperature_low  int,
    workers_onsite   int,
    total_hours      numeric,
    incidents        int DEFAULT 0,
    summary          text,
    ai_summary       text,
    approved         boolean DEFAULT false,
    approved_by      uuid REFERENCES auth.users,
    approved_at      timestamptz,
    created_by       uuid REFERENCES auth.users,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- Daily log entries (line items within a daily log)
CREATE TABLE daily_log_entries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_log_id    uuid NOT NULL REFERENCES daily_logs ON DELETE CASCADE,
    type            text CHECK (type IN ('manpower', 'equipment', 'incident', 'note')),
    trade           text,
    headcount       int,
    hours           numeric,
    equipment_name  text,
    equipment_hours numeric,
    description     text,
    created_at      timestamptz DEFAULT now()
);

-- Crews
CREATE TABLE crews (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name               text NOT NULL,
    lead_id            uuid REFERENCES auth.users,
    trade              text,
    size               int,
    current_task       text,
    location           text,
    productivity_score numeric,
    status             text DEFAULT 'active'
                       CHECK (status IN ('active', 'idle', 'behind')),
    certifications     jsonb DEFAULT '[]',
    created_at         timestamptz DEFAULT now(),
    updated_at         timestamptz DEFAULT now()
);

-- Budget items
CREATE TABLE budget_items (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    division         text NOT NULL,
    description      text,
    original_amount  numeric,
    committed_amount numeric,
    actual_amount    numeric,
    forecast_amount  numeric,
    percent_complete numeric,
    status           text DEFAULT 'on_track'
                     CHECK (status IN ('on_track', 'at_risk', 'over_budget')),
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- Change orders
CREATE TABLE change_orders (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    number         serial,
    description    text NOT NULL,
    amount         numeric,
    status         text DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by   text,
    requested_date date,
    approved_date  date,
    created_at     timestamptz DEFAULT now(),
    updated_at     timestamptz DEFAULT now()
);

-- Meetings
CREATE TABLE meetings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    title            text NOT NULL,
    type             text CHECK (type IN (
                        'oac', 'subcontractor', 'safety', 'coordination', 'progress'
                     )),
    date             timestamptz,
    location         text,
    duration_minutes int,
    notes            text,
    agenda           text,
    created_by       uuid REFERENCES auth.users,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- Meeting attendees
CREATE TABLE meeting_attendees (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL REFERENCES meetings ON DELETE CASCADE,
    user_id    uuid REFERENCES auth.users,
    attended   boolean DEFAULT false
);

-- Meeting action items
CREATE TABLE meeting_action_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id   uuid NOT NULL REFERENCES meetings ON DELETE CASCADE,
    description  text NOT NULL,
    assigned_to  uuid REFERENCES auth.users,
    due_date     date,
    status       text DEFAULT 'open'
                 CHECK (status IN ('open', 'completed', 'overdue')),
    completed_at timestamptz
);

-- Directory contacts
CREATE TABLE directory_contacts (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name                  text NOT NULL,
    company               text,
    role                  text,
    trade                 text,
    email                 text,
    phone                 text,
    address               text,
    avg_rfi_response_days numeric,
    created_at            timestamptz DEFAULT now()
);

-- Files
CREATE TABLE files (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name                text NOT NULL,
    folder              text,
    file_url            text NOT NULL,
    file_size           bigint,
    content_type        text,
    uploaded_by         uuid REFERENCES auth.users,
    version             int DEFAULT 1,
    previous_version_id uuid REFERENCES files,
    created_at          timestamptz DEFAULT now()
);

-- Field captures (photos, voice memos, text notes from the field)
CREATE TABLE field_captures (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    type               text CHECK (type IN ('photo', 'voice', 'text')),
    content            text,
    file_url           text,
    location           text,
    ai_category        text,
    ai_tags            jsonb DEFAULT '[]',
    linked_drawing_id  uuid REFERENCES drawings,
    created_by         uuid REFERENCES auth.users,
    created_at         timestamptz DEFAULT now()
);

-- Schedule phases
CREATE TABLE schedule_phases (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name             text NOT NULL,
    start_date       date,
    end_date         date,
    percent_complete numeric DEFAULT 0,
    status           text DEFAULT 'upcoming'
                     CHECK (status IN ('completed', 'active', 'upcoming', 'at_risk', 'delayed')),
    depends_on       uuid REFERENCES schedule_phases,
    is_critical_path boolean DEFAULT false,
    assigned_crew_id uuid REFERENCES crews,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users,
    project_id uuid REFERENCES projects ON DELETE CASCADE,
    type       text CHECK (type IN (
                   'rfi_assigned', 'submittal_review', 'punch_item',
                   'task_update', 'meeting_reminder', 'ai_alert',
                   'daily_log_approval'
               )),
    title      text NOT NULL,
    body       text,
    link       text,
    read       boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Activity feed
CREATE TABLE activity_feed (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    user_id    uuid REFERENCES auth.users,
    type       text CHECK (type IN (
                   'rfi_created', 'submittal_updated', 'task_moved',
                   'file_uploaded', 'daily_log_approved', 'punch_resolved',
                   'comment_added', 'change_order_submitted', 'meeting_scheduled'
               )),
    title      text NOT NULL,
    body       text,
    metadata   jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- AI insights
CREATE TABLE ai_insights (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    page             text NOT NULL,
    severity         text CHECK (severity IN ('info', 'warning', 'critical')),
    message          text NOT NULL,
    expanded_content text,
    action_label     text,
    action_link      text,
    dismissed        boolean DEFAULT false,
    created_at       timestamptz DEFAULT now()
);

-- Project snapshots (point in time data captures for reporting)
CREATE TABLE project_snapshots (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    data          jsonb NOT NULL,
    key_events    jsonb DEFAULT '[]',
    created_at    timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- RFIs
CREATE INDEX idx_rfis_project_id  ON rfis (project_id);
CREATE INDEX idx_rfis_status      ON rfis (status);
CREATE INDEX idx_rfis_assigned_to ON rfis (assigned_to);
CREATE INDEX idx_rfis_created_at  ON rfis (created_at);

-- Submittals
CREATE INDEX idx_submittals_project_id ON submittals (project_id);
CREATE INDEX idx_submittals_status     ON submittals (status);
CREATE INDEX idx_submittals_due_date   ON submittals (due_date);

-- Punch items
CREATE INDEX idx_punch_items_project_id  ON punch_items (project_id);
CREATE INDEX idx_punch_items_status      ON punch_items (status);
CREATE INDEX idx_punch_items_assigned_to ON punch_items (assigned_to);

-- Tasks
CREATE INDEX idx_tasks_project_id  ON tasks (project_id);
CREATE INDEX idx_tasks_status      ON tasks (status);
CREATE INDEX idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX idx_tasks_due_date    ON tasks (due_date);

-- Activity feed
CREATE INDEX idx_activity_feed_project_id ON activity_feed (project_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed (created_at);

-- Notifications
CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_read       ON notifications (read);
CREATE INDEX idx_notifications_created_at ON notifications (created_at);

-- Daily logs
CREATE INDEX idx_daily_logs_project_id ON daily_logs (project_id);
CREATE INDEX idx_daily_logs_log_date   ON daily_logs (log_date);

-- Files
CREATE INDEX idx_files_project_id ON files (project_id);
CREATE INDEX idx_files_folder     ON files (folder);

-- Schedule phases
CREATE INDEX idx_schedule_phases_project_id ON schedule_phases (project_id);

-- Meetings
CREATE INDEX idx_meetings_project_id ON meetings (project_id);
CREATE INDEX idx_meetings_date       ON meetings (date);

-- Project members (foreign keys)
CREATE INDEX idx_project_members_project_id ON project_members (project_id);
CREATE INDEX idx_project_members_user_id    ON project_members (user_id);

-- RFI responses
CREATE INDEX idx_rfi_responses_rfi_id ON rfi_responses (rfi_id);

-- Submittal approvals
CREATE INDEX idx_submittal_approvals_submittal_id ON submittal_approvals (submittal_id);

-- Daily log entries
CREATE INDEX idx_daily_log_entries_daily_log_id ON daily_log_entries (daily_log_id);

-- Meeting attendees / action items
CREATE INDEX idx_meeting_attendees_meeting_id    ON meeting_attendees (meeting_id);
CREATE INDEX idx_meeting_action_items_meeting_id ON meeting_action_items (meeting_id);

-- Drawings
CREATE INDEX idx_drawings_project_id ON drawings (project_id);

-- Crews
CREATE INDEX idx_crews_project_id ON crews (project_id);

-- Budget items
CREATE INDEX idx_budget_items_project_id ON budget_items (project_id);

-- Change orders
CREATE INDEX idx_change_orders_project_id ON change_orders (project_id);

-- Field captures
CREATE INDEX idx_field_captures_project_id ON field_captures (project_id);

-- Directory contacts
CREATE INDEX idx_directory_contacts_project_id ON directory_contacts (project_id);

-- AI insights
CREATE INDEX idx_ai_insights_project_id ON ai_insights (project_id);

-- Project snapshots
CREATE INDEX idx_project_snapshots_project_id    ON project_snapshots (project_id);
CREATE INDEX idx_project_snapshots_snapshot_date ON project_snapshots (snapshot_date);

-- ---------------------------------------------------------------------------
-- 4. Updated_at trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to every table that carries an updated_at column
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_rfis_updated_at
    BEFORE UPDATE ON rfis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_submittals_updated_at
    BEFORE UPDATE ON submittals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_punch_items_updated_at
    BEFORE UPDATE ON punch_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_drawings_updated_at
    BEFORE UPDATE ON drawings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_daily_logs_updated_at
    BEFORE UPDATE ON daily_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_crews_updated_at
    BEFORE UPDATE ON crews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_budget_items_updated_at
    BEFORE UPDATE ON budget_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_change_orders_updated_at
    BEFORE UPDATE ON change_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_schedule_phases_updated_at
    BEFORE UPDATE ON schedule_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

-- Enable RLS on every table
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfis                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfi_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE submittals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE submittal_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_log_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE files               ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_captures      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_phases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_snapshots   ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Helper: check if the current user is a member of the given project
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_project_member(p_project_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id
          AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_project_role(p_project_id uuid, allowed_roles text[])
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id
          AND user_id = auth.uid()
          AND role = ANY(allowed_roles)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- -------------------------------------------------------------------------
-- Projects policies
-- -------------------------------------------------------------------------

CREATE POLICY projects_select ON projects FOR SELECT
    USING (is_project_member(id));

CREATE POLICY projects_insert ON projects FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY projects_update ON projects FOR UPDATE
    USING (is_project_role(id, ARRAY['owner', 'admin']));

CREATE POLICY projects_delete ON projects FOR DELETE
    USING (is_project_role(id, ARRAY['owner']));

-- -------------------------------------------------------------------------
-- Project members policies
-- -------------------------------------------------------------------------

CREATE POLICY project_members_select ON project_members FOR SELECT
    USING (
        is_project_member(project_id)
        OR user_id = auth.uid()
    );

CREATE POLICY project_members_insert ON project_members FOR INSERT
    WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin']));

CREATE POLICY project_members_update ON project_members FOR UPDATE
    USING (is_project_role(project_id, ARRAY['owner', 'admin']));

CREATE POLICY project_members_delete ON project_members FOR DELETE
    USING (is_project_role(project_id, ARRAY['owner', 'admin']));

-- -------------------------------------------------------------------------
-- Macro: standard project scoped policies
-- We use a DO block to avoid repeating the same four statements 20+ times.
-- -------------------------------------------------------------------------

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'rfis', 'submittals',
            'punch_items', 'tasks', 'drawings', 'daily_logs',
            'crews', 'budget_items', 'change_orders', 'meetings',
            'directory_contacts',
            'files', 'field_captures', 'schedule_phases', 'activity_feed',
            'ai_insights', 'project_snapshots'
        ])
    LOOP
        -- SELECT: any project member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT USING (is_project_member(project_id))',
            tbl || '_select', tbl
        );

        -- INSERT: owner, admin, or member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY[''owner'', ''admin'', ''member'']))',
            tbl || '_insert', tbl
        );

        -- UPDATE: owner, admin, or member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR UPDATE USING (is_project_role(project_id, ARRAY[''owner'', ''admin'', ''member'']))',
            tbl || '_update', tbl
        );

        -- DELETE: owner or admin only
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR DELETE USING (is_project_role(project_id, ARRAY[''owner'', ''admin'']))',
            tbl || '_delete', tbl
        );
    END LOOP;
END
$$;

-- -------------------------------------------------------------------------
-- Special case: rfi_responses and other child tables that reference a
-- parent via a non project_id FK need the project_id resolved through a
-- join. The DO block above works because every child table listed there
-- carries its own project_id column OR inherits it through the parent's
-- CASCADE. For tables without a direct project_id (rfi_responses,
-- submittal_approvals, daily_log_entries, meeting_attendees,
-- meeting_action_items) we need to override with join based policies.
-- -------------------------------------------------------------------------

-- rfi_responses: project_id lives on the parent rfi
DROP POLICY IF EXISTS rfi_responses_select ON rfi_responses;
DROP POLICY IF EXISTS rfi_responses_insert ON rfi_responses;
DROP POLICY IF EXISTS rfi_responses_update ON rfi_responses;
DROP POLICY IF EXISTS rfi_responses_delete ON rfi_responses;

CREATE POLICY rfi_responses_select ON rfi_responses FOR SELECT
    USING (is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id)));

CREATE POLICY rfi_responses_insert ON rfi_responses FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY rfi_responses_update ON rfi_responses FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY rfi_responses_delete ON rfi_responses FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
        ARRAY['owner', 'admin']
    ));

-- submittal_approvals: project_id lives on the parent submittal
DROP POLICY IF EXISTS submittal_approvals_select ON submittal_approvals;
DROP POLICY IF EXISTS submittal_approvals_insert ON submittal_approvals;
DROP POLICY IF EXISTS submittal_approvals_update ON submittal_approvals;
DROP POLICY IF EXISTS submittal_approvals_delete ON submittal_approvals;

CREATE POLICY submittal_approvals_select ON submittal_approvals FOR SELECT
    USING (is_project_member((SELECT project_id FROM submittals WHERE submittals.id = submittal_id)));

CREATE POLICY submittal_approvals_insert ON submittal_approvals FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM submittals WHERE submittals.id = submittal_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY submittal_approvals_update ON submittal_approvals FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM submittals WHERE submittals.id = submittal_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY submittal_approvals_delete ON submittal_approvals FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM submittals WHERE submittals.id = submittal_id),
        ARRAY['owner', 'admin']
    ));

-- daily_log_entries: project_id lives on the parent daily_log
DROP POLICY IF EXISTS daily_log_entries_select ON daily_log_entries;
DROP POLICY IF EXISTS daily_log_entries_insert ON daily_log_entries;
DROP POLICY IF EXISTS daily_log_entries_update ON daily_log_entries;
DROP POLICY IF EXISTS daily_log_entries_delete ON daily_log_entries;

CREATE POLICY daily_log_entries_select ON daily_log_entries FOR SELECT
    USING (is_project_member((SELECT project_id FROM daily_logs WHERE daily_logs.id = daily_log_id)));

CREATE POLICY daily_log_entries_insert ON daily_log_entries FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM daily_logs WHERE daily_logs.id = daily_log_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY daily_log_entries_update ON daily_log_entries FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM daily_logs WHERE daily_logs.id = daily_log_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY daily_log_entries_delete ON daily_log_entries FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM daily_logs WHERE daily_logs.id = daily_log_id),
        ARRAY['owner', 'admin']
    ));

-- meeting_attendees: project_id lives on the parent meeting
DROP POLICY IF EXISTS meeting_attendees_select ON meeting_attendees;
DROP POLICY IF EXISTS meeting_attendees_insert ON meeting_attendees;
DROP POLICY IF EXISTS meeting_attendees_update ON meeting_attendees;
DROP POLICY IF EXISTS meeting_attendees_delete ON meeting_attendees;

CREATE POLICY meeting_attendees_select ON meeting_attendees FOR SELECT
    USING (is_project_member((SELECT project_id FROM meetings WHERE meetings.id = meeting_id)));

CREATE POLICY meeting_attendees_insert ON meeting_attendees FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM meetings WHERE meetings.id = meeting_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY meeting_attendees_update ON meeting_attendees FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM meetings WHERE meetings.id = meeting_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY meeting_attendees_delete ON meeting_attendees FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM meetings WHERE meetings.id = meeting_id),
        ARRAY['owner', 'admin']
    ));

-- meeting_action_items: project_id lives on the parent meeting
DROP POLICY IF EXISTS meeting_action_items_select ON meeting_action_items;
DROP POLICY IF EXISTS meeting_action_items_insert ON meeting_action_items;
DROP POLICY IF EXISTS meeting_action_items_update ON meeting_action_items;
DROP POLICY IF EXISTS meeting_action_items_delete ON meeting_action_items;

CREATE POLICY meeting_action_items_select ON meeting_action_items FOR SELECT
    USING (is_project_member((SELECT project_id FROM meetings WHERE meetings.id = meeting_id)));

CREATE POLICY meeting_action_items_insert ON meeting_action_items FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM meetings WHERE meetings.id = meeting_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY meeting_action_items_update ON meeting_action_items FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM meetings WHERE meetings.id = meeting_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY meeting_action_items_delete ON meeting_action_items FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM meetings WHERE meetings.id = meeting_id),
        ARRAY['owner', 'admin']
    ));

-- -------------------------------------------------------------------------
-- Notifications: users can only access their own
-- -------------------------------------------------------------------------

CREATE POLICY notifications_select ON notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY notifications_insert ON notifications FOR INSERT
    WITH CHECK (
        is_project_role(project_id, ARRAY['owner', 'admin', 'member'])
        OR project_id IS NULL
    );

CREATE POLICY notifications_update ON notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY notifications_delete ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Done.
-- ---------------------------------------------------------------------------
