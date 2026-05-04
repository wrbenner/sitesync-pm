-- =============================================================================
-- Linkage Engine — drawing origin coords + drawing_scopes mapping
-- =============================================================================
-- Layered on top of media_links. Two responsibilities:
--   1. Give every sheet a real-world coordinate origin so GPS pins can resolve
--      to drawing-relative pin_x/pin_y.
--   2. Map drawing area + spec section → responsible crew so a new punch item
--      can suggest "looks like this is on Lone Star Framers".
-- =============================================================================

-- 1. Drawings: project-coordinate origin -------------------------------------
-- The auto-linker only places drawing pins when origin_set = true. Every
-- existing drawing starts with origin_set = false, the GPS-to-pin step
-- skips it, and the visualizer banners "Set this sheet's origin to enable
-- photo linkage" until someone configures it.
--
-- origin_lat/lng:    real-world lat/lng of the sheet's local origin (the point
--                    we treat as drawing coords (0,0)).
-- sheet_extent_m:    width/height of the sheet's depicted area in meters,
--                    used to convert GPS deltas into pin_x/pin_y in [0..1].
-- north_offset_deg:  rotation of the sheet relative to true north
--                    (0 = drawing's +Y aligns with north).

ALTER TABLE drawings ADD COLUMN IF NOT EXISTS origin_lat       double precision;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS origin_lng       double precision;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS sheet_extent_m   jsonb;
  -- shape: {"w_m": <number>, "h_m": <number>}
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS north_offset_deg numeric DEFAULT 0;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS origin_set       boolean DEFAULT false;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS origin_set_by    uuid REFERENCES auth.users(id);
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS origin_set_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_drawings_origin_set
  ON drawings(project_id) WHERE origin_set = true;

-- 2. drawing_scopes ----------------------------------------------------------
-- Which crew owns which area on which sheet. Resolves "who's responsible for
-- the flashing in the NW corner of A2.10?".
--
--   area_polygon:    drawing-relative polygon as JSONB array of {x,y} points
--                    in normalized [0..1] space. NULL = whole sheet.
--   spec_section:    optional CSI section override (e.g. "07 46 46").
--                    Used as a tiebreaker when GPS lands ambiguously between
--                    two scopes.
--   priority:        when multiple scopes match a pin, lower wins. Lets a
--                    specific area (priority=10) override a sheet-wide
--                    fallback (priority=100).

CREATE TABLE IF NOT EXISTS drawing_scopes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_id    uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  crew_id       uuid REFERENCES crews(id) ON DELETE SET NULL,
  contract_id   uuid,  -- soft FK; contracts table has two flavors per migration history
  area_polygon  jsonb,
  spec_section  text,
  priority      integer NOT NULL DEFAULT 50,
  notes         text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_scopes_drawing
  ON drawing_scopes(drawing_id, priority);
CREATE INDEX IF NOT EXISTS idx_drawing_scopes_crew
  ON drawing_scopes(crew_id);
CREATE INDEX IF NOT EXISTS idx_drawing_scopes_project
  ON drawing_scopes(project_id);

ALTER TABLE drawing_scopes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY drawing_scopes_member_select ON drawing_scopes
    FOR SELECT USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY drawing_scopes_member_write ON drawing_scopes
    FOR ALL USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    ) WITH CHECK (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
