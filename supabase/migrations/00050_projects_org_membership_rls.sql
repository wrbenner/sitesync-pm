-- Restrict project reads to members of the owning organization.
-- Any user not in organization_members for the project's org cannot select.
CREATE POLICY "projects_org_member_select"
  ON projects
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
