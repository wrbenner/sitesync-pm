-- Job Costing Engine
-- Tracks budgets, commitments, actuals, and forecasts per cost code.

CREATE TABLE IF NOT EXISTS cost_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  description text NOT NULL,
  budgeted_amount integer DEFAULT 0,
  committed_amount integer DEFAULT 0,
  actual_amount integer DEFAULT 0,
  forecast_amount integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_codes_project ON cost_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_codes_code ON cost_codes(code);

CREATE TABLE IF NOT EXISTS cost_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  cost_code_id uuid REFERENCES cost_codes(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('budget','commitment','actual','forecast_adjustment')),
  amount integer NOT NULL,
  description text,
  source_type text,
  source_id uuid,
  transaction_date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_transactions_project ON cost_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_transactions_code ON cost_transactions(cost_code_id);
CREATE INDEX IF NOT EXISTS idx_cost_transactions_type ON cost_transactions(transaction_type);

ALTER TABLE cost_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_codes_select ON cost_codes;
CREATE POLICY cost_codes_select ON cost_codes FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cost_codes_insert ON cost_codes;
CREATE POLICY cost_codes_insert ON cost_codes FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cost_codes_update ON cost_codes;
CREATE POLICY cost_codes_update ON cost_codes FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cost_codes_delete ON cost_codes;
CREATE POLICY cost_codes_delete ON cost_codes FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cost_transactions_select ON cost_transactions;
CREATE POLICY cost_transactions_select ON cost_transactions FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cost_transactions_insert ON cost_transactions;
CREATE POLICY cost_transactions_insert ON cost_transactions FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cost_transactions_update ON cost_transactions;
CREATE POLICY cost_transactions_update ON cost_transactions FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cost_transactions_delete ON cost_transactions;
CREATE POLICY cost_transactions_delete ON cost_transactions FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
