-- =============================================================================
-- Layer 1 Test: Permission Boundary
-- =============================================================================
-- Validates DOMAIN_KERNEL_SPEC.md §7 Permission Matrix:
--   - Viewer cannot create RFI (Fixture #2)
--   - Superintendent cannot approve change order (Fixture #3)
--   - Subcontractor cannot see financial data (Fixture #12)
--
-- Preconditions (from setup.sql):
--   - Project Alpha has:
--       Alice   = project_manager
--       Sam     = superintendent
--       Charlie = subcontractor
--       Vic     = viewer
--       Eve     = owner
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Test 2.1: Viewer cannot create RFI
-- Fixture #2 — "Viewer Cannot Create RFI"
-- ---------------------------------------------------------------------------
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO 'ee000000-0000-0000-0000-000000000005'; -- Vic (viewer)

DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    INSERT INTO rfis (id, project_id, title, status, created_by, created_at, updated_at)
    VALUES (
      'eeee0000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-000000000001', -- Project Alpha
      'Viewer should not create this',
      'draft',
      'ee000000-0000-0000-0000-000000000005', -- Vic
      now(),
      now()
    );
    v_succeeded := true;
  EXCEPTION WHEN insufficient_privilege THEN
    v_succeeded := false;
  WHEN OTHERS THEN
    -- RLS violations may raise different error codes depending on policy
    IF SQLERRM ILIKE '%permission%' OR SQLERRM ILIKE '%policy%' OR SQLERRM ILIKE '%denied%' OR SQLERRM ILIKE '%violat%' THEN
      v_succeeded := false;
    ELSE
      RAISE EXCEPTION 'FAIL [2.1] Unexpected error: %', SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'FAIL [2.1] Viewer was able to INSERT an RFI — RLS INSERT policy missing or misconfigured';
  END IF;

  RAISE NOTICE 'PASS [2.1] Viewer cannot create RFI (INSERT denied by RLS)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 2.2: Subcontractor cannot create a change order
-- Fixture #3 / #12 — subcontractor financial data isolation
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'dd000000-0000-0000-0000-000000000004'; -- Charlie (subcontractor)

DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    INSERT INTO change_orders (id, project_id, title, type, status, created_by, created_at, updated_at)
    VALUES (
      'dddd0000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-000000000001', -- Project Alpha
      'Subcontractor should not create this',
      'pco',
      'draft',
      'dd000000-0000-0000-0000-000000000004', -- Charlie
      now(),
      now()
    );
    v_succeeded := true;
  EXCEPTION WHEN insufficient_privilege THEN
    v_succeeded := false;
  WHEN OTHERS THEN
    IF SQLERRM ILIKE '%permission%' OR SQLERRM ILIKE '%policy%' OR SQLERRM ILIKE '%denied%' OR SQLERRM ILIKE '%violat%' THEN
      v_succeeded := false;
    ELSE
      RAISE EXCEPTION 'FAIL [2.2] Unexpected error: %', SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'FAIL [2.2] Subcontractor was able to INSERT a change order — RLS policy missing';
  END IF;

  RAISE NOTICE 'PASS [2.2] Subcontractor cannot create change order';
END $$;

-- ---------------------------------------------------------------------------
-- Test 2.3: Subcontractor cannot see budget items
-- Fixture #12 — "Subcontractor Scope Limitation"
-- ---------------------------------------------------------------------------
-- First, insert a budget item as service role for the test
RESET role;
INSERT INTO budget_items (id, project_id, cost_code, description, original_amount, created_at, updated_at)
VALUES (
  'dddd0000-0000-0000-0000-000000000099',
  'a1000000-0000-0000-0000-000000000001', -- Project Alpha
  '03-100',
  'Test Budget Item for permission test',
  500000,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Switch to Charlie (subcontractor)
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO 'dd000000-0000-0000-0000-000000000004'; -- Charlie

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM budget_items
   WHERE project_id = 'a1000000-0000-0000-0000-000000000001';

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL [2.3] Subcontractor can see budget items. Expected 0, got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [2.3] Subcontractor cannot see budget items (financial isolation)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 2.4: Subcontractor CAN see RFIs (allowed per kernel spec §7)
-- Fixture #12 — confirms rfis.view is allowed for subcontractor
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM rfis
   WHERE project_id = 'a1000000-0000-0000-0000-000000000001';

  IF v_count < 1 THEN
    RAISE EXCEPTION 'FAIL [2.4] Subcontractor cannot see any RFIs. Expected >= 1, got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [2.4] Subcontractor can see RFIs (rfis.view allowed)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 2.5: Superintendent cannot approve change order
-- Fixture #3 — "Superintendent Cannot Approve Change Order"
-- ---------------------------------------------------------------------------
-- Create a change order for this test (as service role)
RESET role;
INSERT INTO change_orders (id, project_id, title, type, status, created_by, created_at, updated_at)
VALUES (
  'cccc0000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', -- Project Alpha
  'Test CO for approval test',
  'co',
  'submitted',
  'aa000000-0000-0000-0000-000000000001', -- Created by Alice
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Switch to Sam (superintendent)
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO 'cc000000-0000-0000-0000-000000000003'; -- Sam

DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    UPDATE change_orders
       SET status = 'approved',
           updated_at = now()
     WHERE id = 'cccc0000-0000-0000-0000-000000000001';

    -- If no rows updated, the RLS SELECT policy hid the row (also a valid outcome)
    IF NOT FOUND THEN
      v_succeeded := false;
    ELSE
      v_succeeded := true;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    v_succeeded := false;
  WHEN OTHERS THEN
    IF SQLERRM ILIKE '%permission%' OR SQLERRM ILIKE '%policy%' OR SQLERRM ILIKE '%denied%' OR SQLERRM ILIKE '%violat%' THEN
      v_succeeded := false;
    ELSE
      RAISE EXCEPTION 'FAIL [2.5] Unexpected error: %', SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'FAIL [2.5] Superintendent was able to approve change order — RLS UPDATE policy missing';
  END IF;

  RAISE NOTICE 'PASS [2.5] Superintendent cannot approve change order';
END $$;

-- ---------------------------------------------------------------------------
-- Cleanup test-specific data
-- ---------------------------------------------------------------------------
RESET role;
DELETE FROM budget_items  WHERE id = 'dddd0000-0000-0000-0000-000000000099';
DELETE FROM change_orders WHERE id IN ('cccc0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000001');
-- Also clean up any rows that might have been created if a test unexpectedly passed
DELETE FROM rfis WHERE id = 'eeee0000-0000-0000-0000-000000000001';

ROLLBACK;
