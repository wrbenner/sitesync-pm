-- Pay App Pre-Submission Audit Overrides
--
-- Adds audit-trail support for the pre-submission compliance gate:
--   * payapp_audit_overrides     — typed reason when a PM accepts gaps and submits anyway
--   * payapp_audit_runs          — every audit evaluation (pass/warn/fail snapshot)
--
-- Both tables follow the project's audit-log conventions:
--   * created_via            — channel that produced the row ('ui', 'api', 'iris', 'cron')
--   * source_drafted_action_id — back-link to drafted_actions when applicable
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS payapp_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_application_id uuid NOT NULL REFERENCES payment_applications(id) ON DELETE CASCADE,
  -- Evaluation snapshot at time of run
  status text NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
  total_checks int NOT NULL DEFAULT 0,
  failed_checks int NOT NULL DEFAULT 0,
  warned_checks int NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]', -- array of { id, label, status, detail, fix_link }
  -- Provenance
  ran_by uuid REFERENCES auth.users(id),
  created_via text DEFAULT 'ui' CHECK (created_via IN ('ui', 'api', 'iris', 'cron', 'edge_function')),
  source_drafted_action_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payapp_audit_runs ADD COLUMN IF NOT EXISTS results jsonb DEFAULT '[]';
ALTER TABLE payapp_audit_runs ADD COLUMN IF NOT EXISTS source_drafted_action_id uuid;
ALTER TABLE payapp_audit_runs ADD COLUMN IF NOT EXISTS created_via text DEFAULT 'ui';

CREATE INDEX IF NOT EXISTS idx_payapp_audit_runs_project ON payapp_audit_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_payapp_audit_runs_payapp ON payapp_audit_runs(payment_application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payapp_audit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_application_id uuid NOT NULL REFERENCES payment_applications(id) ON DELETE CASCADE,
  audit_run_id uuid REFERENCES payapp_audit_runs(id) ON DELETE SET NULL,
  -- The PM is overriding these specific failed check IDs
  overridden_check_ids text[] NOT NULL DEFAULT '{}',
  reason text NOT NULL CHECK (length(reason) >= 12), -- enforce a real explanation
  -- Provenance
  overridden_by uuid REFERENCES auth.users(id),
  created_via text DEFAULT 'ui' CHECK (created_via IN ('ui', 'api', 'iris')),
  source_drafted_action_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payapp_audit_overrides ADD COLUMN IF NOT EXISTS audit_run_id uuid;
ALTER TABLE payapp_audit_overrides ADD COLUMN IF NOT EXISTS source_drafted_action_id uuid;
ALTER TABLE payapp_audit_overrides ADD COLUMN IF NOT EXISTS created_via text DEFAULT 'ui';

CREATE INDEX IF NOT EXISTS idx_payapp_audit_overrides_payapp ON payapp_audit_overrides(payment_application_id, created_at DESC);

ALTER TABLE payapp_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payapp_audit_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payapp_audit_runs_select ON payapp_audit_runs;
CREATE POLICY payapp_audit_runs_select ON payapp_audit_runs FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS payapp_audit_runs_insert ON payapp_audit_runs;
CREATE POLICY payapp_audit_runs_insert ON payapp_audit_runs FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS payapp_audit_overrides_select ON payapp_audit_overrides;
CREATE POLICY payapp_audit_overrides_select ON payapp_audit_overrides FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS payapp_audit_overrides_insert ON payapp_audit_overrides;
CREATE POLICY payapp_audit_overrides_insert ON payapp_audit_overrides FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
