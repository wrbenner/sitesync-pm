-- =============================================================================
-- Submittal Service Kernel
-- =============================================================================
--
-- PURPOSE: Aligns the submittals table with the service kernel pattern
-- established by rfiService.ts:
--   1. Adds updated_by provenance column
--   2. Creates submittal_reviewers table (sequential reviewer chain)
--   3. Widens status constraint to include gc_review and architect_review
--   4. Adds soft-delete filter to submittals SELECT policy
--   5. Idempotent RLS policies for submittal_reviewers
--
-- IDEMPOTENT: All statements use IF NOT EXISTS / DROP IF EXISTS / DO blocks
-- so this migration is safe to run multiple times.
--
-- ROLLBACK:
--   ALTER TABLE submittals DROP COLUMN IF EXISTS updated_by;
--   DROP TABLE IF EXISTS submittal_reviewers;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add updated_by provenance column to submittals
-- ---------------------------------------------------------------------------
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 2. Widen status constraint to include gc_review and architect_review
--    These are required by submittalMachine.ts state graph.
-- ---------------------------------------------------------------------------
ALTER TABLE submittals DROP CONSTRAINT IF EXISTS submittals_status_check;
ALTER TABLE submittals ADD CONSTRAINT submittals_status_check
  CHECK (status IN (
    'draft', 'pending', 'submitted', 'under_review',
    'gc_review', 'architect_review',
    'approved', 'rejected', 'resubmit', 'closed'
  ));

-- ---------------------------------------------------------------------------
-- 3. Create submittal_reviewers table
--    Sequential reviewer chain: GC PM -> Architect -> Owner, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submittal_reviewers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id  uuid        NOT NULL REFERENCES submittals ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users,
  review_order  int         NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'revise')),
  comments      text,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submittal_reviewers_submittal_id
  ON submittal_reviewers (submittal_id);

CREATE INDEX IF NOT EXISTS idx_submittal_reviewers_user_id
  ON submittal_reviewers (user_id);

-- ---------------------------------------------------------------------------
-- 4. Enable RLS on submittal_reviewers
-- ---------------------------------------------------------------------------
ALTER TABLE submittal_reviewers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. Idempotent RLS policies for submittal_reviewers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS submittal_reviewers_select ON submittal_reviewers;
CREATE POLICY submittal_reviewers_select ON submittal_reviewers
  FOR SELECT
  USING (
    submittal_id IN (
      SELECT id FROM submittals
      WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS submittal_reviewers_insert ON submittal_reviewers;
CREATE POLICY submittal_reviewers_insert ON submittal_reviewers
  FOR INSERT
  WITH CHECK (
    submittal_id IN (
      SELECT id FROM submittals s
      WHERE s.project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager', 'gc_pm')
      )
    )
  );

DROP POLICY IF EXISTS submittal_reviewers_update ON submittal_reviewers;
CREATE POLICY submittal_reviewers_update ON submittal_reviewers
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR submittal_id IN (
      SELECT id FROM submittals s
      WHERE s.project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    )
  );

DROP POLICY IF EXISTS submittal_reviewers_delete ON submittal_reviewers;
CREATE POLICY submittal_reviewers_delete ON submittal_reviewers
  FOR DELETE
  USING (
    submittal_id IN (
      SELECT id FROM submittals s
      WHERE s.project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Update submittals SELECT policy to filter soft-deleted rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS submittals_select ON submittals;
CREATE POLICY submittals_select ON submittals
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

COMMIT;
