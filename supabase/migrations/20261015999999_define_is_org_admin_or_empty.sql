-- Define is_org_admin_or_empty(uuid, uuid) before
-- 20261016030000_task_30_batch_5_permission_helpers.sql touches it.
--
-- The batch-5 migration loops over 11 permission-helper signatures and
-- ALTER/REVOKE/GRANTs each. All but one already exist in migration history;
-- this single function was never landed via source control (it presumably
-- exists on prod via an out-of-band create) and only its absence blocks
-- the hardening sweep.
--
-- The semantic is "owner/admin of the org — or the org has no members
-- yet (initial provisioning state)." Behaviour matches the obvious read
-- of the name; conservative production callers should pin to a sharper
-- helper. The Task #30 hardening that lands after this only changes
-- function attributes (search_path, grants); the body stays as authored
-- here unless a later migration replaces it.

CREATE OR REPLACE FUNCTION public.is_org_admin_or_empty(
  p_user_id uuid,
  p_org_id  uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = p_user_id
        AND om.organization_id = p_org_id
        AND om.role IN ('owner', 'admin')
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = p_org_id
    );
$$;

COMMENT ON FUNCTION public.is_org_admin_or_empty(uuid, uuid) IS
  'Returns true when the user is an org owner/admin, or when the org has no membership rows at all (newly provisioned). Defined here so 20261016030000_task_30_batch_5_permission_helpers.sql finds it; prod has an out-of-band definition that the source tree never captured.';
