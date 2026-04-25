-- ═══════════════════════════════════════════════════════════════════
-- SiteMap V2 Migration Script
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create site_map_pins if it doesn't exist
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

-- 2. Add V2 columns to site_map_pins
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active','inactive','archived'));
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS floor text;
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS zone_id uuid;
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- 3. Create site_map_zones
CREATE TABLE IF NOT EXISTS site_map_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  zone_type text NOT NULL CHECK (zone_type IN (
    'work_area', 'safety_zone', 'staging_area', 'parking',
    'material_storage', 'exclusion_zone', 'crane_radius',
    'pedestrian_path', 'vehicle_route', 'utility_corridor', 'custom'
  )),
  color text DEFAULT '#3B82F6',
  opacity numeric DEFAULT 0.25,
  geojson jsonb,
  pixel_polygon jsonb,
  floor text,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_map_zones_project ON site_map_zones(project_id);
ALTER TABLE site_map_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS smz_select ON site_map_zones;
CREATE POLICY smz_select ON site_map_zones FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS smz_insert ON site_map_zones;
CREATE POLICY smz_insert ON site_map_zones FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS smz_update ON site_map_zones;
CREATE POLICY smz_update ON site_map_zones FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS smz_delete ON site_map_zones;
CREATE POLICY smz_delete ON site_map_zones FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- 4. Create site_plans
CREATE TABLE IF NOT EXISTS site_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  version int DEFAULT 1,
  file_path text NOT NULL,
  file_url text,
  floor text,
  is_current boolean DEFAULT true,
  bounds jsonb,
  image_width int,
  image_height int,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_plans_project ON site_plans(project_id);
ALTER TABLE site_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sp_select ON site_plans;
CREATE POLICY sp_select ON site_plans FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS sp_insert ON site_plans;
CREATE POLICY sp_insert ON site_plans FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS sp_update ON site_plans;
CREATE POLICY sp_update ON site_plans FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS sp_delete ON site_plans;
CREATE POLICY sp_delete ON site_plans FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- 5. Triggers
CREATE OR REPLACE FUNCTION site_map_zones_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_map_zones_touch ON site_map_zones;
CREATE TRIGGER site_map_zones_touch
  BEFORE UPDATE ON site_map_zones
  FOR EACH ROW EXECUTE FUNCTION site_map_zones_touch_updated_at();

-- 6. FK from pins to zones (may fail if already exists)
DO $$ BEGIN
  ALTER TABLE site_map_pins ADD CONSTRAINT fk_pin_zone
    FOREIGN KEY (zone_id) REFERENCES site_map_zones(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Done! Reload the schema cache by going to Settings > API > Reload Schema Cache
-- or wait ~30 seconds for it to auto-refresh.
