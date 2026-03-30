-- Meeting Module Enhancements

-- Structured agenda items
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  presenter text,
  duration_minutes int DEFAULT 5,
  notes text,
  decision text,
  sort_order int DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','discussed','deferred','tabled')),
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY mai_select ON meeting_agenda_items FOR SELECT
  USING (is_project_member((SELECT project_id FROM meetings WHERE meetings.id = meeting_id)));
CREATE POLICY mai_insert ON meeting_agenda_items FOR INSERT
  WITH CHECK (is_project_role((SELECT project_id FROM meetings WHERE meetings.id = meeting_id), ARRAY['owner','admin','member']));
CREATE POLICY mai_update ON meeting_agenda_items FOR UPDATE
  USING (is_project_role((SELECT project_id FROM meetings WHERE meetings.id = meeting_id), ARRAY['owner','admin','member']));

-- Enhance meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_number serial;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled'));
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes_published boolean DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes_published_at timestamptz;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS previous_meeting_id uuid REFERENCES meetings;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS actual_duration_minutes int;

-- Enhance action items
ALTER TABLE meeting_action_items ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical'));
ALTER TABLE meeting_action_items ADD COLUMN IF NOT EXISTS source_agenda_item_id uuid REFERENCES meeting_agenda_items;
ALTER TABLE meeting_action_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE meeting_action_items ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES tasks;

-- Enhance attendees
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS sign_in_time timestamptz;
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS signature_url text;

-- Meeting series for recurring meetings
CREATE TABLE IF NOT EXISTS meeting_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  type text CHECK (type IN ('oac','subcontractor','safety','coordination','progress','closeout')),
  recurrence text CHECK (recurrence IN ('weekly','biweekly','monthly')),
  day_of_week int,
  time_of_day text,
  location text,
  default_duration_minutes int DEFAULT 60,
  default_attendees jsonb DEFAULT '[]',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_meeting_series_project ON meeting_series(project_id);
ALTER TABLE meeting_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY ms_select ON meeting_series FOR SELECT USING (is_project_member(project_id));
CREATE POLICY ms_insert ON meeting_series FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY ms_update ON meeting_series FOR UPDATE USING (is_project_role(project_id, ARRAY['owner','admin','member']));
