-- Submittal Module Enhancements

-- Add fields for better tracking
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS required_onsite_date date;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS submit_by_date date;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS days_in_review int;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS stamp text CHECK (stamp IN ('approved','approved_as_noted','rejected','revise_and_resubmit'));
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS parent_submittal_id uuid REFERENCES submittals;

-- Add stamp field to submittal_approvals
ALTER TABLE submittal_approvals ADD COLUMN IF NOT EXISTS stamp text CHECK (stamp IN ('approved','approved_as_noted','rejected','revise_and_resubmit'));

-- Index for revision tracking
CREATE INDEX IF NOT EXISTS idx_submittals_parent ON submittals(parent_submittal_id);
CREATE INDEX IF NOT EXISTS idx_submittals_spec ON submittals(spec_section);

-- Auto calculate days_in_review
CREATE OR REPLACE FUNCTION update_submittal_days_in_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitted_date IS NOT NULL AND NEW.status NOT IN ('approved', 'rejected') THEN
    NEW.days_in_review = (CURRENT_DATE - NEW.submitted_date);
  ELSIF NEW.approved_date IS NOT NULL THEN
    NEW.days_in_review = (NEW.approved_date - COALESCE(NEW.submitted_date, NEW.created_at::date));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_submittal_days ON submittals;
CREATE TRIGGER trg_submittal_days
  BEFORE INSERT OR UPDATE ON submittals
  FOR EACH ROW EXECUTE FUNCTION update_submittal_days_in_review();

-- Auto calculate submit_by_date from required_onsite_date and lead_time_weeks
CREATE OR REPLACE FUNCTION update_submittal_submit_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.required_onsite_date IS NOT NULL AND NEW.lead_time_weeks IS NOT NULL THEN
    NEW.submit_by_date = NEW.required_onsite_date - (NEW.lead_time_weeks * 7);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_submittal_submit_by ON submittals;
CREATE TRIGGER trg_submittal_submit_by
  BEFORE INSERT OR UPDATE ON submittals
  FOR EACH ROW EXECUTE FUNCTION update_submittal_submit_by();
