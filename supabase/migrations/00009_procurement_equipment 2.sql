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

-- =============================================================================
-- Seed Data
-- =============================================================================

DO $$
DECLARE
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- Purchase Order IDs
  po_steel UUID := 'dd000001-0000-0000-0000-000000000001';
  po_mep UUID := 'dd000001-0000-0000-0000-000000000002';
  po_concrete UUID := 'dd000001-0000-0000-0000-000000000003';

  -- PO Line Item IDs
  poli_1 UUID := 'dd000002-0000-0000-0000-000000000001';
  poli_2 UUID := 'dd000002-0000-0000-0000-000000000002';
  poli_3 UUID := 'dd000002-0000-0000-0000-000000000003';
  poli_4 UUID := 'dd000002-0000-0000-0000-000000000004';
  poli_5 UUID := 'dd000002-0000-0000-0000-000000000005';
  poli_6 UUID := 'dd000002-0000-0000-0000-000000000006';
  poli_7 UUID := 'dd000002-0000-0000-0000-000000000007';
  poli_8 UUID := 'dd000002-0000-0000-0000-000000000008';

  -- Delivery IDs
  del_1 UUID := 'dd000003-0000-0000-0000-000000000001';
  del_2 UUID := 'dd000003-0000-0000-0000-000000000002';

  -- Delivery Item IDs
  di_1 UUID := 'dd000004-0000-0000-0000-000000000001';
  di_2 UUID := 'dd000004-0000-0000-0000-000000000002';
  di_3 UUID := 'dd000004-0000-0000-0000-000000000003';
  di_4 UUID := 'dd000004-0000-0000-0000-000000000004';

  -- Material Inventory IDs
  mat_1 UUID := 'dd000005-0000-0000-0000-000000000001';
  mat_2 UUID := 'dd000005-0000-0000-0000-000000000002';
  mat_3 UUID := 'dd000005-0000-0000-0000-000000000003';
  mat_4 UUID := 'dd000005-0000-0000-0000-000000000004';
  mat_5 UUID := 'dd000005-0000-0000-0000-000000000005';
  mat_6 UUID := 'dd000005-0000-0000-0000-000000000006';
  mat_7 UUID := 'dd000005-0000-0000-0000-000000000007';
  mat_8 UUID := 'dd000005-0000-0000-0000-000000000008';

  -- Equipment IDs
  eq_crane UUID := 'dd000006-0000-0000-0000-000000000001';
  eq_excavator UUID := 'dd000006-0000-0000-0000-000000000002';
  eq_generator UUID := 'dd000006-0000-0000-0000-000000000003';
  eq_forklift UUID := 'dd000006-0000-0000-0000-000000000004';
  eq_aerial UUID := 'dd000006-0000-0000-0000-000000000005';
  eq_compressor UUID := 'dd000006-0000-0000-0000-000000000006';

  -- Equipment Log IDs
  elog_1 UUID := 'dd000007-0000-0000-0000-000000000001';
  elog_2 UUID := 'dd000007-0000-0000-0000-000000000002';
  elog_3 UUID := 'dd000007-0000-0000-0000-000000000003';
  elog_4 UUID := 'dd000007-0000-0000-0000-000000000004';
  elog_5 UUID := 'dd000007-0000-0000-0000-000000000005';
  elog_6 UUID := 'dd000007-0000-0000-0000-000000000006';
  elog_7 UUID := 'dd000007-0000-0000-0000-000000000007';
  elog_8 UUID := 'dd000007-0000-0000-0000-000000000008';
  elog_9 UUID := 'dd000007-0000-0000-0000-000000000009';
  elog_10 UUID := 'dd000007-0000-0000-0000-000000000010';

  -- Equipment Maintenance IDs
  emaint_1 UUID := 'dd000008-0000-0000-0000-000000000001';
  emaint_2 UUID := 'dd000008-0000-0000-0000-000000000002';
  emaint_3 UUID := 'dd000008-0000-0000-0000-000000000003';
  emaint_4 UUID := 'dd000008-0000-0000-0000-000000000004';

BEGIN

  -- -------------------------------------------------------------------------
  -- Purchase Orders: 1 fully received, 1 partially received, 1 issued
  -- -------------------------------------------------------------------------
  INSERT INTO purchase_orders (id, project_id, vendor_name, vendor_contact, vendor_email, vendor_phone, description, status, subtotal, tax, shipping, total, issued_date, required_date, received_date, delivery_address, notes, approved_by, approved_at, created_by) VALUES
    (po_steel, project_id,
     'Apex Steel Fabricators', 'Tom Reynolds', 'tom@apexsteel.com', '(555) 234 5678',
     'Structural steel package for floors 14 through 18 including wide flange beams, columns, and connection plates.',
     'fully_received', 487500, 38025, 4200, 529725,
     '2026-02-10', '2026-03-01', '2026-02-28',
     '1200 Riverside Drive, Austin TX 78701, Gate B',
     'All members delivered and inspected. Mill certs on file.',
     user_mike, now() - interval '45 days', user_mike),

    (po_mep, project_id,
     'National Mechanical Supply', 'Angela Torres', 'atorres@natmechsupply.com', '(555) 345 6789',
     'MEP rough in materials for floors 8 through 12 including copper pipe, ductwork, and electrical conduit.',
     'partially_received', 156800, 12230, 1850, 170880,
     '2026-03-05', '2026-03-20', NULL,
     '1200 Riverside Drive, Austin TX 78701, Staging Area C',
     'First shipment received March 12. Awaiting backorder on 4 inch copper fittings.',
     user_mike, now() - interval '22 days', user_mike),

    (po_concrete, project_id,
     'Capitol City Ready Mix', 'Marcus Webb', 'mwebb@capitolreadymix.com', '(555) 456 7890',
     'Concrete supply for level 16 deck pour and elevator pit walls. 5000 PSI mix with fiber reinforcement.',
     'issued', 94200, 0, 0, 94200,
     '2026-03-22', '2026-04-05', NULL,
     '1200 Riverside Drive, Austin TX 78701, Pump Staging',
     'Scheduled for two pours: April 5 deck, April 8 pit walls. Confirm pump truck availability.',
     user_mike, now() - interval '5 days', user_mike);

  -- -------------------------------------------------------------------------
  -- PO Line Items: 8 total across 3 POs
  -- -------------------------------------------------------------------------
  INSERT INTO po_line_items (id, purchase_order_id, description, quantity, unit, unit_cost, total_cost, quantity_received, csi_code, sort_order) VALUES
    -- PO Steel (3 line items, all fully received)
    (poli_1, po_steel, 'W14x90 Wide Flange Beams, 30 ft lengths', 48, 'EA', 4850, 232800, 48, '05 12 00', 1),
    (poli_2, po_steel, 'W10x49 Columns, 14 ft lengths', 32, 'EA', 3200, 102400, 32, '05 12 00', 2),
    (poli_3, po_steel, 'Connection plates and hardware kit', 96, 'SET', 1585.42, 152200, 96, '05 12 00', 3),

    -- PO MEP (3 line items, partially received)
    (poli_4, po_mep, '2 inch Type L Copper Pipe, 20 ft sticks', 120, 'EA', 485, 58200, 120, '22 11 00', 1),
    (poli_5, po_mep, 'Galvanized rectangular ductwork sections, assorted', 85, 'EA', 680, 57800, 52, '23 31 00', 2),
    (poli_6, po_mep, '3/4 inch EMT Conduit, 10 ft sticks with fittings', 400, 'EA', 102, 40800, 400, '26 05 00', 3),

    -- PO Concrete (2 line items, none received)
    (poli_7, po_concrete, '5000 PSI Concrete with fiber reinforcement, Level 16 deck', 380, 'CY', 185, 70300, 0, '03 30 00', 1),
    (poli_8, po_concrete, '5000 PSI Concrete, elevator pit walls', 130, 'CY', 183.85, 23900, 0, '03 30 00', 2);

  -- -------------------------------------------------------------------------
  -- Deliveries: 2 deliveries
  -- -------------------------------------------------------------------------
  INSERT INTO deliveries (id, project_id, purchase_order_id, delivery_date, carrier, tracking_number, status, received_by, inspection_notes, photos, packing_slip_url) VALUES
    (del_1, project_id, po_steel,
     '2026-02-28', 'Lone Star Freight', 'LSF-2026-44210',
     'inspected', user_mike,
     'All 176 pieces accounted for. Mill certifications verified against PO specs. Minor surface rust on 3 beams, acceptable per AISC standards. Stored in lay down area B.',
     '["https://storage.sitesync.ai/photos/delivery-steel-01.jpg","https://storage.sitesync.ai/photos/delivery-steel-02.jpg"]',
     'https://storage.sitesync.ai/docs/packing-slip-lsf-44210.pdf'),

    (del_2, project_id, po_mep,
     '2026-03-12', 'ABC Logistics', 'ABC-2026-78455',
     'delivered', user_mike,
     'Partial delivery. All copper pipe and conduit received in good condition. 33 ductwork sections backordered, ETA March 25.',
     '["https://storage.sitesync.ai/photos/delivery-mep-01.jpg"]',
     'https://storage.sitesync.ai/docs/packing-slip-abc-78455.pdf');

  -- -------------------------------------------------------------------------
  -- Delivery Items: 4 items across 2 deliveries
  -- -------------------------------------------------------------------------
  INSERT INTO delivery_items (id, delivery_id, po_line_item_id, quantity_received, quantity_damaged, quantity_backordered, condition, notes, photo_url) VALUES
    (di_1, del_1, poli_1, 48, 0, 0, 'good', 'All beams tagged and stored in lay down area B, row 3.', NULL),
    (di_2, del_1, poli_2, 32, 0, 0, 'good', 'Columns stored upright in lay down area B, row 4.', NULL),
    (di_3, del_2, poli_4, 120, 0, 0, 'good', 'Copper pipe staged in mechanical room, floor 8.', NULL),
    (di_4, del_2, poli_5, 52, 0, 33, 'short', 'Only 52 of 85 duct sections delivered. Remaining 33 backordered. Vendor confirmed March 25 delivery.', 'https://storage.sitesync.ai/photos/delivery-duct-short.jpg');

  -- -------------------------------------------------------------------------
  -- Material Inventory: 8 items with QR codes
  -- -------------------------------------------------------------------------
  INSERT INTO material_inventory (id, project_id, name, category, quantity_on_hand, unit, location, minimum_quantity, qr_code, last_counted_date, last_counted_by) VALUES
    (mat_1, project_id, 'W14x90 Wide Flange Beams, 30 ft', 'Structural Steel', 12, 'EA', 'Lay Down Area B, Row 3', 5, 'QR-MAT-001-BEAM', '2026-03-25', user_mike),
    (mat_2, project_id, '2 inch Type L Copper Pipe, 20 ft', 'Plumbing', 45, 'EA', 'Mechanical Room, Floor 8', 20, 'QR-MAT-002-CPIPE', '2026-03-24', user_mike),
    (mat_3, project_id, '3/4 inch EMT Conduit, 10 ft', 'Electrical', 180, 'EA', 'Electrical Room, Floor 7', 50, 'QR-MAT-003-CONDUIT', '2026-03-24', user_mike),
    (mat_4, project_id, 'Fire Rated Drywall 5/8 inch, 4x8 sheets', 'Drywall', 320, 'EA', 'Material Hoist Landing, Floor 10', 100, 'QR-MAT-004-DRYWALL', '2026-03-23', user_mike),
    (mat_5, project_id, 'Hilti KB3 Expansion Anchors, 1/2 inch', 'Fasteners', 2400, 'EA', 'Tool Crib, Ground Floor', 500, 'QR-MAT-005-ANCHOR', '2026-03-22', user_mike),
    (mat_6, project_id, 'Firestop Sealant, 28 oz tubes', 'Firestopping', 86, 'EA', 'Tool Crib, Ground Floor', 24, 'QR-MAT-006-FSTOP', '2026-03-22', user_mike),
    (mat_7, project_id, 'Rectangular Ductwork Sections, assorted', 'HVAC', 52, 'EA', 'Staging Area C', 30, 'QR-MAT-007-DUCT', '2026-03-25', user_mike),
    (mat_8, project_id, 'Spray Foam Insulation Kits, 600 BF', 'Insulation', 14, 'KIT', 'Staging Area C', 6, 'QR-MAT-008-FOAM', '2026-03-20', user_mike);

  -- -------------------------------------------------------------------------
  -- Equipment: 6 pieces (crane, excavator, generator, forklift, aerial lift, compressor)
  -- -------------------------------------------------------------------------
  INSERT INTO equipment (id, project_id, name, type, make, model, serial_number, year, ownership, vendor, rental_rate_daily, rental_rate_weekly, rental_rate_monthly, status, current_location, current_project_id, hours_meter, last_service_date, next_service_due, qr_code, insurance_policy, insurance_expiry, photos) VALUES
    (eq_crane, project_id,
     'Tower Crane #1', 'crane', 'Liebherr', '280 EC-H 12', 'LH-280-2022-44891', 2022,
     'rented', 'Bigge Crane and Rigging', 2800, 14000, 42000,
     'active', 'Tower Position A, Grid Line 4/D', project_id,
     4280, '2026-03-01', '2026-04-01',
     'QR-EQ-001-CRANE', 'BGCR-INS-2026-1100', '2026-12-31',
     '["https://storage.sitesync.ai/photos/crane-01.jpg"]'),

    (eq_excavator, project_id,
     'CAT 320 Excavator', 'excavator', 'Caterpillar', '320 GC', 'CAT-320-2021-78112', 2021,
     'rented', 'Sunbelt Rentals', 1200, 4800, 12500,
     'idle', 'Equipment Yard, South Lot', project_id,
     6840, '2026-02-15', '2026-04-15',
     'QR-EQ-002-EXCAV', 'SBR-INS-2026-5540', '2026-09-30',
     '["https://storage.sitesync.ai/photos/excavator-01.jpg"]'),

    (eq_generator, project_id,
     'Temporary Power Generator', 'generator', 'Cummins', 'C500 D5', 'CUM-500-2023-33200', 2023,
     'rented', 'United Rentals', 450, 1800, 4500,
     'active', 'Generator Pad, East Side', project_id,
     3120, '2026-03-10', '2026-04-10',
     'QR-EQ-003-GENSET', 'UR-INS-2026-8820', '2026-11-15',
     '[]'),

    (eq_forklift, project_id,
     'Telehandler 10K', 'forklift', 'JLG', '1255', 'JLG-1255-2020-55410', 2020,
     'rented', 'Sunbelt Rentals', 650, 2600, 6800,
     'active', 'Loading Dock, North', project_id,
     5460, '2026-03-05', '2026-04-05',
     'QR-EQ-004-TELEH', 'SBR-INS-2026-5541', '2026-09-30',
     '[]'),

    (eq_aerial, project_id,
     'Boom Lift 60 ft', 'aerial_lift', 'JLG', '600S', 'JLG-600S-2022-67800', 2022,
     'rented', 'United Rentals', 550, 2200, 5500,
     'active', 'South Elevation, Ground Level', project_id,
     2890, '2026-02-20', '2026-04-20',
     'QR-EQ-005-BOOM', 'UR-INS-2026-8821', '2026-11-15',
     '[]'),

    (eq_compressor, project_id,
     'Air Compressor 185 CFM', 'compressor', 'Atlas Copco', 'XAS 185', 'AC-185-2021-89100', 2021,
     'owned', NULL, NULL, NULL, NULL,
     'maintenance', 'Maintenance Shop, Off Site', project_id,
     4100, '2026-01-15', '2026-03-15',
     'QR-EQ-006-COMP', 'SSAI-INS-2026-0050', '2027-01-01',
     '[]');

  -- -------------------------------------------------------------------------
  -- Equipment Logs: 10 entries
  -- -------------------------------------------------------------------------
  INSERT INTO equipment_logs (id, equipment_id, date, hours_used, fuel_gallons, fuel_cost, operator_id, project_id, notes) VALUES
    (elog_1, eq_crane, '2026-03-25', 9.5, NULL, NULL, user_mike, project_id, 'Steel erection floor 17. 14 picks completed. Wind within limits all day.'),
    (elog_2, eq_crane, '2026-03-26', 8.0, NULL, NULL, user_mike, project_id, 'Steel erection floor 17 continued. Curtain wall panel lifts in afternoon.'),
    (elog_3, eq_crane, '2026-03-27', 10.0, NULL, NULL, user_mike, project_id, 'Floor 18 steel started. 12 beam picks, 6 column sets. Overtime shift.'),
    (elog_4, eq_excavator, '2026-03-20', 6.5, 42, 138.60, user_mike, project_id, 'Utility trench excavation along south property line. Hit existing storm line, rerouted.'),
    (elog_5, eq_excavator, '2026-03-21', 7.0, 45, 148.50, user_mike, project_id, 'Backfill and compaction of utility trench. Compaction tests passed.'),
    (elog_6, eq_generator, '2026-03-25', 24.0, 85, 297.50, NULL, project_id, 'Full day runtime providing temporary power to floors 12 through 16.'),
    (elog_7, eq_generator, '2026-03-26', 24.0, 82, 287.00, NULL, project_id, 'Continuous operation. Fuel delivery scheduled for March 28.'),
    (elog_8, eq_forklift, '2026-03-25', 5.5, 12, 39.60, user_mike, project_id, 'Material handling: drywall delivery to hoist, ductwork to staging area.'),
    (elog_9, eq_forklift, '2026-03-26', 6.0, 14, 46.20, user_mike, project_id, 'Unloaded copper pipe delivery. Moved steel plates from lay down to hoist.'),
    (elog_10, eq_aerial, '2026-03-25', 7.5, 8, 26.40, user_mike, project_id, 'Curtain wall installation support, south elevation floors 8 through 10.');

  -- -------------------------------------------------------------------------
  -- Equipment Maintenance: 2 completed, 1 scheduled, 1 in progress
  -- -------------------------------------------------------------------------
  INSERT INTO equipment_maintenance (id, equipment_id, type, description, status, scheduled_date, completed_date, cost, vendor, parts_used, performed_by, next_due_date, next_due_hours) VALUES
    (emaint_1, eq_crane, 'preventive',
     'Monthly tower crane inspection. Wire rope inspection, load test, electrical systems check, lubrication of slew ring and hoist mechanisms.',
     'completed', '2026-03-01', '2026-03-01', 3200,
     'Bigge Crane and Rigging',
     '[{"part":"Wire rope lubricant","qty":2},{"part":"Hydraulic filter","qty":1},{"part":"Slew ring grease cartridge","qty":4}]',
     'Bigge Field Service Tech', '2026-04-01', 4500),

    (emaint_2, eq_forklift, 'preventive',
     '500 hour service. Engine oil and filter change, hydraulic fluid top off, tire inspection, boom pin lubrication.',
     'completed', '2026-03-05', '2026-03-05', 680,
     'Sunbelt Rentals',
     '[{"part":"Engine oil 15W40","qty":3},{"part":"Oil filter","qty":1},{"part":"Hydraulic fluid","qty":2}]',
     'Sunbelt Mobile Tech', '2026-04-05', 5960),

    (emaint_3, eq_compressor, 'corrective',
     'Compressor shutting down on high temperature fault. Suspected radiator blockage or thermostat failure. Pulled from service for diagnosis.',
     'in_progress', '2026-03-26', NULL, NULL,
     NULL,
     '[]',
     'Riverside Equipment Repair', NULL, NULL),

    (emaint_4, eq_crane, 'inspection',
     'Quarterly crane inspection per OSHA 1926.1413. Third party certified inspector required. Full structural, mechanical, and electrical evaluation.',
     'scheduled', '2026-04-01', NULL, NULL,
     NULL,
     '[]',
     NULL, '2026-07-01', NULL);

END $$;
