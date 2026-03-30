-- BIM/3D Model viewer: model storage, element metadata, and 3D markups.

-- BIM Models
CREATE TABLE IF NOT EXISTS bim_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  format text NOT NULL DEFAULT 'ifc' CHECK (format IN ('ifc', 'fbx', 'gltf', 'obj')),
  element_count int DEFAULT 0,
  floor_count int DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  processed boolean DEFAULT false,
  processing_error text,
  -- Parsed metadata
  metadata jsonb DEFAULT '{}',
  bounding_box jsonb, -- {min: {x,y,z}, max: {x,y,z}}
  spatial_tree jsonb, -- hierarchical structure for progressive loading
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bim_models_project ON bim_models(project_id);

ALTER TABLE bim_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY bim_models_select ON bim_models FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_models_manage ON bim_models FOR ALL
  USING (has_project_permission(project_id, 'project_manager'));

-- BIM Elements (parsed from IFC)
CREATE TABLE IF NOT EXISTS bim_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES bim_models(id) ON DELETE CASCADE NOT NULL,
  ifc_guid text, -- IFC GlobalId
  ifc_type text, -- IfcWall, IfcSlab, IfcColumn, etc.
  name text,
  floor text,
  trade text, -- structural, mechanical, electrical, plumbing, architectural
  material text,
  properties jsonb DEFAULT '{}', -- IFC property sets
  geometry_hash text, -- For deduplication
  bounding_box jsonb,
  -- Progress tracking
  linked_task_id uuid REFERENCES tasks(id),
  percent_complete numeric(5,2) DEFAULT 0,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete', 'issue')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bim_elements_model ON bim_elements(model_id);
CREATE INDEX idx_bim_elements_type ON bim_elements(model_id, ifc_type);
CREATE INDEX idx_bim_elements_floor ON bim_elements(model_id, floor);
CREATE INDEX idx_bim_elements_trade ON bim_elements(model_id, trade);

-- BIM Markups (3D annotations)
CREATE TABLE IF NOT EXISTS bim_markups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES bim_models(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  markup_type text NOT NULL CHECK (markup_type IN ('measurement', 'note', 'photo_pin', 'clash', 'section_plane', 'dimension')),
  -- 3D positioning
  position jsonb NOT NULL, -- {x, y, z}
  end_position jsonb, -- For measurements: {x, y, z}
  normal jsonb, -- For section planes: {x, y, z}
  -- Viewpoint
  camera_position jsonb, -- {x, y, z}
  camera_target jsonb, -- {x, y, z}
  camera_zoom numeric,
  -- Content
  title text,
  description text,
  color text DEFAULT '#F47820',
  layer text DEFAULT 'personal' CHECK (layer IN ('personal', 'shared', 'official')),
  -- Links
  linked_entity_type text,
  linked_entity_id uuid,
  linked_element_id uuid REFERENCES bim_elements(id),
  photo_url text,
  -- Metadata
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bim_markups_model ON bim_markups(model_id);
CREATE INDEX idx_bim_markups_project ON bim_markups(project_id);

ALTER TABLE bim_markups ENABLE ROW LEVEL SECURITY;
CREATE POLICY bim_markups_select ON bim_markups FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_markups_insert ON bim_markups FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));
CREATE POLICY bim_markups_update ON bim_markups FOR UPDATE
  USING (created_by = auth.uid() OR has_project_permission(project_id, 'admin'));

-- Clash Detection Results
CREATE TABLE IF NOT EXISTS bim_clashes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES bim_models(id) ON DELETE CASCADE NOT NULL,
  element_a_id uuid REFERENCES bim_elements(id),
  element_b_id uuid REFERENCES bim_elements(id),
  clash_type text NOT NULL CHECK (clash_type IN ('hard', 'soft', 'clearance')),
  distance numeric, -- For soft/clearance clashes
  position jsonb NOT NULL, -- Clash point {x, y, z}
  status text DEFAULT 'new' CHECK (status IN ('new', 'active', 'resolved', 'approved', 'ignored')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  linked_rfi_id uuid REFERENCES rfis(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bim_clashes_model ON bim_clashes(model_id, status);

-- Triggers
CREATE TRIGGER set_bim_models_updated_at BEFORE UPDATE ON bim_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_bim_markups_updated_at BEFORE UPDATE ON bim_markups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
