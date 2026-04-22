-- Carbon & Sustainability Tracking — embodied carbon factors, per-project entries, LEED credits.

CREATE TABLE IF NOT EXISTS carbon_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_category text NOT NULL,
  material_name text NOT NULL,
  unit text NOT NULL,
  embodied_carbon_kg_per_unit numeric NOT NULL,
  source text DEFAULT 'EPA',
  notes text,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carbon_factors' AND column_name = 'material_category') THEN

    CREATE INDEX IF NOT EXISTS idx_carbon_factors_cat ON carbon_factors(material_category);

  END IF;

END $$;

CREATE TABLE IF NOT EXISTS project_carbon_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  scope text NOT NULL CHECK (scope IN ('embodied','construction','operational')),
  category text NOT NULL,
  description text,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  carbon_factor_id uuid REFERENCES carbon_factors(id),
  carbon_kg numeric NOT NULL,
  source_type text,
  source_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_carbon_entries' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_pce_project ON project_carbon_entries(project_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_carbon_entries' AND column_name = 'scope') THEN
    CREATE INDEX IF NOT EXISTS idx_pce_scope ON project_carbon_entries(scope);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leed_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  credit_category text NOT NULL,
  credit_id text NOT NULL,
  credit_name text NOT NULL,
  points_possible integer NOT NULL,
  points_achieved integer DEFAULT 0,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','documented','submitted','achieved','denied')),
  documentation_notes text,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leed_credits' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_leed_project ON leed_credits(project_id);

  END IF;

END $$;

ALTER TABLE carbon_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_carbon_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leed_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carbon_factors_select ON carbon_factors;
CREATE POLICY carbon_factors_select ON carbon_factors FOR SELECT USING (true);

DROP POLICY IF EXISTS pce_select ON project_carbon_entries;
CREATE POLICY pce_select ON project_carbon_entries FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS pce_insert ON project_carbon_entries;
CREATE POLICY pce_insert ON project_carbon_entries FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS pce_update ON project_carbon_entries;
CREATE POLICY pce_update ON project_carbon_entries FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS pce_delete ON project_carbon_entries;
CREATE POLICY pce_delete ON project_carbon_entries FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS leed_select ON leed_credits;
CREATE POLICY leed_select ON leed_credits FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS leed_insert ON leed_credits;
CREATE POLICY leed_insert ON leed_credits FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS leed_update ON leed_credits;
CREATE POLICY leed_update ON leed_credits FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS leed_delete ON leed_credits;
CREATE POLICY leed_delete ON leed_credits FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

INSERT INTO carbon_factors (material_category, material_name, unit, embodied_carbon_kg_per_unit, source) VALUES
  ('concrete', 'Ready-mix concrete (4000 psi)', 'cy', 350, 'EPA'),
  ('concrete', 'Ready-mix concrete (5000 psi)', 'cy', 400, 'EPA'),
  ('steel', 'Structural steel (W-shapes)', 'ton', 1850, 'EPA'),
  ('steel', 'Rebar (#4-#8)', 'ton', 1200, 'EPA'),
  ('lumber', 'Dimensional lumber (SPF)', 'mbf', 150, 'EPA'),
  ('lumber', 'Engineered wood (LVL/Glulam)', 'mbf', 200, 'EPA'),
  ('insulation', 'Fiberglass batt', 'sf', 2.5, 'EPA'),
  ('insulation', 'Spray foam (closed cell)', 'sf', 8.5, 'EPA'),
  ('glass', 'Double-pane IGU', 'sf', 25, 'EPA'),
  ('masonry', 'CMU block (8")', 'sf', 18, 'EPA'),
  ('roofing', 'TPO membrane', 'sf', 4.5, 'EPA'),
  ('drywall', 'Gypsum board (5/8")', 'sf', 3.2, 'EPA'),
  ('flooring', 'Polished concrete', 'sf', 1.5, 'EPA'),
  ('mechanical', 'HVAC ductwork (galvanized)', 'lb', 2.8, 'EPA'),
  ('plumbing', 'Copper pipe (Type L)', 'lf', 4.2, 'EPA')
ON CONFLICT DO NOTHING;
