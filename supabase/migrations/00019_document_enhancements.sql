-- Document Management Enhancements

-- Enhance drawings with revision tracking and sets
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS status text DEFAULT 'current' CHECK (status IN ('current','superseded','void','for_review'));
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS set_name text;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS change_description text;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS previous_revision_id uuid REFERENCES drawings;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS received_date date;

-- Drawing markups/annotations
CREATE TABLE IF NOT EXISTS drawing_markups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid REFERENCES drawings ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  layer text DEFAULT 'personal' CHECK (layer IN ('personal','shared','official')),
  type text CHECK (type IN ('pen','highlighter','text','shape','dimension','cloudmark','pin')),
  data jsonb NOT NULL DEFAULT '{}',
  note text,
  linked_rfi_id uuid REFERENCES rfis,
  linked_punch_item_id uuid REFERENCES punch_items,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_markups_drawing ON drawing_markups(drawing_id);
CREATE INDEX IF NOT EXISTS idx_drawing_markups_layer ON drawing_markups(layer);

ALTER TABLE drawing_markups ENABLE ROW LEVEL SECURITY;
CREATE POLICY dm_select ON drawing_markups FOR SELECT
  USING (is_project_member(project_id) AND (layer != 'personal' OR created_by = (select auth.uid())));
CREATE POLICY dm_insert ON drawing_markups FOR INSERT
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY dm_update ON drawing_markups FOR UPDATE
  USING (created_by = (select auth.uid()) OR is_project_role(project_id, ARRAY['owner','admin']));
CREATE POLICY dm_delete ON drawing_markups FOR DELETE
  USING (created_by = (select auth.uid()) OR is_project_role(project_id, ARRAY['owner','admin']));

-- Transmittals
CREATE TABLE IF NOT EXISTS transmittals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  transmittal_number serial,
  to_company text NOT NULL,
  to_contact text,
  to_email text,
  from_company text,
  from_contact text,
  subject text NOT NULL,
  purpose text CHECK (purpose IN ('for_review','for_approval','for_construction','for_information','for_record','as_requested')),
  action_required text CHECK (action_required IN ('review_and_return','review_and_comment','for_your_use','as_requested','none')),
  notes text,
  document_ids uuid[] DEFAULT '{}',
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','acknowledged')),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transmittals_project ON transmittals(project_id);
ALTER TABLE transmittals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tr_select ON transmittals FOR SELECT USING (is_project_member(project_id));
CREATE POLICY tr_insert ON transmittals FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY['owner','admin','member']));

-- Enhance files with tags and description
ALTER TABLE files ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE files ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]';
ALTER TABLE files ADD COLUMN IF NOT EXISTS discipline text;
ALTER TABLE files ADD COLUMN IF NOT EXISTS trade text;

-- Drawing sets
CREATE INDEX IF NOT EXISTS idx_drawings_set ON drawings(set_name);
CREATE INDEX IF NOT EXISTS idx_drawings_revision ON drawings(previous_revision_id);
CREATE INDEX IF NOT EXISTS idx_drawings_status ON drawings(status);
CREATE INDEX IF NOT EXISTS idx_files_tags ON files USING gin(tags);
