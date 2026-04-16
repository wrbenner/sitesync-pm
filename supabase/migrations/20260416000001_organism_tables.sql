-- Organism state tables
CREATE TABLE organism_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL CHECK (phase IN ('perceive', 'reason', 'build', 'verify', 'learn')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  perception_data jsonb,
  experiments jsonb,
  build_result jsonb,
  verification_result jsonb,
  learnings jsonb,
  error text,
  cost_tokens_in int DEFAULT 0,
  cost_tokens_out int DEFAULT 0,
  models_used text[]
);

CREATE TABLE organism_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES organism_cycles(id),
  title text NOT NULL,
  target_file text,
  target_metric text,
  instruction text NOT NULL,
  expected_improvement text,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'executing', 'succeeded', 'failed', 'skipped')),
  pr_number int,
  pr_url text,
  metrics_before jsonb,
  metrics_after jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE organism_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid REFERENCES organism_experiments(id),
  category text NOT NULL CHECK (category IN ('pattern', 'anti_pattern', 'skill', 'insight')),
  content text NOT NULL,
  confidence float DEFAULT 0.5,
  times_validated int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organism_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  trigger_conditions text NOT NULL,
  contraindications text,
  instruction_template text NOT NULL,
  success_count int DEFAULT 0,
  failure_count int DEFAULT 0,
  avg_turns int DEFAULT 10,
  files_typically_modified text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- Enable RLS
ALTER TABLE organism_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organism_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organism_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organism_skills ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (the organism runs as service role)
CREATE POLICY organism_cycles_service ON organism_cycles FOR ALL USING (true);
CREATE POLICY organism_experiments_service ON organism_experiments FOR ALL USING (true);
CREATE POLICY organism_learnings_service ON organism_learnings FOR ALL USING (true);
CREATE POLICY organism_skills_service ON organism_skills FOR ALL USING (true);
