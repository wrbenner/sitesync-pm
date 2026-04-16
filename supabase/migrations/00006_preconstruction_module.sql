-- =============================================================================
-- SiteSync AI: Preconstruction Module
-- Estimating, bid management, quantity takeoffs, and cost databases.
-- Full support for conceptual through CD level estimates, bid leveling,
-- and digital takeoff workflows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend notification types to support preconstruction events
-- ---------------------------------------------------------------------------

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'rfi_assigned', 'submittal_review', 'punch_item',
    'task_update', 'meeting_reminder', 'ai_alert',
    'daily_log_approval',
    'safety_inspection_failed', 'safety_corrective_action',
    'incident_reported', 'certification_expiring',
    'estimate_submitted', 'bid_package_issued',
    'bid_response_received', 'bid_due_reminder'
  ));

-- Extend activity feed types
ALTER TABLE activity_feed
  DROP CONSTRAINT IF EXISTS activity_feed_type_check;

ALTER TABLE activity_feed
  ADD CONSTRAINT activity_feed_type_check CHECK (type IN (
    'rfi_created', 'submittal_updated', 'task_moved',
    'file_uploaded', 'daily_log_approved', 'punch_resolved',
    'comment_added', 'change_order_submitted', 'meeting_scheduled',
    'safety_inspection_completed', 'incident_reported',
    'toolbox_talk_conducted', 'safety_observation_logged',
    'estimate_created', 'estimate_submitted', 'bid_package_issued',
    'bid_response_received', 'bid_awarded', 'takeoff_completed'
  ));

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Estimates
CREATE TABLE estimates (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name                text NOT NULL,
    version             int DEFAULT 1,
    status              text DEFAULT 'draft' CHECK (status IN (
                            'draft', 'in_review', 'submitted', 'awarded', 'lost'
                        )),
    type                text CHECK (type IN (
                            'conceptual', 'schematic', 'design_development',
                            'construction_documents', 'change_order'
                        )),
    total_amount        numeric DEFAULT 0,
    markup_percent      numeric DEFAULT 0,
    overhead_percent    numeric DEFAULT 0,
    profit_percent      numeric DEFAULT 0,
    bond_percent        numeric DEFAULT 0,
    tax_rate            numeric DEFAULT 0,
    contingency_percent numeric DEFAULT 0,
    due_date            date,
    submitted_date      date,
    notes               text,
    created_by          uuid REFERENCES auth.users,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Estimate Line Items (child of estimates, self referencing for hierarchy)
CREATE TABLE estimate_line_items (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id         uuid NOT NULL REFERENCES estimates ON DELETE CASCADE,
    parent_id           uuid REFERENCES estimate_line_items,
    csi_division        text,
    csi_code            text,
    description         text NOT NULL,
    unit                text CHECK (unit IN (
                            'sf', 'lf', 'cy', 'ea', 'ls', 'hr', 'ton', 'gal'
                        )),
    quantity            numeric,
    unit_cost           numeric,
    total_cost          numeric,
    labor_hours         numeric,
    labor_rate          numeric,
    labor_cost          numeric,
    material_cost       numeric,
    equipment_cost      numeric,
    subcontractor_cost  numeric,
    markup              numeric DEFAULT 0,
    notes               text,
    sort_order          int,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Bid Packages
CREATE TABLE bid_packages (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id               uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name                     text NOT NULL,
    trade                    text,
    scope_description        text,
    status                   text DEFAULT 'draft' CHECK (status IN (
                                 'draft', 'issued', 'responses_received', 'leveled', 'awarded'
                             )),
    issue_date               date,
    due_date                 date,
    pre_bid_meeting_date     date,
    pre_bid_meeting_location text,
    documents                jsonb DEFAULT '[]',
    addenda                  jsonb DEFAULT '[]',
    created_by               uuid REFERENCES auth.users,
    created_at               timestamptz DEFAULT now(),
    updated_at               timestamptz DEFAULT now()
);

-- Bid Invitations (child of bid_packages)
CREATE TABLE bid_invitations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_package_id      uuid NOT NULL REFERENCES bid_packages ON DELETE CASCADE,
    subcontractor_name  text NOT NULL,
    company             text,
    contact_email       text,
    contact_phone       text,
    status              text DEFAULT 'invited' CHECK (status IN (
                            'invited', 'viewed', 'declined', 'submitted'
                        )),
    invited_at          timestamptz DEFAULT now(),
    viewed_at           timestamptz,
    submitted_at        timestamptz,
    decline_reason      text
);

-- Bid Responses (child of bid_packages)
CREATE TABLE bid_responses (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_package_id      uuid NOT NULL REFERENCES bid_packages ON DELETE CASCADE,
    bid_invitation_id   uuid REFERENCES bid_invitations,
    subcontractor_name  text NOT NULL,
    company             text,
    base_bid            numeric,
    alternate_1         numeric,
    alternate_2         numeric,
    alternate_3         numeric,
    unit_prices         jsonb DEFAULT '{}',
    exclusions          text,
    inclusions          text,
    schedule_days       int,
    bond_included       boolean DEFAULT false,
    document_urls       jsonb DEFAULT '[]',
    notes               text,
    ai_analysis         text,
    created_at          timestamptz DEFAULT now()
);

-- Takeoff Items (linked to drawings for spatial context)
CREATE TABLE takeoff_items (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    drawing_id          uuid REFERENCES drawings,
    name                text NOT NULL,
    category            text,
    measurement_type    text CHECK (measurement_type IN (
                            'area', 'linear', 'count', 'volume'
                        )),
    quantity            numeric,
    unit                text,
    color               text,
    layer               text,
    points              jsonb DEFAULT '[]',
    created_by          uuid REFERENCES auth.users,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Cost Database (organization wide reference data)
CREATE TABLE cost_database (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid,
    csi_code                text,
    description             text NOT NULL,
    unit                    text,
    unit_cost               numeric,
    labor_hours_per_unit    numeric,
    labor_rate              numeric,
    material_cost_per_unit  numeric,
    equipment_cost_per_unit numeric,
    region                  text,
    year                    int,
    source                  text,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Estimates
CREATE INDEX idx_estimates_project_id   ON estimates (project_id);
CREATE INDEX idx_estimates_status       ON estimates (status);
CREATE INDEX idx_estimates_type         ON estimates (type);
CREATE INDEX idx_estimates_created_by   ON estimates (created_by);
CREATE INDEX idx_estimates_due_date     ON estimates (due_date);

-- Estimate line items
CREATE INDEX idx_estimate_line_items_estimate_id  ON estimate_line_items (estimate_id);
CREATE INDEX idx_estimate_line_items_parent_id    ON estimate_line_items (parent_id);
CREATE INDEX idx_estimate_line_items_csi_division ON estimate_line_items (csi_division);
CREATE INDEX idx_estimate_line_items_csi_code     ON estimate_line_items (csi_code);
CREATE INDEX idx_estimate_line_items_sort_order   ON estimate_line_items (estimate_id, sort_order);

-- Bid packages
CREATE INDEX idx_bid_packages_project_id  ON bid_packages (project_id);
CREATE INDEX idx_bid_packages_status      ON bid_packages (status);
CREATE INDEX idx_bid_packages_trade       ON bid_packages (trade);
CREATE INDEX idx_bid_packages_due_date    ON bid_packages (due_date);
CREATE INDEX idx_bid_packages_created_by  ON bid_packages (created_by);

-- Bid invitations
CREATE INDEX idx_bid_invitations_bid_package_id  ON bid_invitations (bid_package_id);
CREATE INDEX idx_bid_invitations_status          ON bid_invitations (status);
CREATE INDEX idx_bid_invitations_contact_email   ON bid_invitations (contact_email);

-- Bid responses
CREATE INDEX idx_bid_responses_bid_package_id    ON bid_responses (bid_package_id);
CREATE INDEX idx_bid_responses_bid_invitation_id ON bid_responses (bid_invitation_id);
CREATE INDEX idx_bid_responses_base_bid          ON bid_responses (base_bid);

-- Takeoff items
CREATE INDEX idx_takeoff_items_project_id        ON takeoff_items (project_id);
CREATE INDEX idx_takeoff_items_drawing_id        ON takeoff_items (drawing_id);
CREATE INDEX idx_takeoff_items_category          ON takeoff_items (category);
CREATE INDEX idx_takeoff_items_measurement_type  ON takeoff_items (measurement_type);
CREATE INDEX idx_takeoff_items_created_by        ON takeoff_items (created_by);

-- Cost database
CREATE INDEX idx_cost_database_organization_id   ON cost_database (organization_id);
CREATE INDEX idx_cost_database_csi_code          ON cost_database (csi_code);
CREATE INDEX idx_cost_database_region            ON cost_database (region);
CREATE INDEX idx_cost_database_year              ON cost_database (year);
CREATE INDEX idx_cost_database_description_trgm  ON cost_database USING gin (description gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 4. Updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_estimates_updated_at
    BEFORE UPDATE ON estimates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_estimate_line_items_updated_at
    BEFORE UPDATE ON estimate_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bid_packages_updated_at
    BEFORE UPDATE ON bid_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_takeoff_items_updated_at
    BEFORE UPDATE ON takeoff_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cost_database_updated_at
    BEFORE UPDATE ON cost_database
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE estimates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_invitations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_responses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_database        ENABLE ROW LEVEL SECURITY;

-- 5a. Project scoped policies for tables with project_id
-- (estimates, bid_packages, takeoff_items)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'estimates', 'bid_packages', 'takeoff_items'
        ])
    LOOP
        -- SELECT: any project member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT USING (is_project_member(project_id))',
            tbl || '_select', tbl
        );

        -- INSERT: owner, admin, or member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY[''owner'', ''admin'', ''member'']))',
            tbl || '_insert', tbl
        );

        -- UPDATE: owner, admin, or member
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR UPDATE USING (is_project_role(project_id, ARRAY[''owner'', ''admin'', ''member'']))',
            tbl || '_update', tbl
        );

        -- DELETE: owner or admin only
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR DELETE USING (is_project_role(project_id, ARRAY[''owner'', ''admin'']))',
            tbl || '_delete', tbl
        );
    END LOOP;
END
$$;

-- 5b. estimate_line_items: project_id resolved through parent estimates
CREATE POLICY estimate_line_items_select ON estimate_line_items FOR SELECT
    USING (is_project_member(
        (SELECT project_id FROM estimates WHERE estimates.id = estimate_id)
    ));

CREATE POLICY estimate_line_items_insert ON estimate_line_items FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM estimates WHERE estimates.id = estimate_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY estimate_line_items_update ON estimate_line_items FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM estimates WHERE estimates.id = estimate_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY estimate_line_items_delete ON estimate_line_items FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM estimates WHERE estimates.id = estimate_id),
        ARRAY['owner', 'admin']
    ));

-- 5c. bid_invitations: project_id resolved through parent bid_packages
CREATE POLICY bid_invitations_select ON bid_invitations FOR SELECT
    USING (is_project_member(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id)
    ));

CREATE POLICY bid_invitations_insert ON bid_invitations FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY bid_invitations_update ON bid_invitations FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY bid_invitations_delete ON bid_invitations FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id),
        ARRAY['owner', 'admin']
    ));

-- 5d. bid_responses: project_id resolved through parent bid_packages
CREATE POLICY bid_responses_select ON bid_responses FOR SELECT
    USING (is_project_member(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id)
    ));

CREATE POLICY bid_responses_insert ON bid_responses FOR INSERT
    WITH CHECK (is_project_role(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY bid_responses_update ON bid_responses FOR UPDATE
    USING (is_project_role(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id),
        ARRAY['owner', 'admin', 'member']
    ));

CREATE POLICY bid_responses_delete ON bid_responses FOR DELETE
    USING (is_project_role(
        (SELECT project_id FROM bid_packages WHERE bid_packages.id = bid_package_id),
        ARRAY['owner', 'admin']
    ));

-- 5e. cost_database: readable by all authenticated users, writable by admins only
CREATE POLICY cost_database_select ON cost_database FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY cost_database_insert ON cost_database FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY cost_database_update ON cost_database FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY cost_database_delete ON cost_database FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- 6. Reference Data
-- ---------------------------------------------------------------------------

-- Cost Database: global reference data (30 entries with real CSI codes)
INSERT INTO cost_database (csi_code, description, unit, unit_cost, labor_hours_per_unit, labor_rate, material_cost_per_unit, equipment_cost_per_unit, region, year, source) VALUES
-- Division 03: Concrete
('03 11 13', 'Concrete formwork, walls (to 8 ft)', 'sf', 12.50, 0.12, 78, 3.80, 0.45, 'Pacific Northwest', 2026, 'RSMeans'),
('03 11 23', 'Concrete formwork, columns (round)', 'lf', 28.00, 0.25, 78, 12.50, 0.80, 'Pacific Northwest', 2026, 'RSMeans'),
('03 21 00', 'Reinforcing steel, #4 to #7 bars', 'ton', 2200.00, 8.00, 88, 1100.00, 45.00, 'Pacific Northwest', 2026, 'RSMeans'),
('03 22 00', 'Welded wire reinforcement', 'sf', 1.85, 0.008, 78, 0.95, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('03 31 00', 'Structural concrete, 4000 psi', 'cy', 425.00, 2.50, 92, 165.00, 52.00, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 04: Masonry
('04 22 10', 'Concrete block wall, 8 inch', 'sf', 18.50, 0.18, 78, 6.20, 0.35, 'Pacific Northwest', 2026, 'RSMeans'),
('04 22 10.14', 'Concrete block wall, 12 inch', 'sf', 22.00, 0.20, 78, 8.40, 0.40, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 05: Metals
('05 12 23', 'Structural steel, W shapes', 'ton', 4200.00, 8.00, 95, 2800.00, 200.00, 'Pacific Northwest', 2026, 'RSMeans'),
('05 12 23.40', 'Structural steel, HSS columns', 'ton', 4800.00, 9.00, 95, 3200.00, 225.00, 'Pacific Northwest', 2026, 'RSMeans'),
('05 31 13', 'Steel floor deck, composite 3 inch', 'sf', 8.25, 0.05, 82, 4.50, 0.15, 'Pacific Northwest', 2026, 'RSMeans'),
('05 51 00', 'Metal stairs, steel pan with concrete fill', 'riser', 385.00, 1.20, 90, 210.00, 15.00, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 06: Wood
('06 10 00', 'Rough carpentry, 2x blocking', 'lf', 4.50, 0.06, 72, 1.80, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('06 41 00', 'Architectural casework, plastic laminate', 'lf', 425.00, 2.50, 72, 280.00, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 07: Thermal and Moisture Protection
('07 21 13', 'Batt insulation, R19 walls', 'sf', 2.10, 0.012, 72, 0.95, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('07 21 29', 'Spray foam insulation, 2 inch closed cell', 'sf', 5.25, 0.015, 72, 3.80, 0.10, 'Pacific Northwest', 2026, 'RSMeans'),
('07 41 13', 'Metal wall panels, insulated', 'sf', 32.00, 0.10, 88, 22.00, 0.50, 'Pacific Northwest', 2026, 'RSMeans'),
('07 54 00', 'TPO roofing membrane, 60 mil', 'sf', 8.50, 0.04, 75, 4.20, 0.25, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 08: Openings
('08 11 13', 'Hollow metal doors and frames, 3x7', 'ea', 1200.00, 2.00, 82, 850.00, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('08 44 13', 'Curtain wall, aluminum and glass', 'sf', 88.00, 0.30, 90, 58.00, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 09: Finishes
('09 29 10', 'Gypsum board on metal studs, 1 layer', 'sf', 8.50, 0.05, 75, 3.20, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('09 30 13', 'Ceramic tile, floor, standard', 'sf', 16.00, 0.12, 72, 8.50, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('09 51 00', 'Acoustical ceiling tile, 2x4 grid', 'sf', 6.75, 0.03, 72, 3.50, 0.10, 'Pacific Northwest', 2026, 'RSMeans'),
('09 65 13', 'Luxury vinyl tile (LVT)', 'sf', 9.50, 0.04, 72, 5.80, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('09 68 13', 'Carpet tile, commercial grade', 'sf', 7.25, 0.03, 72, 4.50, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('09 91 23', 'Interior painting, 2 coats', 'sf', 3.25, 0.025, 68, 0.85, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 22: Plumbing
('22 11 16', 'Domestic water piping, copper 3/4 inch', 'lf', 28.00, 0.15, 92, 14.50, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('22 42 13', 'Lavatory, wall hung, commercial', 'ea', 1150.00, 4.00, 92, 680.00, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 23: HVAC
('23 37 13', 'Air handling unit, 10000 CFM', 'ea', 42000.00, 80.00, 95, 28000.00, 500.00, 'Pacific Northwest', 2026, 'RSMeans'),
('23 31 13', 'HVAC ductwork, galvanized sheet metal', 'lb', 12.50, 0.08, 92, 4.80, 0.15, 'Pacific Northwest', 2026, 'RSMeans'),

-- Division 26: Electrical
('26 24 16', 'Panelboard, 225A, 42 circuit', 'ea', 4800.00, 16.00, 95, 3200.00, 0.00, 'Pacific Northwest', 2026, 'RSMeans'),
('26 51 13', 'LED light fixture, 2x4 troffer', 'ea', 385.00, 1.50, 95, 245.00, 0.00, 'Pacific Northwest', 2026, 'RSMeans');
