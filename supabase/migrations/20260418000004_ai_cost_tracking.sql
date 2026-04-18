-- Phase 4, Module 8: AI Cost Tracking
-- Ledger of every AI call (classification, edge detection, discrepancy
-- analysis, copilot, embeddings). Every Edge Function that spends tokens
-- must INSERT a row here so the cost dashboard can compute spend and ROI.

CREATE TABLE IF NOT EXISTS ai_cost_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service text NOT NULL,
  operation text,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_cost_cents integer DEFAULT 0,
  model text,
  acknowledgement_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_project_created
  ON ai_cost_tracking(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_service_created
  ON ai_cost_tracking(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_user_created
  ON ai_cost_tracking(user_id, created_at DESC);

ALTER TABLE ai_cost_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_cost_tracking_select ON ai_cost_tracking;
CREATE POLICY ai_cost_tracking_select
  ON ai_cost_tracking FOR SELECT
  USING (
    project_id IS NULL
    OR is_project_member(project_id)
  );

-- Inserts are made by service-role keys from Edge Functions. No direct
-- client inserts allowed, so no INSERT policy is defined.

COMMENT ON TABLE ai_cost_tracking IS
  'Ledger of AI token usage and cost. Written by Edge Functions using the service role. Read by the AI Cost Dashboard.';
COMMENT ON COLUMN ai_cost_tracking.service IS
  'Service name: classification, edge_detection, discrepancy_analysis, copilot, embeddings, etc.';
COMMENT ON COLUMN ai_cost_tracking.total_cost_cents IS
  'Cost in integer US cents. Never use floats for money.';
