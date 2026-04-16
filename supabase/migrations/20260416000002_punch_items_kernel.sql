-- =============================================================================
-- Punch Items Kernel: Provenance Columns + Status Lifecycle + RLS Policies
-- =============================================================================
--
-- PURPOSE: Upgrade punch_items table to support the kernel service pattern:
--   1. Add provenance columns: created_by, updated_by, verified_by, deleted_by
--   2. Add soft-delete columns: deleted_at, deleted_by
--   3. Add lifecycle columns: closed_at
--   4. Widen status constraint to include 'closed' (final archive state)
--   5. Add idempotent RLS policies for project-scoped access
--
-- BACKWARD COMPATIBLE:
--   All existing rows remain valid. New columns default to NULL.
--   Existing status values (open, in_progress, resolved, verified) remain valid.
--   The app currently inserts without provenance columns; this continues to work.
--
-- ROLLBACK:
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS verified_by;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS deleted_at;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS closed_at;
--   ALTER TABLE punch_items DROP CONSTRAINT IF EXISTS punch_items_status_check;
-- =============================================================================

BEGIN;

-- ── 1. Provenance Columns ────────────────────────────────────────────────────

ALTER TABLE punch_items
  ADD COLUMN IF NOT EXISTS created_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_by  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closed_at    timestamptz;

COMMENT ON COLUMN punch_items.created_by  IS 'User who created this item. Populated by punchItemService.createPunchItem().';
COMMENT ON COLUMN punch_items.updated_by  IS 'User who last updated this item. Populated on every mutation.';
COMMENT ON COLUMN punch_items.verified_by IS 'User who verified (closed) this item. Set on transitionStatus to verified.';
COMMENT ON COLUMN punch_items.deleted_at  IS 'Soft-delete timestamp. NULL means active. Set by punchItemService.deletePunchItem().';
COMMENT ON COLUMN punch_items.deleted_by  IS 'User who soft-deleted this item.';
COMMENT ON COLUMN punch_items.closed_at   IS 'Timestamp when item reached closed state (final archive).';

-- ── 2. Status Constraint ─────────────────────────────────────────────────────
-- Drop existing constraint if present, then add widened version.
-- Adds 'closed' as a terminal archive state after 'verified'.

ALTER TABLE punch_items DROP CONSTRAINT IF EXISTS punch_items_status_check;
ALTER TABLE punch_items ADD CONSTRAINT punch_items_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'verified', 'closed'));

COMMENT ON COLUMN punch_items.status IS
  'Punch item lifecycle state. Valid: open, in_progress, resolved, verified, closed. '
  'Transitions enforced by punchItemService.transitionStatus(). '
  'Default is open. Closed is the final archive state after verification.';

-- ── 3. RLS Policies ──────────────────────────────────────────────────────────
-- Enable RLS if not already enabled.

ALTER TABLE punch_items ENABLE ROW LEVEL SECURITY;

-- Project members can view non-deleted punch items for their projects.
DROP POLICY IF EXISTS punch_items_select_members ON punch_items;
CREATE POLICY punch_items_select_members ON punch_items
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Project members can insert punch items for their projects.
DROP POLICY IF EXISTS punch_items_insert_members ON punch_items;
CREATE POLICY punch_items_insert_members ON punch_items
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Project members can update punch items for their projects.
-- Hard-delete is not permitted via RLS; use soft-delete instead.
DROP POLICY IF EXISTS punch_items_update_members ON punch_items;
CREATE POLICY punch_items_update_members ON punch_items
  FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Only admins/owners can hard-delete. Prefer soft-delete via updated_by/deleted_at.
DROP POLICY IF EXISTS punch_items_delete_admins ON punch_items;
CREATE POLICY punch_items_delete_admins ON punch_items
  FOR DELETE
  USING (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

-- ── 4. Audit Trigger ─────────────────────────────────────────────────────────
-- Attach the generic audit trigger (created by 20260415000002) to punch_items.
-- fn_audit_trigger() already exists. DROP IF EXISTS before CREATE to be idempotent.

DROP TRIGGER IF EXISTS trg_punch_items_audit ON punch_items;
CREATE TRIGGER trg_punch_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON punch_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

COMMIT;
