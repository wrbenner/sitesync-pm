-- Submittal Workflow Enhancements

-- Add approval chain configuration
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS approval_chain jsonb DEFAULT '["gc_pm","architect"]';
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS current_reviewer text;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS parent_submittal_id uuid REFERENCES submittals;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS closed_date date;

-- Enhance submittal_approvals for chain tracking
ALTER TABLE submittal_approvals ADD COLUMN IF NOT EXISTS chain_order int DEFAULT 0;
ALTER TABLE submittal_approvals ADD COLUMN IF NOT EXISTS revision_number int DEFAULT 1;

-- Auto-number submittals per project
CREATE OR REPLACE FUNCTION auto_number_submittal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = 0 THEN
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM submittals
    WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_number_submittal ON submittals;
CREATE TRIGGER trg_auto_number_submittal
  BEFORE INSERT ON submittals
  FOR EACH ROW EXECUTE FUNCTION auto_number_submittal();

-- Add status check for closed
ALTER TABLE submittals DROP CONSTRAINT IF EXISTS submittals_status_check;
ALTER TABLE submittals ADD CONSTRAINT submittals_status_check
  CHECK (status IN ('draft','pending','submitted','under_review','approved','rejected','resubmit','closed'));

-- Update existing data
UPDATE submittals SET status = 'under_review' WHERE status NOT IN ('draft','pending','submitted','under_review','approved','rejected','resubmit','closed');
