-- Site Map V2: Enterprise-grade site map with zones, geofences, site plans, and linked entities
-- Enhances the original site_map_pins table with additional fields and new supporting tables

-- ═══════════════════════════════════════════════════════════════════
-- 1. Enhance existing site_map_pins table
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active','inactive','archived'));
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS floor text;
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS zone_id uuid;
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';
ALTER TABLE site_map_pins ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════════
-- 2. Site Map Zones (safety zones, work areas, geofences)
-- ═══════════════════════════════════════════════════════════════════

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
  -- GeoJSON polygon for GPS mode
  geojson jsonb,
  -- Pixel polygon for site plan mode (array of {x,y} points)
  pixel_polygon jsonb,
  floor text,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_map_zones' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_site_map_zones_project ON site_map_zones(project_id);

  END IF;

END $$;
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

-- FK from pins to zones
ALTER TABLE site_map_pins ADD CONSTRAINT fk_pin_zone
  FOREIGN KEY (zone_id) REFERENCES site_map_zones(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Site Plans (versioned drawing uploads)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  version int DEFAULT 1,
  file_path text NOT NULL,
  file_url text,
  floor text,
  is_current boolean DEFAULT true,
  bounds jsonb, -- {south, west, north, east} for image overlay
  image_width int,
  image_height int,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_plans' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_site_plans_project ON site_plans(project_id);

  END IF;

END $$;
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

-- ═══════════════════════════════════════════════════════════════════
-- 4. Updated_at triggers for new tables
-- ═══════════════════════════════════════════════════════════════════

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
