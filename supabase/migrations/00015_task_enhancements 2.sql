-- Task Module Enhancements: Dependencies, Critical Path, Scheduling

-- Add missing fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS predecessor_ids uuid[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS successor_ids uuid[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependency_type text DEFAULT 'FS' CHECK (dependency_type IN ('FS','FF','SS','SF'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lag_days int DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours numeric;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours numeric DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS percent_complete numeric DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS trade text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS early_start date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS early_finish date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS late_start date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS late_finish date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_float int;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS constraint_type text DEFAULT 'ASAP' CHECK (constraint_type IN ('ASAP','must_start_on','must_finish_on','start_no_earlier_than','finish_no_later_than'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS constraint_date date;

-- Indexes for dependency queries
CREATE INDEX IF NOT EXISTS idx_tasks_predecessor ON tasks USING gin(predecessor_ids);
CREATE INDEX IF NOT EXISTS idx_tasks_trade ON tasks(trade);
CREATE INDEX IF NOT EXISTS idx_tasks_location ON tasks(location);
CREATE INDEX IF NOT EXISTS idx_tasks_critical ON tasks(is_critical_path) WHERE is_critical_path = true;

-- Task templates table
CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  phase text,
  tasks jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES auth.users,
  is_global boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_templates_select ON task_templates FOR SELECT USING (is_global = true OR created_by = auth.uid());
CREATE POLICY task_templates_insert ON task_templates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Seed common construction task templates
INSERT INTO task_templates (name, description, phase, is_global, tasks) VALUES
('Foundation Package', 'Complete foundation sequence from excavation to backfill', 'foundation', true,
 '[{"title":"Excavation and Grading","trade":"Earthwork","duration_days":5,"order":1},{"title":"Foundation Layout and Formwork","trade":"Concrete","duration_days":3,"order":2,"depends_on":1},{"title":"Rebar Installation","trade":"Concrete","duration_days":4,"order":3,"depends_on":2},{"title":"Foundation Pour","trade":"Concrete","duration_days":2,"order":4,"depends_on":3},{"title":"Strip Forms and Cure","trade":"Concrete","duration_days":7,"order":5,"depends_on":4},{"title":"Waterproofing","trade":"Waterproofing","duration_days":3,"order":6,"depends_on":5},{"title":"Backfill and Compaction","trade":"Earthwork","duration_days":3,"order":7,"depends_on":6}]'),
('Structural Steel Package', 'Steel erection sequence for multi story', 'structure', true,
 '[{"title":"Anchor Bolt Survey","trade":"Structural","duration_days":1,"order":1},{"title":"Steel Delivery Coordination","trade":"Structural","duration_days":2,"order":2},{"title":"Column Erection","trade":"Structural","duration_days":10,"order":3,"depends_on":2},{"title":"Beam and Girder Installation","trade":"Structural","duration_days":8,"order":4,"depends_on":3},{"title":"Metal Deck Installation","trade":"Structural","duration_days":5,"order":5,"depends_on":4},{"title":"Stud Welding","trade":"Structural","duration_days":3,"order":6,"depends_on":5},{"title":"Concrete Deck Pour","trade":"Concrete","duration_days":4,"order":7,"depends_on":6}]'),
('MEP Rough In Package', 'Mechanical, electrical, plumbing rough in sequence', 'mep', true,
 '[{"title":"Plumbing Underground Rough In","trade":"Plumbing","duration_days":5,"order":1},{"title":"Electrical Conduit and Boxes","trade":"Electrical","duration_days":8,"order":2},{"title":"HVAC Ductwork Installation","trade":"HVAC","duration_days":10,"order":3},{"title":"Plumbing Above Ground Rough In","trade":"Plumbing","duration_days":6,"order":4,"depends_on":1},{"title":"Fire Sprinkler Rough In","trade":"Fire Protection","duration_days":5,"order":5,"depends_on":3},{"title":"MEP Coordination Walk","trade":"General","duration_days":1,"order":6,"depends_on":[4,5]},{"title":"Insulation","trade":"Insulation","duration_days":4,"order":7,"depends_on":6}]'),
('Interior Finish Package', 'Interior finishing sequence', 'finishes', true,
 '[{"title":"Drywall Installation","trade":"Drywall","duration_days":10,"order":1},{"title":"Drywall Taping and Finishing","trade":"Drywall","duration_days":8,"order":2,"depends_on":1},{"title":"Prime Coat","trade":"Painting","duration_days":3,"order":3,"depends_on":2},{"title":"Ceiling Grid Installation","trade":"Acoustical","duration_days":5,"order":4,"depends_on":2},{"title":"Floor Prep","trade":"Flooring","duration_days":2,"order":5,"depends_on":3},{"title":"Flooring Installation","trade":"Flooring","duration_days":6,"order":6,"depends_on":5},{"title":"Final Paint","trade":"Painting","duration_days":4,"order":7,"depends_on":6},{"title":"Millwork and Trim","trade":"Carpentry","duration_days":5,"order":8,"depends_on":7}]')
ON CONFLICT DO NOTHING;
