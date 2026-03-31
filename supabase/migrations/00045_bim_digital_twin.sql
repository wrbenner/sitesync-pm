-- BIM Digital Twin: Progress tracking, RFI associations, safety zones,
-- 4D schedule sequences, and crew GPS locations for the 3D model viewer.

-- ── Element Progress Tracking ────────────────────────────

CREATE TABLE IF NOT EXISTS bim_element_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ifc_element_id      INT NOT NULL,
  global_id           VARCHAR(255),
  element_name        TEXT,
  completion_percent  INT CHECK (completion_percent >= 0 AND completion_percent <= 100),
  last_updated        TIMESTAMPTZ DEFAULT now(),
  updated_by          UUID REFERENCES auth.users(id),
  notes               TEXT,
  UNIQUE(project_id, ifc_element_id)
);

CREATE INDEX idx_bim_progress_project ON bim_element_progress(project_id);

-- ── RFI → BIM Element Associations ───────────────────────

CREATE TABLE IF NOT EXISTS bim_rfi_elements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id          UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ifc_element_id  INT NOT NULL,
  location_x      FLOAT,
  location_y      FLOAT,
  location_z      FLOAT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bim_rfi_project ON bim_rfi_elements(project_id);
CREATE INDEX idx_bim_rfi_rfi ON bim_rfi_elements(rfi_id);

-- ── Safety Hazard Zones ──────────────────────────────────

CREATE TABLE IF NOT EXISTS bim_safety_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hazard_type VARCHAR(50) NOT NULL,
  zone_bounds JSONB NOT NULL,
  description TEXT,
  severity    VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  active      BOOLEAN DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ
);

CREATE INDEX idx_bim_safety_project ON bim_safety_zones(project_id);
CREATE INDEX idx_bim_safety_active ON bim_safety_zones(project_id, active) WHERE active = true;

-- ── 4D Schedule Sequences ────────────────────────────────

CREATE TABLE IF NOT EXISTS bim_4d_sequence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id           UUID REFERENCES tasks(id) ON DELETE SET NULL,
  ifc_element_ids   INT[] NOT NULL,
  planned_start     DATE,
  planned_end       DATE,
  sequence_order    INT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bim_4d_project ON bim_4d_sequence(project_id);
CREATE INDEX idx_bim_4d_order ON bim_4d_sequence(project_id, sequence_order);

-- ── Crew GPS Locations ───────────────────────────────────

CREATE TABLE IF NOT EXISTS crew_gps_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  latitude        FLOAT NOT NULL,
  longitude       FLOAT NOT NULL,
  altitude        FLOAT,
  accuracy_meters INT,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gps_project ON crew_gps_locations(project_id);
CREATE INDEX idx_gps_crew_time ON crew_gps_locations(crew_id, recorded_at DESC);

-- Expire old GPS data (keep 30 days)
CREATE INDEX idx_gps_expiry ON crew_gps_locations(recorded_at) WHERE recorded_at < now() - interval '30 days';

-- ── RLS Policies ─────────────────────────────────────────

ALTER TABLE bim_element_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_rfi_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_safety_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_4d_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_gps_locations ENABLE ROW LEVEL SECURITY;

-- All BIM tables: project members can read
CREATE POLICY bim_progress_select ON bim_element_progress FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_rfi_select ON bim_rfi_elements FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_safety_select ON bim_safety_zones FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_4d_select ON bim_4d_sequence FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY gps_select ON crew_gps_locations FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Insert: project members can write
CREATE POLICY bim_progress_insert ON bim_element_progress FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_rfi_insert ON bim_rfi_elements FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_safety_insert ON bim_safety_zones FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY bim_4d_insert ON bim_4d_sequence FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY gps_insert ON crew_gps_locations FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Update: project members can update progress
CREATE POLICY bim_progress_update ON bim_element_progress FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Delete: managers only
CREATE POLICY bim_safety_delete ON bim_safety_zones FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'project_manager')
  ));
