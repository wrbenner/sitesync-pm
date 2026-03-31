-- Financial Module Enhancements

-- Enhance change_orders with PCO/COR pipeline
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS schedule_impact text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS cost_code text;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS type text DEFAULT 'co' CHECK (type IN ('pco','cor','co'));
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS parent_co_id uuid REFERENCES change_orders;

-- Drop constraint first, update data, then re-add
ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;
UPDATE change_orders SET status = 'pending_review' WHERE status NOT IN ('draft','pending_review','approved','rejected','void');
ALTER TABLE change_orders ADD CONSTRAINT change_orders_status_check
  CHECK (status IN ('draft','pending_review','approved','rejected','void'));

-- Add cost code to budget_items
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS cost_code text;
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS csi_division text;

-- Add CSI code to SOV
ALTER TABLE schedule_of_values ADD COLUMN IF NOT EXISTS cost_code text;

-- Index for cost code lookups
CREATE INDEX IF NOT EXISTS idx_budget_items_cost_code ON budget_items(cost_code);
CREATE INDEX IF NOT EXISTS idx_change_orders_type ON change_orders(type);
CREATE INDEX IF NOT EXISTS idx_change_orders_parent ON change_orders(parent_co_id);
