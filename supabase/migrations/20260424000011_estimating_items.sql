-- ═══════════════════════════════════════════════════════════════
-- Migration: estimating_items
-- Version: 20260424000011
-- Purpose: Project-level estimating line items. Optionally attached
--          to a bid_package (used for leveling) and/or a vendor.
--          total_cost is a generated column = quantity * unit_cost.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS estimating_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bid_package_id  uuid REFERENCES bid_packages(id) ON DELETE SET NULL,
  vendor_id       uuid REFERENCES vendors(id) ON DELETE SET NULL,
  cost_code       text,
  description     text NOT NULL DEFAULT '',
  quantity        numeric(14, 4) NOT NULL DEFAULT 0,
  unit            text,
  unit_cost       numeric(14, 4) NOT NULL DEFAULT 0,
  total_cost      numeric(18, 4) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  category        text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimating_items_project
  ON estimating_items (project_id);
CREATE INDEX IF NOT EXISTS idx_estimating_items_bid_package
  ON estimating_items (bid_package_id) WHERE bid_package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estimating_items_vendor
  ON estimating_items (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estimating_items_category
  ON estimating_items (project_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estimating_items_cost_code
  ON estimating_items (project_id, cost_code) WHERE cost_code IS NOT NULL;

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_estimating_items_updated_at ON estimating_items;
CREATE TRIGGER trg_estimating_items_updated_at
  BEFORE UPDATE ON estimating_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE estimating_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimating_items_select ON estimating_items;
CREATE POLICY estimating_items_select ON estimating_items FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS estimating_items_insert ON estimating_items;
CREATE POLICY estimating_items_insert ON estimating_items FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS estimating_items_update ON estimating_items;
CREATE POLICY estimating_items_update ON estimating_items FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS estimating_items_delete ON estimating_items;
CREATE POLICY estimating_items_delete ON estimating_items FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
