-- Phase 7: Team invitation flow.
-- Adapted from sitesyncai-backend-main/src/invite/invite.service.ts.
-- Enhancements: per-project invitations, bulk CSV tracking, revocation.

CREATE TABLE IF NOT EXISTS invite_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'viewer',
  project_ids uuid[] DEFAULT '{}',
  invited_by uuid REFERENCES auth.users(id),
  token text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_logs_org_email ON invite_logs(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_invite_logs_token ON invite_logs(token);
CREATE INDEX IF NOT EXISTS idx_invite_logs_status ON invite_logs(organization_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_logs_pending_unique
  ON invite_logs(organization_id, lower(email))
  WHERE status = 'pending';

ALTER TABLE invite_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY invite_logs_select ON invite_logs FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY invite_logs_insert ON invite_logs FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL AND invited_by = (select auth.uid()));
CREATE POLICY invite_logs_update ON invite_logs FOR UPDATE
  USING ((select auth.uid()) IS NOT NULL);
