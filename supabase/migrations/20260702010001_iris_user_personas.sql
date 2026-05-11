-- ────────────────────────────────────────────────────────────────────────────
-- iris_user_personas — per-user persona binding (Phase 1a scaffold)
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §3.3 + §5.4
-- ADR-019 override hierarchy: workflow > persona-override > org-default > system-default
--
-- Resolution order for "what persona does this user run as on this project?":
--   1. Workflow-pinned override (Phase 2e, not stored here — passed at invocation)
--   2. Per-(user, project) row in this table        ← project_id IS NOT NULL
--   3. Per-(user, org) row in this table            ← project_id IS NULL
--   4. role_to_default_persona table (Phase 1d) keyed by user's project role
--
-- Rollback path: DROP TABLE iris_user_personas; iris_personas table is unaffected.

CREATE TABLE IF NOT EXISTS iris_user_personas (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  persona_slug TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, org_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE INDEX IF NOT EXISTS idx_iris_user_personas_lookup
  ON iris_user_personas (user_id, org_id, project_id);

COMMENT ON TABLE iris_user_personas IS
  'Per-user persona binding. A row with project_id IS NULL is the user''s org-default persona. A row with project_id set overrides the org default for that one project. Missing rows fall through to role_to_default_persona (Phase 1d).';

ALTER TABLE iris_user_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iris_user_personas: users see their own bindings"
  ON iris_user_personas FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "iris_user_personas: admins manage org bindings"
  ON iris_user_personas FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
