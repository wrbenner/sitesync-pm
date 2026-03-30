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
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY cost_database_update ON cost_database FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY cost_database_delete ON cost_database FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- 6. Seed Data
-- ---------------------------------------------------------------------------

-- Use a consistent project_id for all seed data
-- Matches the existing demo project used across the platform

DO $$
DECLARE
    v_project_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    -- Estimate IDs
    v_est_draft     uuid := '10000000-0000-0000-0000-000000000001';
    v_est_submitted uuid := '10000000-0000-0000-0000-000000000002';
    v_est_awarded   uuid := '10000000-0000-0000-0000-000000000003';

    -- Bid package IDs
    v_bp_steel uuid := '20000000-0000-0000-0000-000000000001';
    v_bp_mep   uuid := '20000000-0000-0000-0000-000000000002';

    -- Bid invitation IDs (for linking responses)
    v_inv_steel_1 uuid := '30000000-0000-0000-0000-000000000001';
    v_inv_steel_2 uuid := '30000000-0000-0000-0000-000000000002';
    v_inv_steel_3 uuid := '30000000-0000-0000-0000-000000000003';
    v_inv_mep_1   uuid := '30000000-0000-0000-0000-000000000004';
    v_inv_mep_2   uuid := '30000000-0000-0000-0000-000000000005';
    v_inv_mep_3   uuid := '30000000-0000-0000-0000-000000000006';

BEGIN

-- -------------------------------------------------------------------------
-- 6a. Estimates
-- -------------------------------------------------------------------------

INSERT INTO estimates (id, project_id, name, version, status, type, total_amount, markup_percent, overhead_percent, profit_percent, bond_percent, tax_rate, contingency_percent, due_date, submitted_date, notes) VALUES
(v_est_draft, v_project_id, 'Riverside Tower Conceptual Estimate', 1, 'draft', 'conceptual', 28500000, 5, 8, 6, 1.5, 8.25, 10, '2026-04-15', NULL, 'Early stage conceptual estimate based on program and site analysis. Square footage costs derived from comparable projects in the metro area.'),
(v_est_submitted, v_project_id, 'Riverside Tower SD Estimate v2', 2, 'submitted', 'schematic', 31200000, 5, 7.5, 5, 1.5, 8.25, 7, '2026-03-01', '2026-02-28', 'Schematic design estimate incorporating structural system selection and initial MEP layouts. Updated based on geotech report findings.'),
(v_est_awarded, v_project_id, 'Riverside Tower DD Estimate Final', 3, 'awarded', 'design_development', 33750000, 4, 7, 5, 1.5, 8.25, 5, '2026-01-15', '2026-01-14', 'Design development estimate with detailed quantity takeoffs. Incorporates value engineering recommendations from Phase 2 review.');

-- -------------------------------------------------------------------------
-- 6b. Estimate Line Items: Draft Conceptual Estimate (15 items)
-- -------------------------------------------------------------------------

INSERT INTO estimate_line_items (estimate_id, csi_division, csi_code, description, unit, quantity, unit_cost, total_cost, labor_hours, labor_rate, labor_cost, material_cost, equipment_cost, subcontractor_cost, markup, sort_order) VALUES
(v_est_draft, '02', '02 41 00', 'Site demolition and clearing', 'ls', 1, 185000, 185000, 320, 85, 27200, 12000, 45800, 100000, 5, 1),
(v_est_draft, '03', '03 30 00', 'Cast in place concrete (foundations and slabs)', 'cy', 4200, 425, 1785000, 12600, 92, 1159200, 378000, 247800, 0, 5, 2),
(v_est_draft, '03', '03 11 00', 'Concrete formwork', 'sf', 68000, 12.50, 850000, 8500, 78, 663000, 136000, 51000, 0, 5, 3),
(v_est_draft, '03', '03 20 00', 'Concrete reinforcing steel', 'ton', 380, 2100, 798000, 3040, 88, 267520, 494000, 36480, 0, 5, 4),
(v_est_draft, '05', '05 12 00', 'Structural steel framing', 'ton', 1850, 4200, 7770000, 14800, 95, 1406000, 4625000, 370000, 1369000, 4, 5),
(v_est_draft, '05', '05 50 00', 'Metal fabrications (stairs, railings, misc)', 'ls', 1, 420000, 420000, 2100, 90, 189000, 168000, 21000, 42000, 5, 6),
(v_est_draft, '07', '07 21 00', 'Building insulation', 'sf', 95000, 4.75, 451250, 2850, 72, 205200, 199500, 0, 46550, 5, 7),
(v_est_draft, '07', '07 41 00', 'Metal wall panels and curtain wall', 'sf', 42000, 65, 2730000, 12600, 88, 1108800, 1260000, 0, 361200, 5, 8),
(v_est_draft, '08', '08 11 00', 'Metal doors and frames', 'ea', 185, 1200, 222000, 370, 82, 30340, 166500, 0, 25160, 5, 9),
(v_est_draft, '08', '08 44 00', 'Curtain wall glazing system', 'sf', 38000, 85, 3230000, 11400, 90, 1026000, 1520000, 0, 684000, 4, 10),
(v_est_draft, '09', '09 29 00', 'Gypsum board assemblies', 'sf', 120000, 8.50, 1020000, 6000, 75, 450000, 420000, 0, 150000, 5, 11),
(v_est_draft, '09', '09 65 00', 'Resilient flooring', 'sf', 45000, 12, 540000, 2250, 72, 162000, 270000, 0, 108000, 5, 12),
(v_est_draft, '09', '09 91 00', 'Painting and coating', 'sf', 185000, 3.25, 601250, 4625, 68, 314500, 148000, 0, 138750, 5, 13),
(v_est_draft, '22', '22 11 00', 'Plumbing piping and fixtures', 'ls', 1, 2850000, 2850000, 18000, 92, 1656000, 855000, 0, 339000, 5, 14),
(v_est_draft, '26', '26 05 00', 'Electrical power distribution', 'ls', 1, 3400000, 3400000, 22000, 95, 2090000, 1020000, 0, 290000, 5, 15);

-- -------------------------------------------------------------------------
-- 6c. Estimate Line Items: Submitted SD Estimate (18 items)
-- -------------------------------------------------------------------------

INSERT INTO estimate_line_items (estimate_id, csi_division, csi_code, description, unit, quantity, unit_cost, total_cost, labor_hours, labor_rate, labor_cost, material_cost, equipment_cost, subcontractor_cost, markup, sort_order) VALUES
(v_est_submitted, '01', '01 10 00', 'General requirements and conditions', 'ls', 1, 2340000, 2340000, 15600, 85, 1326000, 468000, 234000, 312000, 5, 1),
(v_est_submitted, '02', '02 41 00', 'Site demolition and earthwork', 'ls', 1, 225000, 225000, 400, 85, 34000, 18000, 68000, 105000, 5, 2),
(v_est_submitted, '03', '03 11 00', 'Concrete formwork systems', 'sf', 72000, 13, 936000, 9000, 78, 702000, 144000, 54000, 36000, 5, 3),
(v_est_submitted, '03', '03 20 00', 'Reinforcing steel and post tensioning', 'ton', 420, 2200, 924000, 3360, 88, 295680, 537600, 42720, 48000, 5, 4),
(v_est_submitted, '03', '03 30 00', 'Cast in place concrete', 'cy', 4800, 440, 2112000, 14400, 92, 1324800, 432000, 283200, 72000, 5, 5),
(v_est_submitted, '04', '04 22 00', 'Concrete unit masonry', 'sf', 18000, 22, 396000, 3600, 78, 280800, 90000, 0, 25200, 5, 6),
(v_est_submitted, '05', '05 12 00', 'Structural steel framing', 'ton', 1920, 4350, 8352000, 15360, 95, 1459200, 4800000, 384000, 1708800, 4, 7),
(v_est_submitted, '05', '05 31 00', 'Steel decking', 'sf', 85000, 8, 680000, 4250, 82, 348500, 255000, 0, 76500, 5, 8),
(v_est_submitted, '06', '06 10 00', 'Rough carpentry and blocking', 'ls', 1, 180000, 180000, 2400, 72, 172800, 54000, 0, 0, 5, 9),
(v_est_submitted, '07', '07 21 00', 'Building insulation (thermal and acoustic)', 'sf', 98000, 5, 490000, 2940, 72, 211680, 205800, 0, 72520, 5, 10),
(v_est_submitted, '07', '07 41 00', 'Metal panel and curtain wall system', 'sf', 44000, 68, 2992000, 13200, 88, 1161600, 1320000, 0, 510400, 5, 11),
(v_est_submitted, '08', '08 44 00', 'Glazing and storefront systems', 'sf', 40000, 88, 3520000, 12000, 90, 1080000, 1600000, 0, 840000, 4, 12),
(v_est_submitted, '09', '09 29 00', 'Gypsum board and metal framing', 'sf', 128000, 9, 1152000, 6400, 75, 480000, 448000, 0, 224000, 5, 13),
(v_est_submitted, '09', '09 65 00', 'Flooring (resilient, tile, carpet)', 'sf', 52000, 14, 728000, 2600, 72, 187200, 364000, 0, 176800, 5, 14),
(v_est_submitted, '22', '22 00 00', 'Plumbing systems complete', 'ls', 1, 3100000, 3100000, 19500, 92, 1794000, 930000, 0, 376000, 5, 15),
(v_est_submitted, '23', '23 00 00', 'HVAC systems complete', 'ls', 1, 4200000, 4200000, 26000, 95, 2470000, 1260000, 126000, 344000, 5, 16),
(v_est_submitted, '26', '26 00 00', 'Electrical systems complete', 'ls', 1, 3800000, 3800000, 24000, 95, 2280000, 1140000, 0, 380000, 5, 17),
(v_est_submitted, '31', '31 23 00', 'Excavation and backfill', 'cy', 12000, 18, 216000, 1200, 75, 90000, 0, 96000, 30000, 5, 18);

-- -------------------------------------------------------------------------
-- 6d. Estimate Line Items: Awarded DD Estimate (20 items)
-- -------------------------------------------------------------------------

INSERT INTO estimate_line_items (estimate_id, csi_division, csi_code, description, unit, quantity, unit_cost, total_cost, labor_hours, labor_rate, labor_cost, material_cost, equipment_cost, subcontractor_cost, markup, sort_order) VALUES
(v_est_awarded, '01', '01 10 00', 'General conditions and requirements', 'ls', 1, 2520000, 2520000, 16800, 85, 1428000, 504000, 252000, 336000, 4, 1),
(v_est_awarded, '02', '02 41 00', 'Demolition, earthwork, and site prep', 'ls', 1, 245000, 245000, 420, 85, 35700, 19600, 73500, 116200, 4, 2),
(v_est_awarded, '03', '03 11 00', 'Concrete formwork (all types)', 'sf', 74000, 13.25, 980500, 9250, 78, 721500, 148000, 55500, 55500, 4, 3),
(v_est_awarded, '03', '03 20 00', 'Rebar and post tension tendons', 'ton', 445, 2250, 1001250, 3560, 88, 313280, 556250, 44563, 87157, 4, 4),
(v_est_awarded, '03', '03 30 00', 'Cast in place concrete (all elements)', 'cy', 5100, 445, 2269500, 15300, 92, 1407600, 459000, 295800, 107100, 4, 5),
(v_est_awarded, '04', '04 22 00', 'Concrete masonry units', 'sf', 19500, 23, 448500, 3900, 78, 304200, 97500, 0, 46800, 4, 6),
(v_est_awarded, '05', '05 12 00', 'Structural steel (W shapes and HSS)', 'ton', 1980, 4400, 8712000, 15840, 95, 1504800, 4950000, 396000, 1861200, 4, 7),
(v_est_awarded, '05', '05 31 00', 'Steel deck (composite and roof)', 'sf', 88000, 8.25, 726000, 4400, 82, 360800, 264000, 0, 101200, 4, 8),
(v_est_awarded, '05', '05 50 00', 'Miscellaneous metals and fabrications', 'ls', 1, 485000, 485000, 2425, 90, 218250, 194000, 24250, 48500, 4, 9),
(v_est_awarded, '06', '06 10 00', 'Rough carpentry, blocking, and backing', 'ls', 1, 195000, 195000, 2600, 72, 187200, 58500, 0, 0, 4, 10),
(v_est_awarded, '07', '07 21 00', 'Insulation (spray foam and batt)', 'sf', 102000, 5.25, 535500, 3060, 72, 220320, 214200, 0, 100980, 4, 11),
(v_est_awarded, '07', '07 41 00', 'Exterior envelope (panels and curtain wall)', 'sf', 45000, 70, 3150000, 13500, 88, 1188000, 1350000, 0, 612000, 4, 12),
(v_est_awarded, '08', '08 11 00', 'Metal doors, frames, and hardware', 'ea', 210, 1350, 283500, 420, 82, 34440, 189000, 0, 60060, 4, 13),
(v_est_awarded, '08', '08 44 00', 'Curtain wall and glazing systems', 'sf', 42000, 90, 3780000, 12600, 90, 1134000, 1680000, 0, 966000, 4, 14),
(v_est_awarded, '09', '09 29 00', 'Interior partitions (GWB on metal stud)', 'sf', 135000, 9.50, 1282500, 6750, 75, 506250, 472500, 0, 303750, 4, 15),
(v_est_awarded, '09', '09 30 00', 'Ceramic and porcelain tile', 'sf', 12000, 18, 216000, 1800, 72, 129600, 72000, 0, 14400, 4, 16),
(v_est_awarded, '09', '09 65 00', 'Flooring (LVT, carpet, rubber)', 'sf', 55000, 14.50, 797500, 2750, 72, 198000, 385000, 0, 214500, 4, 17),
(v_est_awarded, '22', '22 00 00', 'Plumbing (supply, waste, fixtures)', 'ls', 1, 3350000, 3350000, 21000, 92, 1932000, 1005000, 0, 413000, 4, 18),
(v_est_awarded, '23', '23 00 00', 'HVAC (air handling, distribution, controls)', 'ls', 1, 4500000, 4500000, 28000, 95, 2660000, 1350000, 135000, 355000, 4, 19),
(v_est_awarded, '26', '26 00 00', 'Electrical (power, lighting, low voltage)', 'ls', 1, 4100000, 4100000, 26000, 95, 2470000, 1230000, 0, 400000, 4, 20);

-- -------------------------------------------------------------------------
-- 6e. Bid Packages
-- -------------------------------------------------------------------------

INSERT INTO bid_packages (id, project_id, name, trade, scope_description, status, issue_date, due_date, pre_bid_meeting_date, pre_bid_meeting_location, documents, addenda) VALUES
(v_bp_steel, v_project_id, 'Structural Steel Package', 'Structural Steel', 'Furnish and install all structural steel framing including W shapes, HSS members, steel deck (composite and roof), miscellaneous metals, stairs, railings, and embedded items. Includes shop drawings, engineering, fabrication, delivery, erection, touch up painting, and all required connections.', 'leveled', '2026-02-01', '2026-03-01', '2026-02-10', 'Jobsite trailer, 450 Riverside Dr', '["structural_drawings_SD_set.pdf","steel_specifications_05_12_00.pdf","geotechnical_report.pdf"]', '[{"number":1,"date":"2026-02-15","description":"Revised connection details at grid lines 4 and 7"},{"number":2,"date":"2026-02-20","description":"Added HSS column schedule for mezzanine level"}]'),
(v_bp_mep, v_project_id, 'MEP Systems Package', 'Mechanical/Electrical/Plumbing', 'Complete mechanical, electrical, and plumbing systems including HVAC air handling units, ductwork, piping, plumbing fixtures, electrical distribution, panelboards, lighting, fire alarm, and building automation system. All divisions 22, 23, and 26 work per contract documents.', 'responses_received', '2026-02-15', '2026-03-15', '2026-02-25', 'Main conference room, GC field office', '["MEP_drawings_full_set.pdf","specifications_div_22_23_26.pdf","equipment_schedules.pdf"]', '[{"number":1,"date":"2026-03-01","description":"Updated equipment schedule for rooftop units"}]');

-- -------------------------------------------------------------------------
-- 6f. Bid Invitations: Structural Steel
-- -------------------------------------------------------------------------

INSERT INTO bid_invitations (id, bid_package_id, subcontractor_name, company, contact_email, contact_phone, status, invited_at, viewed_at, submitted_at, decline_reason) VALUES
(v_inv_steel_1, v_bp_steel, 'Mike Torres', 'Pacific Steel Erectors', 'mtorres@pacificsteel.com', '(503) 555-0142', 'submitted', '2026-02-01 09:00:00+00', '2026-02-02 08:15:00+00', '2026-02-27 16:30:00+00', NULL),
(v_inv_steel_2, v_bp_steel, 'Sarah Chen', 'Ironworks West LLC', 'schen@ironworkswest.com', '(206) 555-0198', 'submitted', '2026-02-01 09:00:00+00', '2026-02-01 14:20:00+00', '2026-02-28 11:00:00+00', NULL),
(v_inv_steel_3, v_bp_steel, 'Dave Richardson', 'Columbia Structural Inc', 'drichardson@columbiastructural.com', '(503) 555-0267', 'declined', '2026-02-01 09:00:00+00', '2026-02-03 10:45:00+00', NULL, 'Fully committed through Q3 2026, unable to take on additional projects at this time.');

-- -------------------------------------------------------------------------
-- 6g. Bid Invitations: MEP
-- -------------------------------------------------------------------------

INSERT INTO bid_invitations (id, bid_package_id, subcontractor_name, company, contact_email, contact_phone, status, invited_at, viewed_at, submitted_at, decline_reason) VALUES
(v_inv_mep_1, v_bp_mep, 'James Whitfield', 'Cascade Mechanical Services', 'jwhitfield@cascademech.com', '(503) 555-0311', 'submitted', '2026-02-15 09:00:00+00', '2026-02-15 11:30:00+00', '2026-03-14 15:00:00+00', NULL),
(v_inv_mep_2, v_bp_mep, 'Lisa Nakamura', 'Apex Building Systems', 'lnakamura@apexbldg.com', '(206) 555-0445', 'submitted', '2026-02-15 09:00:00+00', '2026-02-16 09:00:00+00', '2026-03-13 17:30:00+00', NULL),
(v_inv_mep_3, v_bp_mep, 'Robert Patel', 'Summit MEP Contractors', 'rpatel@summitmep.com', '(971) 555-0523', 'viewed', '2026-02-15 09:00:00+00', '2026-02-17 13:15:00+00', NULL, NULL);

-- -------------------------------------------------------------------------
-- 6h. Bid Responses: Structural Steel (2 responses)
-- -------------------------------------------------------------------------

INSERT INTO bid_responses (bid_package_id, bid_invitation_id, subcontractor_name, company, base_bid, alternate_1, alternate_2, alternate_3, unit_prices, exclusions, inclusions, schedule_days, bond_included, document_urls, notes, ai_analysis) VALUES
(v_bp_steel, v_inv_steel_1, 'Mike Torres', 'Pacific Steel Erectors', 8450000, 8250000, 8680000, NULL, '{"structural_steel_per_ton": 4150, "misc_metals_per_lb": 4.25, "steel_deck_per_sf": 7.80}', 'Excludes fireproofing, painting beyond touch up, and any concrete work. Testing and inspection by others.', 'Includes engineering, shop drawings, fabrication, delivery, erection, bolting, welding, and touch up primer. Crane and rigging included. Includes 3D model coordination.', 95, true, '["pacific_steel_proposal.pdf","pacific_steel_schedule.pdf"]', 'Competitive pricing with strong local track record. Available to start May 2026.', 'Pacific Steel offers the lowest base bid at $8.45M with a 95 day schedule. Their unit price for structural steel ($4,150/ton) is 4% below market average. Bond included. Strong inclusion of 3D model coordination suggests experienced BIM workflow. Recommend for award consideration.'),
(v_bp_steel, v_inv_steel_2, 'Sarah Chen', 'Ironworks West LLC', 8720000, 8520000, 8950000, 9100000, '{"structural_steel_per_ton": 4280, "misc_metals_per_lb": 4.50, "steel_deck_per_sf": 8.10}', 'Excludes fireproofing, finish painting, concrete, and miscellaneous embedded items not shown on structural drawings.', 'Includes full structural steel package with engineering, detailing, fabrication, delivery, and erection. Includes crane, welding, bolting, and field touch up. Performance and payment bond included.', 88, true, '["ironworks_west_proposal.pdf"]', 'Tighter schedule but slightly higher pricing. Excellent safety record and EMR of 0.72.', 'Ironworks West bids $8.72M base with a faster 88 day schedule (7 days shorter than Pacific Steel). Premium of $270K over low bid. Unit prices are 3% above Pacific Steel. Notable strength: 0.72 EMR safety record. Three alternates provided showing flexibility. Consider if schedule acceleration has value.');

-- -------------------------------------------------------------------------
-- 6i. Bid Responses: MEP (2 responses)
-- -------------------------------------------------------------------------

INSERT INTO bid_responses (bid_package_id, bid_invitation_id, subcontractor_name, company, base_bid, alternate_1, alternate_2, alternate_3, unit_prices, exclusions, inclusions, schedule_days, bond_included, document_urls, notes, ai_analysis) VALUES
(v_bp_mep, v_inv_mep_1, 'James Whitfield', 'Cascade Mechanical Services', 11200000, 10800000, 11500000, NULL, '{"hvac_per_ton": 8500, "plumbing_fixture_avg": 1200, "electrical_per_sf": 42}', 'Excludes fire sprinkler system (by others), security system, and telecom cabling. Gas service connection by utility.', 'Complete HVAC, plumbing, and electrical per contract documents. Includes all equipment, distribution, controls, BAS, lighting, fire alarm, and testing/balancing. TAB included.', 150, true, '["cascade_mep_proposal.pdf","cascade_equipment_cuts.pdf"]', 'Full service MEP contractor with in house capabilities across all three trades.', 'Cascade offers $11.2M for the full MEP package with 150 day schedule. As a self performing multi trade contractor, coordination risk is lower. HVAC unit pricing at $8,500/ton is competitive. Includes TAB and BAS which some competitors may exclude. Solid base bid with reasonable alternates.'),
(v_bp_mep, v_inv_mep_2, 'Lisa Nakamura', 'Apex Building Systems', 10850000, 10500000, 11100000, 11400000, '{"hvac_per_ton": 8200, "plumbing_fixture_avg": 1150, "electrical_per_sf": 40}', 'Excludes fire sprinkler, security, telecom, utility connections, and rooftop screen walls. TAB by separate specialty contractor (allowance included).', 'Full MEP installation per plans and specs. Equipment procurement, rough in, trim out, startup, and commissioning. Includes $45K TAB allowance and $30K controls allowance.', 140, false, '["apex_bldg_proposal.pdf"]', 'Lower base bid but uses allowances for TAB and controls which could result in change orders. No bond included in base price.', 'Apex bids $10.85M, which is $350K below Cascade. However, they use allowances for TAB ($45K) and controls ($30K) rather than firm pricing, creating change order risk. No bond included (add ~1.5% = $163K). Adjusted comparison puts Apex at ~$11.04M vs Cascade at $11.2M, narrowing the gap to $160K. 10 day faster schedule. Recommend detailed scope review before leveling.');

-- -------------------------------------------------------------------------
-- 6j. Takeoff Items (10 items)
-- -------------------------------------------------------------------------

INSERT INTO takeoff_items (project_id, name, category, measurement_type, quantity, unit, color, layer, points) VALUES
(v_project_id, 'Ground floor slab on grade', 'Concrete', 'area', 18500, 'sf', '#2196F3', 'slab_on_grade', '[{"x": 0, "y": 0}, {"x": 150, "y": 0}, {"x": 150, "y": 123}, {"x": 0, "y": 123}]'),
(v_project_id, 'Level 2 elevated slab', 'Concrete', 'area', 16200, 'sf', '#2196F3', 'elevated_slab', '[{"x": 0, "y": 0}, {"x": 150, "y": 0}, {"x": 150, "y": 108}, {"x": 0, "y": 108}]'),
(v_project_id, 'Perimeter foundation wall', 'Concrete', 'linear', 1240, 'lf', '#FF5722', 'foundation', '[{"x": 0, "y": 0}, {"x": 150, "y": 0}, {"x": 150, "y": 123}, {"x": 0, "y": 123}]'),
(v_project_id, 'Exterior curtain wall area', 'Glazing', 'area', 42000, 'sf', '#00BCD4', 'curtain_wall', '[{"x": 0, "y": 0}, {"x": 320, "y": 0}, {"x": 320, "y": 131}, {"x": 0, "y": 131}]'),
(v_project_id, 'Interior partition walls (GWB)', 'Finishes', 'linear', 8400, 'lf', '#9C27B0', 'partitions', '[]'),
(v_project_id, 'Structural steel columns', 'Steel', 'count', 186, 'ea', '#F44336', 'structural', '[]'),
(v_project_id, 'Steel deck area (all levels)', 'Steel', 'area', 88000, 'sf', '#E91E63', 'steel_deck', '[]'),
(v_project_id, 'Roof insulation area', 'Thermal', 'area', 18500, 'sf', '#FFEB3B', 'roofing', '[]'),
(v_project_id, 'Plumbing fixtures', 'MEP', 'count', 342, 'ea', '#4CAF50', 'plumbing', '[]'),
(v_project_id, 'Excavation volume', 'Sitework', 'volume', 12000, 'cy', '#795548', 'earthwork', '[]');

-- -------------------------------------------------------------------------
-- 6k. Cost Database (30 entries with real CSI codes)
-- -------------------------------------------------------------------------

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

END
$$;
