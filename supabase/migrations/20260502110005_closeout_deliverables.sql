-- =============================================================================
-- closeout_deliverables — extends closeout_items
-- =============================================================================
-- The existing `closeout_items` table covers status (received / outstanding
-- / waived). This adds:
--   • category enums aligned to the customer-bound PDF report sections
--   • per-deliverable required_by date so the "due in N days" reminder
--     escalator fires off the right schedule
--   • document_url + size for the bound PDF aggregator
--   • signoff_required flag — some deliverables (commissioning reports,
--     warranties) need an owner signature; others (attic stock list)
--     don't
-- =============================================================================

ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS required_by date;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS signoff_required boolean NOT NULL DEFAULT false;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS signoff_received_at timestamptz;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS signoff_received_by text;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS document_size_bytes bigint;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS escalation_status text
  CHECK (escalation_status IS NULL OR escalation_status IN ('none','reminded','escalated','resolved'));
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_closeout_items_required_by
  ON closeout_items(project_id, required_by) WHERE required_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_closeout_items_escalation
  ON closeout_items(project_id, escalation_status) WHERE escalation_status IS NOT NULL AND escalation_status != 'none';
