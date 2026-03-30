-- Prediction Engine: Enhanced ai_insights and weekly digest support

-- Enhance ai_insights with prediction tracking fields
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS confidence numeric;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS acted_on_at timestamptz;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS acted_on_action text;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS prediction_type text;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Allow 'positive' severity for good news insights
ALTER TABLE ai_insights DROP CONSTRAINT IF EXISTS ai_insights_severity_check;
ALTER TABLE ai_insights ADD CONSTRAINT ai_insights_severity_check
  CHECK (severity IN ('info', 'warning', 'critical', 'positive'));

-- Index for prediction queries
CREATE INDEX IF NOT EXISTS idx_ai_insights_category ON ai_insights(category);
CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON ai_insights(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_prediction_type ON ai_insights(prediction_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_severity_dismissed ON ai_insights(severity, dismissed);

-- Add risk_score to tasks for display
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_score integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));

-- Weekly digest snapshots: add richer metadata
ALTER TABLE project_snapshots ADD COLUMN IF NOT EXISTS snapshot_type text DEFAULT 'daily';
ALTER TABLE project_snapshots ADD COLUMN IF NOT EXISTS metrics jsonb;
ALTER TABLE project_snapshots ADD COLUMN IF NOT EXISTS insights_summary jsonb;
ALTER TABLE project_snapshots ADD COLUMN IF NOT EXISTS risks jsonb;

CREATE INDEX IF NOT EXISTS idx_project_snapshots_type ON project_snapshots(snapshot_type, snapshot_date);
