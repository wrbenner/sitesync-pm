-- Photo Pins: Geolocated photos on the BIM model with AI progress detection
-- and before/after comparison for construction progress tracking.

-- ── Photo Pins ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS photo_pins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES auth.users(id),
  location_x    FLOAT NOT NULL,
  location_y    FLOAT NOT NULL,
  location_z    FLOAT NOT NULL,
  photo_url     TEXT NOT NULL,
  photo_360_url TEXT,
  caption       TEXT,
  taken_at      TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  metadata      JSONB DEFAULT '{}'
);

CREATE INDEX idx_photo_pins_project ON photo_pins(project_id);
CREATE INDEX idx_photo_pins_location ON photo_pins(location_x, location_y, location_z);
CREATE INDEX idx_photo_pins_taken ON photo_pins(project_id, taken_at DESC);

-- ── Photo → Element Associations ─────────────────────────

CREATE TABLE IF NOT EXISTS photo_pin_associations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_pin_id    UUID NOT NULL REFERENCES photo_pins(id) ON DELETE CASCADE,
  ifc_element_id  INT NOT NULL,
  is_primary      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(photo_pin_id, ifc_element_id)
);

CREATE INDEX idx_photo_assoc_element ON photo_pin_associations(ifc_element_id);

-- ── AI Progress Detection Results ────────────────────────

CREATE TABLE IF NOT EXISTS progress_detection_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_pin_id        UUID NOT NULL REFERENCES photo_pins(id) ON DELETE CASCADE,
  element_id          INT NOT NULL,
  completion_percent  INT CHECK (completion_percent >= 0 AND completion_percent <= 100),
  confidence_score    FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  description         TEXT,
  ai_analysis         JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_progress_detect_element ON progress_detection_results(element_id);
CREATE INDEX idx_progress_detect_photo ON progress_detection_results(photo_pin_id);

-- ── Before/After Photo Comparisons ───────────────────────

CREATE TABLE IF NOT EXISTS photo_comparisons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  before_photo_id   UUID NOT NULL REFERENCES photo_pins(id) ON DELETE CASCADE,
  after_photo_id    UUID NOT NULL REFERENCES photo_pins(id) ON DELETE CASCADE,
  comparison_url    TEXT,
  progress_detected BOOLEAN,
  days_elapsed      INT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comparisons_project ON photo_comparisons(project_id);

-- ── RLS ──────────────────────────────────────────────────

ALTER TABLE photo_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_pin_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_detection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY photo_pins_select ON photo_pins FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
CREATE POLICY photo_pins_insert ON photo_pins FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
CREATE POLICY photo_pins_delete ON photo_pins FOR DELETE
  USING (uploaded_by = (select auth.uid()) OR project_id IN (
    SELECT project_id FROM project_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin', 'project_manager')
  ));

CREATE POLICY photo_assoc_select ON photo_pin_associations FOR SELECT
  USING (photo_pin_id IN (SELECT id FROM photo_pins WHERE project_id IN (
    SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
  )));
CREATE POLICY photo_assoc_insert ON photo_pin_associations FOR INSERT
  WITH CHECK (photo_pin_id IN (SELECT id FROM photo_pins WHERE project_id IN (
    SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
  )));

CREATE POLICY progress_detect_select ON progress_detection_results FOR SELECT
  USING (photo_pin_id IN (SELECT id FROM photo_pins WHERE project_id IN (
    SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
  )));
CREATE POLICY progress_detect_insert ON progress_detection_results FOR INSERT
  WITH CHECK (photo_pin_id IN (SELECT id FROM photo_pins WHERE project_id IN (
    SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
  )));

CREATE POLICY comparisons_select ON photo_comparisons FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
CREATE POLICY comparisons_insert ON photo_comparisons FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
