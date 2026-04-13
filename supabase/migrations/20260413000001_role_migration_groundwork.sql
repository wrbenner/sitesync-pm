-- =============================================================================
-- Step 4, Batch 1: project_members role migration groundwork
-- =============================================================================
--
-- PURPOSE: Widen the project_members.role CHECK constraint to accept the
-- kernel-defined roles alongside the legacy roles, without breaking the
-- current app or modifying existing data.
--
-- CURRENT STATE:
--   CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
--
-- KERNEL TARGET (DOMAIN_KERNEL_SPEC.md §7):
--   ('owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer')
--
-- WHAT THIS MIGRATION DOES:
--   1. Drops the old CHECK constraint
--   2. Adds a new CHECK constraint that accepts BOTH legacy and kernel roles
--   3. Adds an advisory helper function (kernel_role_label) for read-time labeling
--
-- WHAT THIS MIGRATION DEFERS:
--   - Semantic remapping of legacy 'member' to a kernel role is deferred to a
--     later migration. This migration does NOT enforce any role equivalence.
--   - kernel_role_label() is advisory only — it has no enforcement or
--     data-modification authority.
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   - Does NOT backfill or rename any existing 'member' rows
--   - Does NOT change any RLS policies
--   - Does NOT change any client-side code
--   - Does NOT remove the 'member' value (backward compatible)
--
-- BACKWARD COMPATIBILITY:
--   All existing rows with 'owner', 'admin', 'member', 'viewer' remain valid.
--   All existing RLS policies that check ARRAY['owner', 'admin', 'member']
--   continue to work unchanged. The app can continue inserting 'member'.
--   New code can begin inserting kernel roles (project_manager, etc.)
--
-- ROLLBACK:
--   ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
--   ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
--     CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
--   DROP FUNCTION IF EXISTS kernel_role_label(text);
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Widen the CHECK constraint
-- ---------------------------------------------------------------------------
-- Drop the existing constraint first. The constraint name is auto-generated
-- by Postgres as 'project_members_role_check' (table_column_check pattern).
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;

-- Add the widened constraint that accepts both legacy and kernel roles.
-- Legacy values: owner, admin, member, viewer
-- Kernel values: owner, admin, project_manager, superintendent, subcontractor, viewer
-- Combined (union): owner, admin, member, project_manager, superintendent, subcontractor, viewer
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
  CHECK (role IN (
    -- Kernel roles (DOMAIN_KERNEL_SPEC.md §7)
    'owner',
    'admin',
    'project_manager',
    'superintendent',
    'subcontractor',
    'viewer',
    -- Legacy role (preserved for backward compatibility)
    'member'
  ));

-- ---------------------------------------------------------------------------
-- 2. Add kernel_role_label() — advisory read-time helper only
-- ---------------------------------------------------------------------------
-- Returns a human-readable label for a role value. This function is purely
-- advisory: it does not modify data, enforce permissions, or remap roles.
-- Semantic remapping of 'member' to a kernel role is deferred.
CREATE OR REPLACE FUNCTION kernel_role_label(raw_role text)
RETURNS text AS $$
  SELECT CASE raw_role
    WHEN 'member' THEN 'member (legacy — not yet remapped to kernel role)'
    ELSE raw_role
  END;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION kernel_role_label(text) IS
  'Advisory read-time helper. Returns a label for a project_members.role value. '
  'Does not modify data or enforce permissions. '
  'Semantic remapping of legacy member is deferred. See DEPRECATION_LEDGER.md §3.1.';

-- ---------------------------------------------------------------------------
-- 3. Document the change in a comment on the column
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN project_members.role IS
  'Project role. Kernel roles: owner, admin, project_manager, superintendent, '
  'subcontractor, viewer. Legacy value "member" is accepted for backward '
  'compatibility. Semantic remapping of "member" to a kernel role is deferred '
  'to a later migration. See DOMAIN_KERNEL_SPEC.md §7 and DEPRECATION_LEDGER.md §3.1.';

COMMIT;
