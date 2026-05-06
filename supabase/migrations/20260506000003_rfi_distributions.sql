-- ═══════════════════════════════════════════════════════════════
-- Migration: rfi_distributions
-- Version:   20260506000003
-- Purpose:   Track distribution events for an RFI — when a PM
--            "Forwards" or "Distributes" the RFI to a sub or other
--            party. Minimum data model for P0; the full distribution
--            list management feature ships in P1.
--
--            Drives:
--              • P0 item #8 "Distribute / Forward to sub button"
--              • Future email-out + per-recipient open tracking
--              • Audit-log story ("RFI-072 was forwarded to MEP sub
--                 on May 12 at 3:14 PM by Walker Benner")
--
--            Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rfi_distributions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id            UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  -- Email is required; name is optional and resolves the recipient on
  -- the activity feed without requiring a profile lookup.
  recipient_email   TEXT NOT NULL CHECK (length(trim(recipient_email)) > 0),
  recipient_name    TEXT,
  -- Optional message attached to the distribution (think: forwarded-by
  -- note "@MEP — please review section 09 21 16").
  message           TEXT,
  sent_by           UUID REFERENCES auth.users(id),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfi_distributions_rfi
  ON rfi_distributions(rfi_id);
CREATE INDEX IF NOT EXISTS idx_rfi_distributions_sent_at
  ON rfi_distributions(sent_at DESC);

ALTER TABLE rfi_distributions ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member of the parent RFI's project can read.
DROP POLICY IF EXISTS rfi_distributions_select ON rfi_distributions;
CREATE POLICY rfi_distributions_select ON rfi_distributions FOR SELECT
  USING (
    is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
  );

-- INSERT: any project member can distribute (matches the broadly-
-- inclusive policy on rfi_watchers, since this is a soft-write that
-- doesn't change the RFI itself). Self-attribution: sent_by must be the
-- caller, preventing a user from forging another user's distribution.
DROP POLICY IF EXISTS rfi_distributions_insert ON rfi_distributions;
CREATE POLICY rfi_distributions_insert ON rfi_distributions FOR INSERT
  WITH CHECK (
    sent_by = (SELECT auth.uid())
    AND is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
  );

-- DELETE: only the sender or project owner/admin can remove a record.
DROP POLICY IF EXISTS rfi_distributions_delete ON rfi_distributions;
CREATE POLICY rfi_distributions_delete ON rfi_distributions FOR DELETE
  USING (
    sent_by = (SELECT auth.uid())
    OR is_project_role(
      (SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
      ARRAY['owner', 'admin']
    )
  );

-- No UPDATE policy — a distribution event is immutable; correct it by
-- deleting + reinserting to preserve the audit story.

COMMENT ON TABLE rfi_distributions IS
  'RFI forward / distribute events. Each row is a single send event '
  'to a single recipient email. Append-only audit story; no UPDATE.';
