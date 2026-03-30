-- RFI Workflow Enhancements: numbering, response flags, void status

-- Add official response flag
ALTER TABLE rfi_responses ADD COLUMN IF NOT EXISTS is_official boolean DEFAULT false;
ALTER TABLE rfi_responses ADD COLUMN IF NOT EXISTS response_type text DEFAULT 'comment' CHECK (response_type IN ('comment','official_response','question','clarification'));

-- Add void status to rfis
ALTER TABLE rfis DROP CONSTRAINT IF EXISTS rfis_status_check;
ALTER TABLE rfis ADD CONSTRAINT rfis_status_check CHECK (status IN ('draft','open','under_review','answered','closed','void'));
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS void_reason text;

-- Auto-number trigger: assigns sequential number per project on INSERT
CREATE OR REPLACE FUNCTION auto_number_rfi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = 0 THEN
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM rfis
    WHERE project_id = NEW.project_id;
  END IF;

  -- Auto-set default due date (7 calendar days) if not provided
  IF NEW.due_date IS NULL THEN
    NEW.due_date = CURRENT_DATE + 7;
  END IF;

  -- Auto-set ball_in_court based on status
  IF NEW.status = 'draft' OR NEW.status = 'open' THEN
    NEW.ball_in_court = COALESCE(NEW.assigned_to, NEW.created_by);
  ELSIF NEW.status = 'under_review' THEN
    NEW.ball_in_court = NEW.assigned_to;
  ELSIF NEW.status = 'answered' THEN
    NEW.ball_in_court = NEW.created_by;
  ELSIF NEW.status IN ('closed', 'void') THEN
    NEW.ball_in_court = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_number_rfi ON rfis;
CREATE TRIGGER trg_auto_number_rfi
  BEFORE INSERT ON rfis
  FOR EACH ROW EXECUTE FUNCTION auto_number_rfi();

-- Also update ball_in_court on status change
DROP TRIGGER IF EXISTS trg_rfi_ball_in_court ON rfis;
CREATE TRIGGER trg_rfi_ball_in_court
  BEFORE UPDATE ON rfis
  FOR EACH ROW EXECUTE FUNCTION auto_number_rfi();

-- Auto-add watchers when RFI is created (creator and assigned_to)
CREATE OR REPLACE FUNCTION auto_add_rfi_watchers()
RETURNS TRIGGER AS $$
BEGIN
  -- Add creator as watcher
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO rfi_watchers (rfi_id, user_id) VALUES (NEW.id, NEW.created_by) ON CONFLICT DO NOTHING;
  END IF;
  -- Add assigned_to as watcher
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO rfi_watchers (rfi_id, user_id) VALUES (NEW.id, NEW.assigned_to) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_add_rfi_watchers ON rfis;
CREATE TRIGGER trg_auto_add_rfi_watchers
  AFTER INSERT ON rfis
  FOR EACH ROW EXECUTE FUNCTION auto_add_rfi_watchers();
