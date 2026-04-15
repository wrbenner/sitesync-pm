-- =============================================================================
-- Step 4: Widen rfis.status CHECK to include kernel states (draft, void)
-- =============================================================================
--
-- CURRENT: CHECK (status IN ('open', 'under_review', 'answered', 'closed'))
-- KERNEL:  draft, open, under_review, answered, closed, void
--           (DOMAIN_KERNEL_SPEC.md §5.1, Appendix A.4)
--
-- Client rfiMachine.ts already defines all 6 states. The DB is the bottleneck.
--
-- WHAT THIS DOES:
--   1. Drops old CHECK constraint on rfis.status
--   2. Adds new CHECK accepting all 6 kernel states
--   3. Changes DEFAULT from 'open' to 'draft' (kernel entry point)
--
-- BACKWARD COMPATIBLE:
--   All existing rows use 'open', 'under_review', 'answered', 'closed' —
--   all remain valid. The app currently inserts with status='open'; this
--   continues to work. New code can begin using 'draft' and 'void'.
--
-- ROLLBACK:
--   ALTER TABLE rfis ALTER COLUMN status SET DEFAULT 'open';
--   ALTER TABLE rfis DROP CONSTRAINT IF EXISTS rfis_status_check;
--   ALTER TABLE rfis ADD CONSTRAINT rfis_status_check
--     CHECK (status IN ('open', 'under_review', 'answered', 'closed'));
-- =============================================================================

BEGIN;

-- 1. Drop old constraint
ALTER TABLE rfis DROP CONSTRAINT IF EXISTS rfis_status_check;

-- 2. Add widened constraint with all kernel states
ALTER TABLE rfis ADD CONSTRAINT rfis_status_check
  CHECK (status IN ('draft', 'open', 'under_review', 'answered', 'closed', 'void'));

-- 3. Change default to 'draft' (kernel lifecycle entry point)
--    Existing app code that explicitly sets status='open' on insert is unaffected.
ALTER TABLE rfis ALTER COLUMN status SET DEFAULT 'draft';

COMMENT ON COLUMN rfis.status IS
  'RFI lifecycle state. Valid: draft, open, under_review, answered, closed, void. '
  'See DOMAIN_KERNEL_SPEC.md §5.1. Default changed from open to draft in Step 4.';

COMMIT;
