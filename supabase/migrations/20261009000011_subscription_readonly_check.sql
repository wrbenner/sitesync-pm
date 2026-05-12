-- =============================================================================
-- 20261009000011_subscription_readonly_check.sql
-- BRT subsystem 4 §4.6 — read-only mode enforcement at the DB layer.
--
-- When subscription.status IN ('paused', 'canceled') AND access_revoked_at
-- is past, mutations against org-owned tables are blocked at the RLS layer.
-- Reads continue to work so the user can export their data.
--
-- Adds:
--   - subscriptions.access_revoked_at column
--   - is_org_writable(org_id) helper
--   - guidance comment on what new INSERT/UPDATE/DELETE policies must do
-- =============================================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz;

COMMENT ON COLUMN subscriptions.access_revoked_at IS
  'BRT sub-4 §4.6: when set in the past, mutations to org-owned tables are blocked. Set automatically by stripe-webhook after dunning day-8 + cancel grace window.';

-- ---------------------------------------------------------------------------
-- is_org_writable(org_id) — the helper every org-scoped INSERT/UPDATE/DELETE
-- policy can call to decide if the caller's org is in writable state.
--
-- Returns:
--   true  — org subscription is active or trialing OR access_revoked_at is null/future
--   false — org subscription is paused/canceled AND access_revoked_at is past
--
-- New mutating RLS policies should AND this in. Existing 48 RLS-protected
-- tables are NOT modified by this migration — that's a mechanical sweep
-- in a follow-up slice. This migration ships the primitive + the new-table
-- discipline.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_org_writable(p_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM subscriptions
    WHERE organization_id = p_org_id
      AND status IN ('paused', 'canceled')
      AND access_revoked_at IS NOT NULL
      AND access_revoked_at <= now()
  );
$$;

COMMENT ON FUNCTION is_org_writable IS
  'BRT sub-4 §4.6: returns true if org is in writable state. New mutating RLS policies should AND this in: USING (is_org_writable(organization_id)). Reads remain unconditional so users can always export their data.';

REVOKE EXECUTE ON FUNCTION is_org_writable(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_org_writable(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Convenience: helper for the frontend's useSubscription hook to read the
-- effective writable state without having to compose the predicate locally.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION my_active_org_writable()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bool_and(is_org_writable(om.organization_id))
  FROM organization_members om
  WHERE om.user_id = auth.uid();
$$;

COMMENT ON FUNCTION my_active_org_writable IS
  'BRT sub-4 §4.6: convenience for clients — true if every org the caller belongs to is writable. False if any are read-only (rare; usually only one org per user at Beta scale).';

REVOKE EXECUTE ON FUNCTION my_active_org_writable() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION my_active_org_writable() TO authenticated, service_role;
