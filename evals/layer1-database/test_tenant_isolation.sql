-- =============================================================================
-- Layer 1 Test: Tenant Isolation
-- =============================================================================
-- Validates DOMAIN_KERNEL_SPEC.md §2 and §7:
--   "Organization A cannot see Organization B's data. Ever. No exceptions."
--
-- Covers Gold-Standard Fixtures:
--   #1  — Tenant Isolation: Org A user cannot see Org B data
--   #14 — Concurrent Project Isolation: user on two projects sees correct scope
--
-- Preconditions (from setup.sql):
--   - Org A has Project Alpha with RFIs (Alice = PM)
--   - Org B has Project Beta with RFIs (Bob = PM)
--   - Alice has NO project_members row for Project Beta
--   - Bob has NO project_members row for Project Alpha
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Test 1.1: Bob (Org B) cannot see Org A's RFIs
-- Fixture #1
-- ---------------------------------------------------------------------------
-- Simulate Bob's auth context. In Supabase, RLS uses auth.uid().
-- We use SET LOCAL to simulate this for the transaction.
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO 'bb000000-0000-0000-0000-000000000002'; -- Bob

DO $$
DECLARE
  v_count integer;
BEGIN
  -- Bob queries for a specific RFI that belongs to Org A / Project Alpha
  SELECT count(*)
    INTO v_count
    FROM rfis
   WHERE id = 'aaa00000-0000-0000-0000-000000000001'; -- Alpha RFI-1

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL [1.1] Bob (Org B) can see Org A RFI. Expected 0 rows, got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [1.1] Bob cannot see Org A RFIs (tenant isolation)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 1.2: Bob (Org B) sees only his own org's RFIs
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM rfis;

  -- Bob should see only Project Beta RFIs (2 from setup.sql)
  IF v_count != 2 THEN
    RAISE EXCEPTION 'FAIL [1.2] Bob should see 2 RFIs (his own), got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [1.2] Bob sees exactly 2 RFIs from his project';
END $$;

-- ---------------------------------------------------------------------------
-- Test 1.3: Alice (Org A) cannot see Org B's RFIs
-- Fixture #1 (reverse direction)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'aa000000-0000-0000-0000-000000000001'; -- Alice

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM rfis
   WHERE id = 'bbb00000-0000-0000-0000-000000000001'; -- Beta RFI-1

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL [1.3] Alice (Org A) can see Org B RFI. Expected 0 rows, got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [1.3] Alice cannot see Org B RFIs (tenant isolation)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 1.4: Alice sees only her own project's RFIs
-- Fixture #14 — project scoping within user's accessible projects
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Alice is only a member of Project Alpha, so RLS should restrict to 3 RFIs
  SELECT count(*)
    INTO v_count
    FROM rfis;

  IF v_count != 3 THEN
    RAISE EXCEPTION 'FAIL [1.4] Alice should see 3 RFIs (Project Alpha only), got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [1.4] Alice sees exactly 3 RFIs from Project Alpha';
END $$;

-- ---------------------------------------------------------------------------
-- Test 1.5: Unauthenticated user sees nothing
-- ---------------------------------------------------------------------------
SET LOCAL role TO 'anon';

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM rfis;

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL [1.5] Unauthenticated user can see RFIs. Expected 0, got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [1.5] Unauthenticated user sees 0 RFIs';
END $$;

-- Reset role
RESET role;
RESET request.jwt.claim.sub;

ROLLBACK; -- No persistent changes from this test
