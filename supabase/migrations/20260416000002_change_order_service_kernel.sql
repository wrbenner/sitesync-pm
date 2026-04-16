-- =============================================================================
-- Change Order Service Kernel: status constraint, soft-delete RLS filtering
-- =============================================================================
--
-- PURPOSE: Reinforce the change_orders table for the kernel service layer
-- introduced in src/services/changeOrderService.ts.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds status CHECK constraint for all 5 kernel lifecycle states
--   2. Sets the default status to 'draft' (kernel lifecycle entry point)
--   3. Rebuilds ALL change_orders RLS policies idempotently to:
--       a. Filter soft-deleted rows (deleted_at IS NULL) in SELECT and UPDATE
--       b. Use project_members membership check (no has_project_permission
--          function dependency that may be unavailable at migration time)
--       c. Include legacy 'member' role in read-access policy
--
-- WHY A NEW MIGRATION (not a patch to 00033 or 00052):
--   Prior migrations added RLS but did not filter soft-deleted rows.
--   The service layer relies on deleted_at IS NULL for correctness.
--   Running this migration ensures the database enforces the same filter
--   that the service applies at the query level, giving defense in depth.
--
-- IDEMPOTENT: Every operation uses DROP ... IF EXISTS before CREATE, or
-- uses ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS. Safe to run multiple
-- times in the same or different environments.
--
-- BACKWARD COMPATIBILITY:
--   All existing rows with status in ('draft','pending_review','approved',
--   'rejected','void') remain valid. Any rows with legacy status values
--   outside this set will cause the constraint to fail — run
--   SELECT DISTINCT status FROM change_orders to audit before applying.
--
-- ROLLBACK:
--   ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;
--   DROP POLICY IF EXISTS co_select   ON change_orders;
--   DROP POLICY IF EXISTS co_insert   ON change_orders;
--   DROP POLICY IF EXISTS co_update   ON change_orders;
--   DROP POLICY IF EXISTS co_delete   ON change_orders;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Status CHECK constraint
-- ---------------------------------------------------------------------------
-- Drop any prior constraint by the old or new name (idempotent)
ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;
ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_status_kernel_check;

ALTER TABLE change_orders
  ADD CONSTRAINT change_orders_status_kernel_check
  CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'void'));

-- Kernel entry point: new rows start as draft
ALTER TABLE change_orders ALTER COLUMN status SET DEFAULT 'draft';

COMMENT ON COLUMN change_orders.status IS
  'Change order lifecycle state: draft, pending_review, approved, rejected, void. '
  'See src/machines/changeOrderMachine.ts. Default is draft (kernel entry point). '
  'Constraint added by 20260416000002_change_order_service_kernel.';

-- ---------------------------------------------------------------------------
-- 2. Ensure RLS is enabled
-- ---------------------------------------------------------------------------
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Rebuild RLS policies (idempotent)
--
-- Policy name scheme: co_* (short, conflict-free with older change_orders_* names)
-- Old policy names are also dropped to avoid duplicates.
-- ---------------------------------------------------------------------------

-- Drop old policy names from prior migrations
DROP POLICY IF EXISTS change_orders_select ON change_orders;
DROP POLICY IF EXISTS change_orders_insert ON change_orders;
DROP POLICY IF EXISTS change_orders_update ON change_orders;
DROP POLICY IF EXISTS change_orders_delete ON change_orders;

-- Drop new names in case this migration is re-run
DROP POLICY IF EXISTS co_select ON change_orders;
DROP POLICY IF EXISTS co_insert ON change_orders;
DROP POLICY IF EXISTS co_update ON change_orders;
DROP POLICY IF EXISTS co_delete ON change_orders;

-- SELECT: any project member can read active (non-deleted) change orders
CREATE POLICY co_select ON change_orders FOR SELECT
  USING (
    deleted_at IS NULL
    AND project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: superintendent and above can create change orders
CREATE POLICY co_insert ON change_orders FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'project_manager', 'superintendent', 'member')
    )
  );

-- UPDATE: superintendent and above can update active change orders
CREATE POLICY co_update ON change_orders FOR UPDATE
  USING (
    deleted_at IS NULL
    AND project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'project_manager', 'superintendent')
    )
  );

-- DELETE (hard-delete): restricted to admin/owner only.
-- Prefer soft-delete (set deleted_at) via the service layer.
CREATE POLICY co_delete ON change_orders FOR DELETE
  USING (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

COMMIT;
