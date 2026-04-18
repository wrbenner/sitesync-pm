-- Interactive Site Map — geo/pixel-positioned pins for equipment, crews, deliveries, safety zones, photos.

CREATE TABLE IF NOT EXISTS site_map_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  pin_type text NOT NULL CHECK (pin_type IN ('equipment','crew','delivery','safety_zone','photo','custom')),
  label text NOT NULL,
  description text,
  latitude numeric,
  longitude numeric,
  pixel_x numeric,
  pixel_y numeric,
  linked_entity_type text,
  linked_entity_id uuid,
  icon_color text DEFAULT '#F47820',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_map_pins_project ON site_map_pins(project_id);
CREATE INDEX IF NOT EXISTS idx_site_map_pins_type ON site_map_pins(pin_type);

ALTER TABLE site_map_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_map_pins_select ON site_map_pins;
CREATE POLICY site_map_pins_select ON site_map_pins FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS site_map_pins_insert ON site_map_pins;
CREATE POLICY site_map_pins_insert ON site_map_pins FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS site_map_pins_update ON site_map_pins;
CREATE POLICY site_map_pins_update ON site_map_pins FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS site_map_pins_delete ON site_map_pins;
CREATE POLICY site_map_pins_delete ON site_map_pins FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION site_map_pins_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_map_pins_touch ON site_map_pins;
CREATE TRIGGER site_map_pins_touch
  BEFORE UPDATE ON site_map_pins
  FOR EACH ROW EXECUTE FUNCTION site_map_pins_touch_updated_at();
