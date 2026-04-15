-- =============================================================================
-- Layer 1 Test: State Machine CHECK Constraints
-- =============================================================================
-- Validates DOMAIN_KERNEL_SPEC.md §5 State Machines:
--   - rfis.status CHECK accepts all 6 kernel states
--   - rfis.status CHECK rejects invalid values
--   - Default status is 'draft' (kernel entry point)
--
-- NOTE: This tests CHECK constraints only — NOT transition enforcement.
-- Transition enforcement (e.g., blocking draft→closed) requires triggers
-- which are deferred. This test validates the DB schema is correct.
--
-- Depends on: 20260415000001_rfi_status_widen.sql
-- =============================================================================

-- Test 4.1: All 6 kernel RFI states are accepted by CHECK constraint
DO $$
DECLARE
  v_rfi_id uuid;
  v_states text[] := ARRAY['draft', 'open', 'under_review', 'answered', 'closed', 'void'];
  v_state text;
BEGIN
  -- Create a test RFI to mutate
  INSERT INTO rfis (project_id, title, status, created_at, updated_at)
  VALUES (
    (SELECT id FROM projects LIMIT 1),
    'State Machine Test RFI',
    'draft',
    now(), now()
  ) RETURNING id INTO v_rfi_id;

  -- Test each kernel state
  FOREACH v_state IN ARRAY v_states LOOP
    UPDATE rfis SET status = v_state WHERE id = v_rfi_id;
  END LOOP;

  -- Cleanup
  DELETE FROM rfis WHERE id = v_rfi_id;

  RAISE NOTICE 'PASS [4.1] All 6 kernel RFI states accepted by CHECK constraint';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'FAIL [4.1] A valid kernel state was rejected: %', SQLERRM;
END $$;

-- Test 4.2: Invalid RFI status is rejected
DO $$
DECLARE
  v_rfi_id uuid;
BEGIN
  INSERT INTO rfis (project_id, title, status, created_at, updated_at)
  VALUES (
    (SELECT id FROM projects LIMIT 1),
    'Invalid State Test RFI',
    'draft',
    now(), now()
  ) RETURNING id INTO v_rfi_id;

  BEGIN
    UPDATE rfis SET status = 'bogus_state' WHERE id = v_rfi_id;
    -- If we get here, the CHECK didn't fire
    DELETE FROM rfis WHERE id = v_rfi_id;
    RAISE NOTICE 'FAIL [4.2] Invalid status "bogus_state" was accepted — CHECK constraint missing or broken';
  EXCEPTION WHEN check_violation THEN
    DELETE FROM rfis WHERE id = v_rfi_id;
    RAISE NOTICE 'PASS [4.2] Invalid status "bogus_state" correctly rejected by CHECK';
  END;
END $$;

-- Test 4.3: Default status is 'draft' (kernel entry point)
DO $$
DECLARE
  v_status text;
  v_rfi_id uuid;
BEGIN
  INSERT INTO rfis (project_id, title, created_at, updated_at)
  VALUES (
    (SELECT id FROM projects LIMIT 1),
    'Default State Test RFI',
    now(), now()
  ) RETURNING id, status INTO v_rfi_id, v_status;

  DELETE FROM rfis WHERE id = v_rfi_id;

  IF v_status = 'draft' THEN
    RAISE NOTICE 'PASS [4.3] Default rfis.status is ''draft'' (kernel entry point)';
  ELSE
    RAISE NOTICE 'FAIL [4.3] Default rfis.status is ''%'' — expected ''draft''', v_status;
  END IF;
END $$;

-- Still deferred:
DO $$
BEGIN
  RAISE NOTICE 'SKIP [4.4] Submittal state machine — blocked on submittal status widening';
  RAISE NOTICE 'SKIP [4.5] Change order state machine — blocked on CO status widening';
  RAISE NOTICE 'SKIP [4.6] Pay application state machine — blocked on pay app status widening';
  RAISE NOTICE 'SKIP [4.7] Permit state machine — blocked on permit status widening';
END $$;
