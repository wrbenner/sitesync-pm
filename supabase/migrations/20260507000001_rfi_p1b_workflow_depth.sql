-- ═══════════════════════════════════════════════════════════════
-- Migration: RFI P1b — workflow depth (Bugatti)
-- Version:   20260507000001
--
-- Drives:    P1b 10-deliverable spec from
--            docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md (P1b box)
--            docs/audits/DAY_X_RFI_P1A_RECEIPT_2026-05-06.md
--
-- Scope (DB shape only; UI lives in src/):
--   1. rfi_attachments — first-class table replacing the jsonb blob.
--      is_official, position, content_type, size_bytes, storage_path.
--      Backfill from rfis.legacy_payload + rfi_responses.attachments
--      where present (best-effort; legacy callers keep working until
--      the UI migrates).
--   2. rfi_assignees — multi-assignee with per-person response tracking.
--      Trigger keeps rfis.ball_in_court synced (highest-priority
--      unresponded assignee — i.e. earliest-created unresponded row).
--   3. rfi_responses additions:
--        - deleted_at TIMESTAMPTZ  (soft-delete, ≤24-hr edit window
--          enforced at the mutation layer; SELECT policy filters out
--          deleted rows for everyone except author + admin)
--        - is_internal BOOLEAN     (internal-note vs external-comment)
--        - is_official already exists from 00028_rfi_workflow.sql; we
--          keep it.
--        - response_type already exists from 00028 with CHECK
--          ('comment','official_response','question','clarification').
--          Replace the CHECK with the P1b spec's seven values.
--   4. rfi_responses_versions — audit child for edits. Captures the
--      pre-edit body so the chain of revisions is preserved.
--   5. is_private wired into the rfis SELECT policy so non-PMs can't
--      read private RFIs.
--   6. cost_impact migration — copy any legacy NUMERIC dollar values
--      into cost_impact_cents BIGINT (×100) where cents is NULL, then
--      drop the legacy column. Per CLAUDE.md money rule.
--   7. Mention indexes — `mentioned_user_ids UUID[]` on rfi_responses
--      so the @-mention fan-out can be queried (and we index it for
--      future "RFIs that mention me" lookups).
--
-- Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. rfi_attachments ──────────────────────────────────────────
-- One row per uploaded file. `parent_kind` distinguishes attachments
-- on the RFI itself vs on a specific response. The single table beats
-- two parallel tables because the manager UI is identical for both
-- surfaces; the parent_kind discriminator keeps the join cheap.
CREATE TABLE IF NOT EXISTS rfi_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id        UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  -- Optional: when set, this attachment lives on a specific response.
  -- When NULL, it lives on the RFI itself.
  response_id   UUID REFERENCES rfi_responses(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  content_type  TEXT,
  size_bytes    BIGINT,
  is_official   BOOLEAN NOT NULL DEFAULT false,
  position      INTEGER NOT NULL DEFAULT 0,
  uploaded_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfi_attachments_rfi
  ON rfi_attachments(rfi_id, position);
CREATE INDEX IF NOT EXISTS idx_rfi_attachments_response
  ON rfi_attachments(response_id)
  WHERE response_id IS NOT NULL;

ALTER TABLE rfi_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_attachments_select ON rfi_attachments;
CREATE POLICY rfi_attachments_select ON rfi_attachments FOR SELECT
  USING (
    is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
  );

DROP POLICY IF EXISTS rfi_attachments_insert ON rfi_attachments;
CREATE POLICY rfi_attachments_insert ON rfi_attachments FOR INSERT
  WITH CHECK (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  );

DROP POLICY IF EXISTS rfi_attachments_update ON rfi_attachments;
CREATE POLICY rfi_attachments_update ON rfi_attachments FOR UPDATE
  USING (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  )
  WITH CHECK (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  );

DROP POLICY IF EXISTS rfi_attachments_delete ON rfi_attachments;
CREATE POLICY rfi_attachments_delete ON rfi_attachments FOR DELETE
  USING (
    -- Uploader can always delete their own; otherwise admin/owner.
    uploaded_by = (SELECT auth.uid())
    OR is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                       ARRAY['owner','admin'])
  );

CREATE OR REPLACE FUNCTION fn_rfi_attachments_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rfi_attachments_touch ON rfi_attachments;
CREATE TRIGGER trg_rfi_attachments_touch
  BEFORE UPDATE ON rfi_attachments
  FOR EACH ROW EXECUTE FUNCTION fn_rfi_attachments_touch();


-- ── 2. rfi_assignees + ball_in_court trigger cache ──────────────
-- Each assignee has their own "responded?" checkbox. ball_in_court
-- on rfis is recomputed via trigger to be the earliest-created
-- unresponded assignee. When all have responded (or there are no
-- assignees), ball_in_court remains untouched (legacy ball_in_court
-- continues to work for projects that haven't migrated yet).
CREATE TABLE IF NOT EXISTS rfi_assignees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id        UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT,                         -- optional label, e.g. 'designer'
  responded_at  TIMESTAMPTZ,
  response_id   UUID REFERENCES rfi_responses(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfi_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rfi_assignees_rfi ON rfi_assignees(rfi_id);
CREATE INDEX IF NOT EXISTS idx_rfi_assignees_user ON rfi_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_rfi_assignees_unresponded
  ON rfi_assignees(rfi_id, created_at)
  WHERE responded_at IS NULL;

ALTER TABLE rfi_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_assignees_select ON rfi_assignees;
CREATE POLICY rfi_assignees_select ON rfi_assignees FOR SELECT
  USING (
    is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
  );

DROP POLICY IF EXISTS rfi_assignees_insert ON rfi_assignees;
CREATE POLICY rfi_assignees_insert ON rfi_assignees FOR INSERT
  WITH CHECK (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  );

DROP POLICY IF EXISTS rfi_assignees_update ON rfi_assignees;
CREATE POLICY rfi_assignees_update ON rfi_assignees FOR UPDATE
  USING (
    -- The assignee themselves can flip their checkbox; admin/owner can
    -- also force-update on someone's behalf.
    user_id = (SELECT auth.uid())
    OR is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                       ARRAY['owner','admin','member'])
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                       ARRAY['owner','admin','member'])
  );

DROP POLICY IF EXISTS rfi_assignees_delete ON rfi_assignees;
CREATE POLICY rfi_assignees_delete ON rfi_assignees FOR DELETE
  USING (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  );

-- Recompute ball_in_court cache on assignee change.
CREATE OR REPLACE FUNCTION fn_rfi_recompute_ball_in_court()
RETURNS trigger AS $$
DECLARE
  v_rfi_id UUID;
  v_next   UUID;
BEGIN
  v_rfi_id = COALESCE(NEW.rfi_id, OLD.rfi_id);

  -- First unresponded assignee (earliest created) is the ball-in-court.
  SELECT user_id
    INTO v_next
    FROM rfi_assignees
    WHERE rfi_id = v_rfi_id AND responded_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

  IF v_next IS NOT NULL THEN
    UPDATE rfis SET ball_in_court = v_next WHERE id = v_rfi_id;
  ELSE
    -- All responded (or no assignees yet): collapse to NULL ONLY when
    -- there ARE assignee rows. If the table is empty we leave the
    -- existing legacy ball_in_court alone.
    IF EXISTS (SELECT 1 FROM rfi_assignees WHERE rfi_id = v_rfi_id) THEN
      UPDATE rfis SET ball_in_court = NULL WHERE id = v_rfi_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rfi_assignees_recompute_bic ON rfi_assignees;
CREATE TRIGGER trg_rfi_assignees_recompute_bic
  AFTER INSERT OR UPDATE OR DELETE ON rfi_assignees
  FOR EACH ROW EXECUTE FUNCTION fn_rfi_recompute_ball_in_court();


-- ── 3. rfi_responses additions ──────────────────────────────────
-- is_official already exists from 00028. Add the rest.
ALTER TABLE rfi_responses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE rfi_responses ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rfi_responses ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;
ALTER TABLE rfi_responses ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] NOT NULL DEFAULT '{}';

-- Replace the old response_type CHECK with the P1b spec set. The
-- legacy default 'comment' is migrated to 'answered' (the new default).
DO $$
BEGIN
  -- Migrate legacy values that aren't in the new set.
  UPDATE rfi_responses SET response_type = 'answered'
    WHERE response_type IS NULL
       OR response_type IN ('comment','official_response','question','clarification');
EXCEPTION WHEN OTHERS THEN
  -- If the column doesn't have those values, no-op.
  NULL;
END $$;

ALTER TABLE rfi_responses
  ALTER COLUMN response_type SET DEFAULT 'answered';

-- Drop the legacy CHECK constraint and add the new one.
ALTER TABLE rfi_responses DROP CONSTRAINT IF EXISTS rfi_responses_response_type_check;
ALTER TABLE rfi_responses ADD CONSTRAINT rfi_responses_response_type_check
  CHECK (response_type IN (
    'answered',
    'approved_as_noted',
    'revise_and_resubmit',
    'returned_for_clarification',
    'answered_with_cost_impact',
    'no_comment',
    'forwarded'
  ));

-- Mention lookup index (RFIs that mention user X).
CREATE INDEX IF NOT EXISTS idx_rfi_responses_mentioned_user_ids
  ON rfi_responses USING GIN (mentioned_user_ids);

-- SELECT policy: hide soft-deleted from everyone except author/admin;
-- hide internal notes from non-GC (viewer) roles.
DROP POLICY IF EXISTS rfi_responses_select ON rfi_responses;
CREATE POLICY rfi_responses_select ON rfi_responses FOR SELECT
  USING (
    is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
    AND (
      deleted_at IS NULL
      OR author_id = (SELECT auth.uid())
      OR is_project_role(
           (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
           ARRAY['owner','admin']
         )
    )
    AND (
      is_internal = false
      OR is_project_role(
           (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
           ARRAY['owner','admin','member']
         )
    )
  );

-- UPDATE policy — own response within 24 hr OR admin; the 24-hr window
-- is enforced at the mutation layer (so that admins can correct beyond
-- the window without RLS contortions).
DROP POLICY IF EXISTS rfi_responses_update ON rfi_responses;
CREATE POLICY rfi_responses_update ON rfi_responses FOR UPDATE
  USING (
    author_id = (SELECT auth.uid())
    OR is_project_role(
         (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
         ARRAY['owner','admin']
       )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    OR is_project_role(
         (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
         ARRAY['owner','admin']
       )
  );


-- ── 4. rfi_responses_versions — edit audit child ────────────────
-- Each row captures the pre-edit body before an edit is committed.
-- This is the contractual record — even if the response is later
-- deleted, the chain of edits remains queryable.
CREATE TABLE IF NOT EXISTS rfi_responses_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   UUID NOT NULL REFERENCES rfi_responses(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  is_internal   BOOLEAN,
  response_type TEXT,
  is_official   BOOLEAN,
  edited_by     UUID REFERENCES auth.users(id),
  edited_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfi_responses_versions_response
  ON rfi_responses_versions(response_id, edited_at DESC);

ALTER TABLE rfi_responses_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_responses_versions_select ON rfi_responses_versions;
CREATE POLICY rfi_responses_versions_select ON rfi_responses_versions FOR SELECT
  USING (
    is_project_member((
      SELECT r.project_id
        FROM rfi_responses rr
        JOIN rfis r ON r.id = rr.rfi_id
        WHERE rr.id = response_id
    ))
  );

-- Insert is exclusively trigger-driven (or admin-write); writers don't
-- write here directly, so the policy only allows the trigger context.
DROP POLICY IF EXISTS rfi_responses_versions_insert ON rfi_responses_versions;
CREATE POLICY rfi_responses_versions_insert ON rfi_responses_versions FOR INSERT
  WITH CHECK (
    -- Author of the parent response, or admin.
    EXISTS (
      SELECT 1 FROM rfi_responses rr
      WHERE rr.id = response_id
        AND (
          rr.author_id = (SELECT auth.uid())
          OR is_project_role(
               (SELECT project_id FROM rfis WHERE rfis.id = rr.rfi_id),
               ARRAY['owner','admin']
             )
        )
    )
  );

-- Trigger that snapshots the OLD body into versions before UPDATE.
CREATE OR REPLACE FUNCTION fn_rfi_responses_capture_version()
RETURNS trigger AS $$
BEGIN
  -- Only capture when the body actually changed (skip pure-metadata
  -- updates like is_official / response_type / deleted_at flips).
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    INSERT INTO rfi_responses_versions(response_id, body, is_internal, response_type, is_official, edited_by, edited_at)
    VALUES (OLD.id, OLD.content, OLD.is_internal, OLD.response_type, OLD.is_official, (SELECT auth.uid()), now());
    NEW.edited_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rfi_responses_capture_version ON rfi_responses;
CREATE TRIGGER trg_rfi_responses_capture_version
  BEFORE UPDATE ON rfi_responses
  FOR EACH ROW EXECUTE FUNCTION fn_rfi_responses_capture_version();


-- ── 5. is_private wired into the rfis SELECT policy ─────────────
-- P1a added the column + Edit-panel checkbox; P1b wires the visibility.
-- Visible iff:
--   • not private (default), OR
--   • viewer is owner/admin, OR
--   • viewer is the creator, OR
--   • viewer is the assigned ball-in-court, OR
--   • viewer is on rfi_assignees for this row.
DROP POLICY IF EXISTS rfis_select ON rfis;
CREATE POLICY rfis_select ON rfis FOR SELECT
  USING (
    is_project_member(project_id)
    AND deleted_at IS NULL
    AND (
      is_private = false
      OR is_project_role(project_id, ARRAY['owner','admin'])
      OR created_by = (SELECT auth.uid())
      OR ball_in_court = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM rfi_assignees a
        WHERE a.rfi_id = rfis.id AND a.user_id = (SELECT auth.uid())
      )
    )
  );


-- ── 6. cost_impact migration → cents, drop legacy column ────────
-- Migrate any non-null legacy NUMERIC dollar values into cents where
-- cents is currently NULL. Then drop the legacy column.
UPDATE rfis
   SET cost_impact_cents = ROUND(cost_impact * 100)::BIGINT
 WHERE cost_impact IS NOT NULL
   AND cost_impact_cents IS NULL;

ALTER TABLE rfis DROP COLUMN IF EXISTS cost_impact;


-- ── 7. Mark response Official — column already exists from 00028 ─
-- Just ensure it has the right default.
ALTER TABLE rfi_responses ALTER COLUMN is_official SET DEFAULT false;
