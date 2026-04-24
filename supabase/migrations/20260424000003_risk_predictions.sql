-- ═══════════════════════════════════════════════════════════════
-- Migration: risk_predictions
-- Version: 20260424000003
-- Purpose: AI-generated risk forecasts per project. Surfaced in
--          useRiskPredictions (src/hooks/usePlatformIntel.ts).
--          Columns mirror the RiskPrediction type in
--          src/types/platformIntel.ts (factors jsonb, probability
--          0-1, impact enum, recommendation text).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_predictions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_type      text NOT NULL
    CHECK (risk_type IN (
      'budget_overrun', 'schedule_slip', 'rfi_delay',
      'submittal_rejection', 'safety_incident'
    )),
  probability    numeric(4, 3) NOT NULL
    CHECK (probability >= 0 AND probability <= 1),
  impact         text NOT NULL
    CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  description    text NOT NULL DEFAULT '',
  factors        jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL DEFAULT '',
  predicted_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_predictions_project_prob
  ON risk_predictions (project_id, probability DESC);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_predicted_at
  ON risk_predictions (predicted_at DESC);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_risk_predictions_updated_at ON risk_predictions;
CREATE TRIGGER trg_risk_predictions_updated_at
  BEFORE UPDATE ON risk_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE risk_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_predictions_select ON risk_predictions;
CREATE POLICY risk_predictions_select ON risk_predictions FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS risk_predictions_insert ON risk_predictions;
CREATE POLICY risk_predictions_insert ON risk_predictions FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS risk_predictions_update ON risk_predictions;
CREATE POLICY risk_predictions_update ON risk_predictions FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS risk_predictions_delete ON risk_predictions;
CREATE POLICY risk_predictions_delete ON risk_predictions FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
