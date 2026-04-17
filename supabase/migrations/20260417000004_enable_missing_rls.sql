-- Enable RLS on tables that shipped without row-level security and add
-- restrictive policies. Each table gets the narrowest reasonable scope:
--   plans                     → read-only catalog, anyone authenticated
--   stripe_connected_accounts → org admins only
--   payment_line_items        → scoped via payment_applications → project
--   integration_field_mappings → scoped via integrations → org
--   prevailing_wage_rates     → read-only catalog, anyone authenticated
--   bim_elements              → scoped via bim_models → project
--   bim_clashes               → scoped via bim_models → project

-- ── plans (SaaS catalog, read-only for auth'd users) ────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_select ON plans;
CREATE POLICY plans_select ON plans FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

-- No INSERT/UPDATE/DELETE policies → writes only via service role.

-- ── stripe_connected_accounts (org admins only) ─────────────────
ALTER TABLE stripe_connected_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_connected_accounts_select ON stripe_connected_accounts;
CREATE POLICY stripe_connected_accounts_select ON stripe_connected_accounts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS stripe_connected_accounts_insert ON stripe_connected_accounts;
CREATE POLICY stripe_connected_accounts_insert ON stripe_connected_accounts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS stripe_connected_accounts_update ON stripe_connected_accounts;
CREATE POLICY stripe_connected_accounts_update ON stripe_connected_accounts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS stripe_connected_accounts_delete ON stripe_connected_accounts;
CREATE POLICY stripe_connected_accounts_delete ON stripe_connected_accounts FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role = 'owner'
    )
  );

-- ── payment_line_items (scoped via payment_applications → project) ──
ALTER TABLE payment_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_line_items_select ON payment_line_items;
CREATE POLICY payment_line_items_select ON payment_line_items FOR SELECT
  USING (
    application_id IN (
      SELECT pa.id FROM payment_applications pa
      WHERE pa.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS payment_line_items_insert ON payment_line_items;
CREATE POLICY payment_line_items_insert ON payment_line_items FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT pa.id FROM payment_applications pa
      WHERE pa.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS payment_line_items_update ON payment_line_items;
CREATE POLICY payment_line_items_update ON payment_line_items FOR UPDATE
  USING (
    application_id IN (
      SELECT pa.id FROM payment_applications pa
      WHERE pa.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS payment_line_items_delete ON payment_line_items;
CREATE POLICY payment_line_items_delete ON payment_line_items FOR DELETE
  USING (
    application_id IN (
      SELECT pa.id FROM payment_applications pa
      WHERE pa.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

-- ── integration_field_mappings (scoped via integrations → org) ──
ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_field_mappings_select ON integration_field_mappings;
CREATE POLICY integration_field_mappings_select ON integration_field_mappings FOR SELECT
  USING (
    integration_id IN (
      SELECT i.id FROM integrations i
      WHERE i.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS integration_field_mappings_insert ON integration_field_mappings;
CREATE POLICY integration_field_mappings_insert ON integration_field_mappings FOR INSERT
  WITH CHECK (
    integration_id IN (
      SELECT i.id FROM integrations i
      WHERE i.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (select auth.uid())
          AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS integration_field_mappings_update ON integration_field_mappings;
CREATE POLICY integration_field_mappings_update ON integration_field_mappings FOR UPDATE
  USING (
    integration_id IN (
      SELECT i.id FROM integrations i
      WHERE i.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (select auth.uid())
          AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS integration_field_mappings_delete ON integration_field_mappings;
CREATE POLICY integration_field_mappings_delete ON integration_field_mappings FOR DELETE
  USING (
    integration_id IN (
      SELECT i.id FROM integrations i
      WHERE i.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (select auth.uid())
          AND role IN ('owner', 'admin')
      )
    )
  );

-- ── prevailing_wage_rates (public reference data, read-only) ────
ALTER TABLE prevailing_wage_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prevailing_wage_rates_select ON prevailing_wage_rates;
CREATE POLICY prevailing_wage_rates_select ON prevailing_wage_rates FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

-- No INSERT/UPDATE/DELETE policies → writes only via service role.

-- ── bim_elements (scoped via bim_models → project) ──────────────
ALTER TABLE bim_elements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bim_elements_select ON bim_elements;
CREATE POLICY bim_elements_select ON bim_elements FOR SELECT
  USING (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS bim_elements_insert ON bim_elements;
CREATE POLICY bim_elements_insert ON bim_elements FOR INSERT
  WITH CHECK (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS bim_elements_update ON bim_elements;
CREATE POLICY bim_elements_update ON bim_elements FOR UPDATE
  USING (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS bim_elements_delete ON bim_elements;
CREATE POLICY bim_elements_delete ON bim_elements FOR DELETE
  USING (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

-- ── bim_clashes (scoped via bim_models → project) ──────────────
ALTER TABLE bim_clashes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bim_clashes_select ON bim_clashes;
CREATE POLICY bim_clashes_select ON bim_clashes FOR SELECT
  USING (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS bim_clashes_insert ON bim_clashes;
CREATE POLICY bim_clashes_insert ON bim_clashes FOR INSERT
  WITH CHECK (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS bim_clashes_update ON bim_clashes;
CREATE POLICY bim_clashes_update ON bim_clashes FOR UPDATE
  USING (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS bim_clashes_delete ON bim_clashes;
CREATE POLICY bim_clashes_delete ON bim_clashes FOR DELETE
  USING (
    model_id IN (
      SELECT bm.id FROM bim_models bm
      WHERE bm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
      )
    )
  );
