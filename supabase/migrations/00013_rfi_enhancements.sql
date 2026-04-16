-- RFI Module Enhancements

-- Add missing columns to rfis table
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS cost_impact numeric;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS schedule_impact text;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS spec_section text;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS response_due_date date;

-- RFI Watchers table
CREATE TABLE IF NOT EXISTS rfi_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id uuid REFERENCES rfis ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rfi_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rfi_watchers_rfi ON rfi_watchers(rfi_id);
CREATE INDEX IF NOT EXISTS idx_rfi_watchers_user ON rfi_watchers(user_id);

-- Enable RLS
ALTER TABLE rfi_watchers ENABLE ROW LEVEL SECURITY;

-- RLS: watchers visible through parent RFI project membership
CREATE POLICY rfi_watchers_select ON rfi_watchers FOR SELECT
  USING (is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id)));
CREATE POLICY rfi_watchers_insert ON rfi_watchers FOR INSERT
  WITH CHECK (is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id), ARRAY['owner','admin','member']));
CREATE POLICY rfi_watchers_delete ON rfi_watchers FOR DELETE
  USING (user_id = (select auth.uid()) OR is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id), ARRAY['owner','admin']));

-- Trigger: auto update ball_in_court based on status
CREATE OR REPLACE FUNCTION update_rfi_ball_in_court()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' AND NEW.assigned_to IS NOT NULL THEN
    NEW.ball_in_court = NEW.assigned_to;
  ELSIF NEW.status = 'under_review' THEN
    NEW.ball_in_court = NEW.assigned_to;
  ELSIF NEW.status = 'answered' THEN
    NEW.ball_in_court = NEW.created_by;
  ELSIF NEW.status = 'closed' THEN
    NEW.ball_in_court = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rfi_ball_in_court ON rfis;
CREATE TRIGGER trg_rfi_ball_in_court
  BEFORE INSERT OR UPDATE ON rfis
  FOR EACH ROW EXECUTE FUNCTION update_rfi_ball_in_court();
