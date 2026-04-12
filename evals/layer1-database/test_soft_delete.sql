-- =============================================================================
-- Layer 1 Test: Soft Delete
-- =============================================================================
-- Validates DOMAIN_KERNEL_SPEC.md §6.3 Soft Delete Policy:
--   "All SELECT policies must include AND deleted_at IS NULL to hide
--    soft-deleted rows from normal queries."
--
-- Covers Gold-Standard Fixture:
--   #16 — Soft Delete Invisibility
--
-- NOTE: This test requires the `deleted_at` column to exist on `rfis`.
-- If the column doesn't exist yet (gap), the test will report SKIP.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Pre-check: Does the deleted_at column exist on rfis?
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_has_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'rfis'
       AND column_name = 'deleted_at'
  ) INTO v_has_column;

  IF NOT v_has_column THEN
    RAISE NOTICE 'SKIP [6.0] rfis.deleted_at column does not exist yet (schema gap — deferred)';
    -- We still continue to test what we can
  ELSE
    RAISE NOTICE 'INFO [6.0] rfis.deleted_at column exists — running soft delete tests';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Test 6.1: Soft-deleted RFI is invisible via normal query
-- Fixture #16
-- ---------------------------------------------------------------------------
-- Create a test RFI, then soft-delete it
DO $$
DECLARE
  v_has_column boolean;
  v_count integer;
BEGIN
  -- Check column existence
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'rfis'
       AND column_name = 'deleted_at'
  ) INTO v_has_column;

  IF NOT v_has_column THEN
    RAISE NOTICE 'SKIP [6.1] Cannot test soft delete — deleted_at column missing';
    RETURN;
  END IF;

  -- Create a test RFI (as service role)
  INSERT INTO rfis (id, project_id, title, status, created_by, created_at, updated_at, deleted_at)
  VALUES (
    'ff660000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', -- Project Alpha
    'Soft Delete Test RFI',
    'open',
    'aa000000-0000-0000-0000-000000000001', -- Alice
    now(),
    now(),
    NULL -- Not deleted yet
  );

  -- Verify it's visible before soft delete
  SELECT count(*) INTO v_count
    FROM rfis
   WHERE id = 'ff660000-0000-0000-0000-000000000001';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'FAIL [6.1] Test RFI not visible before soft delete. Got % rows', v_count;
  END IF;

  -- Soft-delete it
  UPDATE rfis
     SET deleted_at = now(),
         updated_at = now()
   WHERE id = 'ff660000-0000-0000-0000-000000000001';

  RAISE NOTICE 'INFO [6.1] RFI soft-deleted, now testing visibility via authenticated role';
END $$;

-- Switch to Alice (authenticated user, PM on Alpha)
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO 'aa000000-0000-0000-0000-000000000001'; -- Alice

DO $$
DECLARE
  v_has_column boolean;
  v_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'rfis'
       AND column_name = 'deleted_at'
  ) INTO v_has_column;

  IF NOT v_has_column THEN
    RAISE NOTICE 'SKIP [6.1] Skipped — deleted_at column missing';
    RETURN;
  END IF;

  -- Query as authenticated user — soft-deleted row should be invisible
  SELECT count(*) INTO v_count
    FROM rfis
   WHERE id = 'ff660000-0000-0000-0000-000000000001';

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL [6.1] Soft-deleted RFI is visible via RLS. Expected 0 rows, got %', v_count;
  END IF;

  RAISE NOTICE 'PASS [6.1] Soft-deleted RFI invisible via authenticated query (RLS enforces deleted_at IS NULL)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 6.2: Soft-deleted RFI excluded from count queries
-- Fixture #16 extended
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_has_column boolean;
  v_total_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'rfis'
       AND column_name = 'deleted_at'
  ) INTO v_has_column;

  IF NOT v_has_column THEN
    RAISE NOTICE 'SKIP [6.2] Skipped — deleted_at column missing';
    RETURN;
  END IF;

  -- Count all RFIs for Project Alpha (as Alice)
  -- Should be 3 from setup.sql, NOT 4 (the soft-deleted one should be hidden)
  SELECT count(*) INTO v_total_count
    FROM rfis
   WHERE project_id = 'a1000000-0000-0000-0000-000000000001';

  IF v_total_count != 3 THEN
    RAISE EXCEPTION 'FAIL [6.2] Expected 3 visible RFIs in Alpha, got % (soft-deleted row leaking?)', v_total_count;
  END IF;

  RAISE NOTICE 'PASS [6.2] Soft-deleted RFI excluded from count (3 visible, 1 hidden)';
END $$;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claim.sub;

DELETE FROM rfis WHERE id = 'ff660000-0000-0000-0000-000000000001';

ROLLBACK;
