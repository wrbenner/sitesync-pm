-- =============================================================================
-- Pay App Owner Previews (magic-link portal)
-- =============================================================================
-- Owner-side preview of a pay app, accessed via a signed magic link rather
-- than a Supabase session. The token in the URL is the auth: validated
-- server-side, scoped to (pay_app_id, expires_at). On first access the
-- expiry rotates 24 hours forward (token gets reissued), so an owner who
-- bookmarks the link can keep using it.
--
-- Owners may comment on the preview ("can you reduce line 4 to 60%?") and
-- approve it. Approval sets `approved_at` + the email used to access. The
-- comment thread is a row-per-comment table joined back via preview_id.
-- =============================================================================

CREATE TABLE IF NOT EXISTS payapp_owner_previews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_app_id          uuid NOT NULL REFERENCES payment_applications(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- SHA-256 of the random token. Plaintext is sent in the URL only; we never
  -- store it in the DB. Lookups: hash the URL token, compare here.
  magic_token_hash    text NOT NULL,
  expires_at          timestamptz NOT NULL,
  accessed_at         timestamptz,
  -- Approval.
  approved_at         timestamptz,
  approved_by_email   text,
  -- Optional comment thread id — rows live in payapp_owner_preview_comments.
  comment_thread_id   uuid,
  -- Provenance.
  created_via         text NOT NULL DEFAULT 'manual',
  source_drafted_action_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_previews_pay_app
  ON payapp_owner_previews(pay_app_id);
CREATE INDEX IF NOT EXISTS idx_owner_previews_token_hash
  ON payapp_owner_previews(magic_token_hash);
CREATE INDEX IF NOT EXISTS idx_owner_previews_expires
  ON payapp_owner_previews(expires_at) WHERE approved_at IS NULL;

CREATE TABLE IF NOT EXISTS payapp_owner_preview_comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_id          uuid NOT NULL
                            REFERENCES payapp_owner_previews(id) ON DELETE CASCADE,
  pay_app_id          uuid NOT NULL
                            REFERENCES payment_applications(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_email        text NOT NULL,
  author_role         text NOT NULL DEFAULT 'owner'
                            CHECK (author_role IN ('owner','gc','sub','viewer')),
  comment             text NOT NULL CHECK (length(comment) >= 1),
  -- Optional anchor to a specific SOV line (cost code).
  cost_code_anchor    text,
  resolved            boolean NOT NULL DEFAULT false,
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preview_comments_preview
  ON payapp_owner_preview_comments(preview_id, created_at);
CREATE INDEX IF NOT EXISTS idx_preview_comments_project
  ON payapp_owner_preview_comments(project_id, resolved);

ALTER TABLE payapp_owner_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payapp_owner_preview_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_preview_member_select ON payapp_owner_previews;
CREATE POLICY owner_preview_member_select ON payapp_owner_previews
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS owner_preview_member_insert ON payapp_owner_previews;
CREATE POLICY owner_preview_member_insert ON payapp_owner_previews
  FOR INSERT WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS preview_comments_member_select ON payapp_owner_preview_comments;
CREATE POLICY preview_comments_member_select ON payapp_owner_preview_comments
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- INSERT/UPDATE on previews + comments from the public magic-link path runs
-- under the service-role client, which bypasses RLS by design — clients
-- never write here directly.

COMMENT ON TABLE  payapp_owner_previews
  IS 'Magic-link sharable read-only preview of a pay app for the owner.';
COMMENT ON COLUMN payapp_owner_previews.magic_token_hash
  IS 'SHA-256 of the URL token; plaintext is never stored.';
