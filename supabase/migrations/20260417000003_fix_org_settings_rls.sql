-- SEC-H07: Organization settings were writable by any authenticated user.
-- Replace permissive `auth.uid() IS NOT NULL` policies with organization
-- membership / admin-role checks.

DROP POLICY IF EXISTS org_settings_select ON organization_settings;
DROP POLICY IF EXISTS org_settings_insert ON organization_settings;
DROP POLICY IF EXISTS org_settings_update ON organization_settings;
DROP POLICY IF EXISTS org_settings_delete ON organization_settings;

-- Any org member can view their org's settings
CREATE POLICY org_settings_select ON organization_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
    )
  );

-- Only owners/admins can create org settings rows for their own org
CREATE POLICY org_settings_insert ON organization_settings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- Only owners/admins can update their org's settings
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

-- Only owners can delete org settings
CREATE POLICY org_settings_delete ON organization_settings FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid())
        AND role = 'owner'
    )
  );
