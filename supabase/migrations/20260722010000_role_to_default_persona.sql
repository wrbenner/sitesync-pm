-- ────────────────────────────────────────────────────────────────────────────
-- role_to_default_persona — system fallback when no iris_user_personas row
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §5.4
-- ADR-019: persona model override hierarchy.
--
-- Resolution order (Phase 1d completes the hierarchy):
--   1. workflow_override (passed at invocation, never persisted)
--   2. iris_user_personas (project_id NOT NULL)        ← project-level override
--   3. iris_user_personas (project_id IS NULL)         ← org-level binding
--   4. THIS TABLE keyed by user's canonical Role enum  ← system fallback
--   5. 'pm' if nothing matches (with home-banner per spec §6.1)
--
-- Rows are seeded from the 15-value canonical ROLES enum in src/permissions.ts.
-- The mapping is editable per-tenant via the (org_id NOT NULL) variant if a
-- design-build firm needs different defaults; Phase 1a already proved that
-- pattern works with iris_personas.
--
-- Rollback: DROP TABLE role_to_default_persona;

CREATE TABLE IF NOT EXISTS role_to_default_persona (
  role TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  persona_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE INDEX IF NOT EXISTS idx_role_to_default_persona_lookup
  ON role_to_default_persona (role, org_id);

COMMENT ON TABLE role_to_default_persona IS
  'Final-fallback Role → PersonaSlug map per ADR-019 / IRIS_PHASE_1 §5.4. Org-level overrides via (org_id, role) rows that supersede the system default. The Phase 1d resolve_persona RPC consults this table only after iris_user_personas misses.';

ALTER TABLE role_to_default_persona ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_to_default_persona: anyone can read system + own-org rows"
  ON role_to_default_persona FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "role_to_default_persona: admins can manage own-org rows"
  ON role_to_default_persona FOR ALL
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Seed system defaults — maps each of the 15 canonical Role values to one of
-- the 5 personas. Permissive defaults: when in doubt, route to PM (the most
-- general persona); a top banner explains the choice and offers a path to
-- request a change.
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO role_to_default_persona (role, org_id, persona_slug) VALUES
  ('owner',             NULL, 'pm'),             -- org owner ≠ project owner; treat as PM
  ('project_executive', NULL, 'pm'),
  ('admin',             NULL, 'pm'),
  ('project_manager',   NULL, 'pm'),
  ('superintendent',    NULL, 'superintendent'),
  ('foreman',           NULL, 'foreman'),
  ('project_engineer',  NULL, 'pm'),
  ('field_engineer',    NULL, 'superintendent'),
  ('safety_manager',    NULL, 'superintendent'),
  ('subcontractor',     NULL, 'pm'),             -- sub PMs use PM persona per spec §5.4
  ('architect',         NULL, 'pm'),
  ('owner_rep',         NULL, 'owner_rep'),
  ('member',            NULL, 'pm'),             -- generic member; banner asks for assignment
  ('field_user',        NULL, 'foreman'),
  ('viewer',            NULL, 'owner_rep')       -- read-only role; owner_rep is read-only
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- resolve_persona() RPC — the canonical server-side resolver per ADR-019
-- ────────────────────────────────────────────────────────────────────────────
-- Returns the PersonaSlug for (user, project). Walks the override hierarchy
-- top-down. Never returns NULL — 'pm' is the final fallback.
--
-- Phase 1d UI calls usePersona() which calls this RPC. Phase 2 specialists
-- can also call it server-side from edge functions when assembling a context
-- for an auto-execute path.

CREATE OR REPLACE FUNCTION resolve_persona(p_user_id UUID, p_project_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_persona TEXT;
  v_role TEXT;
BEGIN
  -- Resolve the user's org (from profiles).
  SELECT org_id INTO v_org_id FROM profiles WHERE id = p_user_id;
  IF v_org_id IS NULL THEN
    RETURN 'pm';
  END IF;

  -- 2. Project-level binding wins.
  IF p_project_id IS NOT NULL THEN
    SELECT persona_slug INTO v_persona
    FROM iris_user_personas
    WHERE user_id = p_user_id AND org_id = v_org_id AND project_id = p_project_id;
    IF v_persona IS NOT NULL THEN RETURN v_persona; END IF;
  END IF;

  -- 3. Org-level binding.
  SELECT persona_slug INTO v_persona
  FROM iris_user_personas
  WHERE user_id = p_user_id AND org_id = v_org_id AND project_id IS NULL;
  IF v_persona IS NOT NULL THEN RETURN v_persona; END IF;

  -- 4. Role fallback. Prefer org-scoped override, fall back to system default.
  IF p_project_id IS NOT NULL THEN
    SELECT pm.role INTO v_role
    FROM project_members pm
    WHERE pm.user_id = p_user_id AND pm.project_id = p_project_id
    LIMIT 1;
  END IF;
  IF v_role IS NULL THEN
    SELECT p.role INTO v_role FROM profiles p WHERE p.id = p_user_id;
  END IF;
  IF v_role IS NULL THEN
    RETURN 'pm';
  END IF;

  SELECT persona_slug INTO v_persona
  FROM role_to_default_persona
  WHERE role = v_role AND org_id = v_org_id;
  IF v_persona IS NOT NULL THEN RETURN v_persona; END IF;

  SELECT persona_slug INTO v_persona
  FROM role_to_default_persona
  WHERE role = v_role AND org_id IS NULL;
  IF v_persona IS NOT NULL THEN RETURN v_persona; END IF;

  -- 5. Last-resort default.
  RETURN 'pm';
END;
$$;

COMMENT ON FUNCTION resolve_persona IS
  'Returns PersonaSlug for (user, project) per ADR-019 override hierarchy. Never NULL — pm is final fallback.';

GRANT EXECUTE ON FUNCTION resolve_persona(UUID, UUID) TO authenticated;
