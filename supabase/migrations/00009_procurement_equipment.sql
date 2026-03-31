-- =============================================================================
-- Procurement and Equipment Management Module
-- Purchase orders, deliveries, material inventory, equipment tracking,
-- usage logs, and maintenance scheduling.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Purchase Orders
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  po_number serial,
  vendor_name text NOT NULL,
  vendor_contact text,
  vendor_email text,
  vendor_phone text,
  description text,
  status text DEFAULT 'draft' CHECK (status IN (
    'draft','issued','acknowledged','partially_received','fully_received','closed','cancelled'
  )),
  subtotal numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  shipping numeric DEFAULT 0,
  total numeric DEFAULT 0,
  issued_date date,
  required_date date,
  received_date date,
  delivery_address text,
  notes text,
  approved_by uuid REFERENCES auth.users,
  approved_at timestamptz,
  budget_item_id uuid REFERENCES budget_items,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- PO Line Items
CREATE TABLE po_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric,
  unit text,
  unit_cost numeric,
  total_cost numeric,
  quantity_received numeric DEFAULT 0,
  csi_code text,
  notes text,
  sort_order int,
  created_at timestamptz DEFAULT now()
);

-- Deliveries
CREATE TABLE deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  purchase_order_id uuid REFERENCES purchase_orders,
  delivery_date date,
  carrier text,
  tracking_number text,
  status text DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','in_transit','delivered','inspected','rejected'
  )),
  received_by uuid REFERENCES auth.users,
  inspection_notes text,
  photos jsonb DEFAULT '[]',
  packing_slip_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Delivery Items
CREATE TABLE delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries ON DELETE CASCADE NOT NULL,
  po_line_item_id uuid REFERENCES po_line_items,
  quantity_received numeric,
  quantity_damaged numeric DEFAULT 0,
  quantity_backordered numeric DEFAULT 0,
  condition text CHECK (condition IN ('good','damaged','wrong_item','short')),
  notes text,
  photo_url text
);

-- Material Inventory
CREATE TABLE material_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text,
  quantity_on_hand numeric,
  unit text,
  location text,
  minimum_quantity numeric,
  qr_code text UNIQUE,
  last_counted_date date,
  last_counted_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Equipment
CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects,
  name text NOT NULL,
  type text CHECK (type IN (
    'crane','excavator','loader','forklift','generator','compressor',
    'scaffold','formwork','concrete_pump','aerial_lift','dump_truck',
    'roller','paver','welder','saw'
  )),
  make text,
  model text,
  serial_number text,
  year int,
  ownership text CHECK (ownership IN ('owned','rented','leased')),
  vendor text,
  rental_rate_daily numeric,
  rental_rate_weekly numeric,
  rental_rate_monthly numeric,
  status text DEFAULT 'active' CHECK (status IN (
    'active','idle','maintenance','transit','off_site'
  )),
  current_location text,
  current_project_id uuid REFERENCES projects,
  hours_meter numeric,
  last_service_date date,
  next_service_due date,
  qr_code text UNIQUE,
  insurance_policy text,
  insurance_expiry date,
  photos jsonb DEFAULT '[]',
  documents jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Equipment Logs
CREATE TABLE equipment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  hours_used numeric,
  fuel_gallons numeric,
  fuel_cost numeric,
  operator_id uuid REFERENCES auth.users,
  project_id uuid REFERENCES projects,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Equipment Maintenance
CREATE TABLE equipment_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('preventive','corrective','inspection')),
  description text NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','in_progress','completed'
  )),
  scheduled_date date,
  completed_date date,
  cost numeric,
  vendor text,
  parts_used jsonb DEFAULT '[]',
  performed_by text,
  next_due_date date,
  next_due_hours numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- Purchase Orders
CREATE INDEX idx_purchase_orders_project ON purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_name);
CREATE INDEX idx_purchase_orders_issued_date ON purchase_orders(issued_date);
CREATE INDEX idx_purchase_orders_required_date ON purchase_orders(required_date);
CREATE INDEX idx_purchase_orders_approved_by ON purchase_orders(approved_by);
CREATE INDEX idx_purchase_orders_budget_item ON purchase_orders(budget_item_id);
CREATE INDEX idx_purchase_orders_created_by ON purchase_orders(created_by);

-- PO Line Items
CREATE INDEX idx_po_line_items_po ON po_line_items(purchase_order_id);
CREATE INDEX idx_po_line_items_csi ON po_line_items(csi_code);

-- Deliveries
CREATE INDEX idx_deliveries_project ON deliveries(project_id);
CREATE INDEX idx_deliveries_po ON deliveries(purchase_order_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX idx_deliveries_received_by ON deliveries(received_by);
CREATE INDEX idx_deliveries_tracking ON deliveries(tracking_number);

-- Delivery Items
CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_po_line ON delivery_items(po_line_item_id);
CREATE INDEX idx_delivery_items_condition ON delivery_items(condition);

-- Material Inventory
CREATE INDEX idx_material_inventory_project ON material_inventory(project_id);
CREATE INDEX idx_material_inventory_category ON material_inventory(category);
CREATE INDEX idx_material_inventory_qr ON material_inventory(qr_code);
CREATE INDEX idx_material_inventory_location ON material_inventory(location);
CREATE INDEX idx_material_inventory_last_counted ON material_inventory(last_counted_date);
CREATE INDEX idx_material_inventory_counted_by ON material_inventory(last_counted_by);

-- Equipment
CREATE INDEX idx_equipment_project ON equipment(project_id);
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_ownership ON equipment(ownership);
CREATE INDEX idx_equipment_current_project ON equipment(current_project_id);
CREATE INDEX idx_equipment_serial ON equipment(serial_number);
CREATE INDEX idx_equipment_qr ON equipment(qr_code);
CREATE INDEX idx_equipment_next_service ON equipment(next_service_due);
CREATE INDEX idx_equipment_insurance_expiry ON equipment(insurance_expiry);

-- Equipment Logs
CREATE INDEX idx_equipment_logs_equipment ON equipment_logs(equipment_id);
CREATE INDEX idx_equipment_logs_date ON equipment_logs(date);
CREATE INDEX idx_equipment_logs_operator ON equipment_logs(operator_id);
CREATE INDEX idx_equipment_logs_project ON equipment_logs(project_id);

-- Equipment Maintenance
CREATE INDEX idx_equipment_maint_equipment ON equipment_maintenance(equipment_id);
CREATE INDEX idx_equipment_maint_type ON equipment_maintenance(type);
CREATE INDEX idx_equipment_maint_status ON equipment_maintenance(status);
CREATE INDEX idx_equipment_maint_scheduled ON equipment_maintenance(scheduled_date);
CREATE INDEX idx_equipment_maint_completed ON equipment_maintenance(completed_date);
CREATE INDEX idx_equipment_maint_next_due ON equipment_maintenance(next_due_date);

-- ---------------------------------------------------------------------------
-- 3. Updated At Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_material_inventory_updated_at
  BEFORE UPDATE ON material_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_equipment_maintenance_updated_at
  BEFORE UPDATE ON equipment_maintenance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;

-- Purchase Orders: project members
CREATE POLICY purchase_orders_select ON purchase_orders FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY purchase_orders_insert ON purchase_orders FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY purchase_orders_update ON purchase_orders FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY purchase_orders_delete ON purchase_orders FOR DELETE
  USING (is_project_member(project_id));

-- PO Line Items: join through parent purchase order
CREATE POLICY po_line_items_select ON po_line_items FOR SELECT
  USING (
    purchase_order_id IN (
      SELECT po.id FROM purchase_orders po WHERE is_project_member(po.project_id)
    )
  );

CREATE POLICY po_line_items_insert ON po_line_items FOR INSERT
  WITH CHECK (
    purchase_order_id IN (
      SELECT po.id FROM purchase_orders po WHERE is_project_member(po.project_id)
    )
  );

CREATE POLICY po_line_items_update ON po_line_items FOR UPDATE
  USING (
    purchase_order_id IN (
      SELECT po.id FROM purchase_orders po WHERE is_project_member(po.project_id)
    )
  );

CREATE POLICY po_line_items_delete ON po_line_items FOR DELETE
  USING (
    purchase_order_id IN (
      SELECT po.id FROM purchase_orders po WHERE is_project_member(po.project_id)
    )
  );

-- Deliveries: project members
CREATE POLICY deliveries_select ON deliveries FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY deliveries_insert ON deliveries FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY deliveries_update ON deliveries FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY deliveries_delete ON deliveries FOR DELETE
  USING (is_project_member(project_id));

-- Delivery Items: join through parent delivery
CREATE POLICY delivery_items_select ON delivery_items FOR SELECT
  USING (
    delivery_id IN (
      SELECT d.id FROM deliveries d WHERE is_project_member(d.project_id)
    )
  );

CREATE POLICY delivery_items_insert ON delivery_items FOR INSERT
  WITH CHECK (
    delivery_id IN (
      SELECT d.id FROM deliveries d WHERE is_project_member(d.project_id)
    )
  );

CREATE POLICY delivery_items_update ON delivery_items FOR UPDATE
  USING (
    delivery_id IN (
      SELECT d.id FROM deliveries d WHERE is_project_member(d.project_id)
    )
  );

CREATE POLICY delivery_items_delete ON delivery_items FOR DELETE
  USING (
    delivery_id IN (
      SELECT d.id FROM deliveries d WHERE is_project_member(d.project_id)
    )
  );

-- Material Inventory: project members
CREATE POLICY material_inventory_select ON material_inventory FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY material_inventory_insert ON material_inventory FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY material_inventory_update ON material_inventory FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY material_inventory_delete ON material_inventory FOR DELETE
  USING (is_project_member(project_id));

-- Equipment: project members via current_project_id
CREATE POLICY equipment_select ON equipment FOR SELECT
  USING (is_project_member(current_project_id));

CREATE POLICY equipment_insert ON equipment FOR INSERT
  WITH CHECK (is_project_member(current_project_id));

CREATE POLICY equipment_update ON equipment FOR UPDATE
  USING (is_project_member(current_project_id));

CREATE POLICY equipment_delete ON equipment FOR DELETE
  USING (is_project_member(current_project_id));

-- Equipment Logs: join through parent equipment
CREATE POLICY equipment_logs_select ON equipment_logs FOR SELECT
  USING (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

CREATE POLICY equipment_logs_insert ON equipment_logs FOR INSERT
  WITH CHECK (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

CREATE POLICY equipment_logs_update ON equipment_logs FOR UPDATE
  USING (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

CREATE POLICY equipment_logs_delete ON equipment_logs FOR DELETE
  USING (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

-- Equipment Maintenance: join through parent equipment
CREATE POLICY equipment_maint_select ON equipment_maintenance FOR SELECT
  USING (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

CREATE POLICY equipment_maint_insert ON equipment_maintenance FOR INSERT
  WITH CHECK (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

CREATE POLICY equipment_maint_update ON equipment_maintenance FOR UPDATE
  USING (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

CREATE POLICY equipment_maint_delete ON equipment_maintenance FOR DELETE
  USING (
    equipment_id IN (
      SELECT e.id FROM equipment e WHERE is_project_member(e.current_project_id)
    )
  );

-- (Seed data removed)
