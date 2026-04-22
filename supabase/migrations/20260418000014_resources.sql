-- Resource Management Module
-- Tracks labor, material, and equipment rates by project.

CREATE TABLE IF NOT EXISTS labor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  trade text NOT NULL,
  classification text NOT NULL,
  hourly_rate integer NOT NULL, -- cents
  overtime_rate integer,
  benefits_rate integer,
  effective_date date NOT NULL,
  source text DEFAULT 'manual' CHECK (source IN ('manual','davis_bacon','prevailing_wage','union')),
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_rates' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_labor_rates_project ON labor_rates(project_id);

  END IF;

END $$;

CREATE TABLE IF NOT EXISTS material_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  item_name text NOT NULL,
  unit text NOT NULL,
  unit_cost integer NOT NULL, -- cents
  supplier text,
  lead_time_days integer,
  csi_division integer,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_rates' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_material_rates_project ON material_rates(project_id);

  END IF;

END $$;

CREATE TABLE IF NOT EXISTS equipment_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  equipment_name text NOT NULL,
  daily_rate integer NOT NULL, -- cents
  weekly_rate integer,
  monthly_rate integer,
  operator_included boolean DEFAULT false,
  fuel_included boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_rates' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_equipment_rates_project ON equipment_rates(project_id);

  END IF;

END $$;

ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_rates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['labor_rates','material_rates','equipment_rates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_update ON %I FOR UPDATE USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON %I FOR DELETE USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))', t, t);
  END LOOP;
END $$;
