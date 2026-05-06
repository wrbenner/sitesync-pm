-- ═══════════════════════════════════════════════════════════════
-- Migration: per_project_role_overrides
-- Version: 20260502100002
--
-- Purpose: lets a user be 'pm' org-wide but 'viewer' on a single job
-- (and vice-versa). Override is keyed (project_id, user_id); when a
-- row exists, it WINS over the org-level role for permission checks
-- on that project.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS per_project_role_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- One of: a built-in role name or a custom_role_id (uuid as text).
  -- The hook discriminates: starts with 'custom:' → custom role;
  -- otherwise → built-in role lookup.
  override_role   text NOT NULL,
  -- Optional explicit permission additions / subtractions on top of
  -- the override role. Lets the admin write "viewer plus rfis.respond".
  add_permissions text[]    NOT NULL DEFAULT ARRAY[]::text[],
  remove_permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  reason          text,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  granted_by      uuid REFERENCES auth.users(id),
  expires_at      timestamptz,
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_per_project_role_overrides_user
  ON per_project_role_overrides (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_per_project_role_overrides_project
  ON per_project_role_overrides (project_id);

ALTER TABLE per_project_role_overrides ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'per_project_overrides_admin_rw') THEN
    CREATE POLICY per_project_overrides_admin_rw ON per_project_role_overrides
      FOR ALL
      USING (project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid() AND pm.role IN ('owner','admin','pm')
      ))
      WITH CHECK (project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid() AND pm.role IN ('owner','admin','pm')
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'per_project_overrides_self_read') THEN
    CREATE POLICY per_project_overrides_self_read ON per_project_role_overrides
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;
