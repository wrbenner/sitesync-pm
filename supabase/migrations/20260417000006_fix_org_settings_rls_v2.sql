-- SEC-H06/H07 follow-up: Ensure organization_settings RLS uses membership and
-- admin/owner role checks, not permissive auth.uid() IS NOT NULL. This is
-- idempotent: drops any permissive-style policies still present and re-creates
-- the correct ones, so it's safe to run even after 20260417000003.

DROP POLICY IF EXISTS org_settings_select ON organization_settings;
DROP POLICY IF EXISTS org_settings_insert ON organization_settings;
DROP POLICY IF EXISTS org_settings_update ON organization_settings;
DROP POLICY IF EXISTS org_settings_delete ON organization_settings;

-- SELECT: must be a member of the organization
CREATE POLICY org_settings_select ON organization_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
    )
  );

-- INSERT: must be admin or owner of the organization
CREATE POLICY org_settings_insert ON organization_settings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- UPDATE: must be admin or owner of the organization
CREATE POLICY org_settings_update ON organization_settings FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- DELETE: must be admin or owner of the organization
CREATE POLICY org_settings_delete ON organization_settings FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  );
