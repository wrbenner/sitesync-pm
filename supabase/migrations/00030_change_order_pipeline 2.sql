-- Change Order Pipeline: PCO → COR → CO with full cost tracking

-- Add pipeline fields
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS reason_code text
  CHECK (reason_code IN ('owner_change','design_error','field_condition','regulatory','value_engineering','unforeseen'));
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS estimated_cost numeric DEFAULT 0;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS submitted_cost numeric DEFAULT 0;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS approved_cost numeric DEFAULT 0;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS schedule_impact_days integer DEFAULT 0;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS budget_line_item_id uuid REFERENCES budget_items;

-- Approval chain tracking
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS review_comments text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS approval_comments text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS rejected_by text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS rejection_comments text;

-- Promotion tracking (PCO->COR->CO)
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS promoted_from_id uuid REFERENCES change_orders;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

-- Auto-number per type per project
CREATE OR REPLACE FUNCTION auto_number_change_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = 0 THEN
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM change_orders
    WHERE project_id = NEW.project_id AND type = NEW.type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_number_change_order ON change_orders;
CREATE TRIGGER trg_auto_number_change_order
  BEFORE INSERT ON change_orders
  FOR EACH ROW EXECUTE FUNCTION auto_number_change_order();

-- Index for pipeline queries
CREATE INDEX IF NOT EXISTS idx_change_orders_reason_code ON change_orders(reason_code);
CREATE INDEX IF NOT EXISTS idx_change_orders_status_type ON change_orders(status, type);
CREATE INDEX IF NOT EXISTS idx_change_orders_budget_line ON change_orders(budget_line_item_id);
