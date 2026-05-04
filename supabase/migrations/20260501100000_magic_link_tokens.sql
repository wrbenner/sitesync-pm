-- ═══════════════════════════════════════════════════════════════
-- Migration: magic_link_tokens
-- Version: 20260501100000
--
-- Purpose: per-entity, time-limited share tokens for non-app-users
-- (typically the architect or owner counsel). Each row records a
-- token, what it's scoped to, who it was issued to, and audit data
-- about who actually used it.
--
-- Tokens are NOT stored as JWTs in plaintext. We store a SHA-256
-- digest of the token; the original is emitted once at issuance and
-- never persisted. This means a DBA with read access cannot use the
-- tokens — they'd have to forge the JWT signature, which requires
-- the function's signing secret.
--
-- Forward-secrecy by row, not by user: if one architect's link is
-- compromised, only that one entity is exposed. The same architect
-- gets a fresh token per entity.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Entity scope. The token is valid ONLY for this (entity_type, entity_id).
  -- The page checks this on every query; cross-entity access is 403.
  entity_type     text NOT NULL CHECK (entity_type IN ('rfi', 'submittal', 'change_order', 'punch_item')),
  entity_id       uuid NOT NULL,
  -- 'view'   — read-only
  -- 'comment' — read + post comment + reply via the email-in chain
  scope           text NOT NULL DEFAULT 'view' CHECK (scope IN ('view', 'comment')),
  -- The address the link was issued to. For audit-trail purposes only —
  -- we don't enforce that the opener equals this address (architects
  -- forward to subordinates). Mismatches are flagged in metadata.
  recipient_email text NOT NULL,
  -- SHA-256 of the original JWT. Comparison is constant-time at lookup.
  token_hash      text NOT NULL UNIQUE,
  issued_by       uuid REFERENCES auth.users(id),
  issued_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  -- Per-access audit. We append on every page load via a small RPC.
  accessed_count  int NOT NULL DEFAULT 0,
  first_accessed_at timestamptz,
  last_accessed_at  timestamptz,
  -- Captured opportunistically; null if the page is opened with a UA we
  -- can't classify. The UA + IP let us flag "the architect's link was
  -- opened from a different country than they normally are" later.
  accessed_ua     text,
  accessed_ip     text,
  -- True when the recipient_email != opener_email (we can detect via
  -- the email-in reply chain). Doesn't block access; just flags.
  forwarded       boolean NOT NULL DEFAULT false,
  forwarded_email text,
  -- Manual revocation. The lookup RPC checks this AND expires_at.
  revoked_at      timestamptz,
  revoked_by      uuid REFERENCES auth.users(id),
  revoked_reason  text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_entity
  ON magic_link_tokens (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_project
  ON magic_link_tokens (project_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_recipient
  ON magic_link_tokens (recipient_email);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE magic_link_tokens ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'magic_link_tokens_project_read') THEN
    CREATE POLICY magic_link_tokens_project_read ON magic_link_tokens
      FOR SELECT
      USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'magic_link_tokens_service_write') THEN
    CREATE POLICY magic_link_tokens_service_write ON magic_link_tokens
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
