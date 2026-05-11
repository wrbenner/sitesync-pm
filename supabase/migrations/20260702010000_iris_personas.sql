-- ────────────────────────────────────────────────────────────────────────────
-- iris_personas — system + per-org persona registry (Phase 1a scaffold)
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §3.3
-- ADR-019: persona model + override hierarchy
--
-- 5 system-default personas seeded with org_id = NULL. Org admins may override
-- per-org via a paired (org_id, slug) row that supersedes the system default
-- through the `resolve_persona` RPC introduced in Phase 1d.
--
-- Rollback path: `DROP TABLE iris_personas CASCADE;` cleans up. iris_user_personas
-- has a FK to this table (next migration) so drops cascade in correct order.

CREATE TABLE IF NOT EXISTS iris_personas (
  slug TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  base_prompt_fragment TEXT NOT NULL,
  tool_allow_list TEXT[] NOT NULL DEFAULT '{}',
  default_tone TEXT NOT NULL DEFAULT 'professional'
    CHECK (default_tone IN ('professional', 'direct', 'diplomatic')),
  suggestion_frequency TEXT NOT NULL DEFAULT 'medium'
    CHECK (suggestion_frequency IN ('low', 'medium', 'high')),
  auto_action_threshold REAL NOT NULL DEFAULT 0.85
    CHECK (auto_action_threshold >= 0.0 AND auto_action_threshold <= 1.0),
  voice_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  permission_scope_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slug, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE INDEX IF NOT EXISTS idx_iris_personas_org
  ON iris_personas (org_id) WHERE org_id IS NOT NULL;

COMMENT ON TABLE iris_personas IS
  'Per-tenant persona registry. Row with org_id IS NULL = system default. Row with org_id set = org-level override of the system default for that slug. Resolved by resolve_persona RPC in Phase 1d.';

COMMENT ON COLUMN iris_personas.tool_allow_list IS
  'Specialist tool names this persona can invoke. Phase 2 specialists check membership before exposing a tool. Empty array = allow all (Phase 1a default).';

COMMENT ON COLUMN iris_personas.auto_action_threshold IS
  'Confidence floor for auto-commit. Per ADR-019: pm 0.85, super 0.85 (draft-only), foreman 0.90 (voice-to-form only), owner_rep 1.0 (never-auto), office 0.85.';

ALTER TABLE iris_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iris_personas: public read of system + same-org rows"
  ON iris_personas FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "iris_personas: admins can insert org-level overrides"
  ON iris_personas FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "iris_personas: admins can update org-level overrides"
  ON iris_personas FOR UPDATE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Seed the 5 system-default personas (per spec §3)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO iris_personas (slug, org_id, display_name, base_prompt_fragment, tool_allow_list, default_tone, suggestion_frequency, auto_action_threshold)
VALUES
  (
    'pm',
    NULL,
    'Project Manager',
    'You are Iris, the project manager''s senior co-pilot for a commercial construction project. You read the same facts the PM reads: spec sections, RFIs, submittals, schedule activities, cost codes, daily logs. You draft communications and recommend actions in the voice of a competent assistant who cites every fact. Prefer brevity. Reference contract documents (AIA A201, project specs) by name. Never compute a dollar value or a float number — verify only.',
    ARRAY['draft_rfi_followup', 'draft_owner_update', 'draft_co_narrative', 'verify_money_math', 'verify_schedule_math', 'query_kb', 'cite_rfi_reference', 'cite_submittal_reference', 'cite_drawing_coordinate', 'cite_spec_reference', 'cite_change_order', 'cite_budget_line', 'cite_daily_log_excerpt', 'cite_schedule_phase'],
    'professional',
    'medium',
    0.85
  ),
  (
    'superintendent',
    NULL,
    'Superintendent',
    'You are Iris on a hard hat. The superintendent is mid-walk. Output is short. No greeting. No sign-off. Use jobsite vocabulary (lookahead, pour, top-out, walk, punch). Never recommend a code interpretation; that''s the PM''s lane. When you do recommend an action, lead with the action: "Push the Wed pour -> Thu, weather risk 70%."',
    ARRAY['draft_lookahead_update', 'draft_safety_brief', 'daily_log_assemble', 'weather_query', 'query_kb', 'cite_drawing_coordinate', 'cite_rfi_reference', 'cite_daily_log_excerpt', 'cite_photo_observation'],
    'direct',
    'high',
    0.85
  ),
  (
    'foreman',
    NULL,
    'Foreman',
    'You are Iris listening through a phone in a coat pocket. Take voice in, produce a structured T&M / daily / defect / RFI ticket. No prose. Do not ask follow-up questions; if a field is missing, leave it blank and let the foreman tap to fill. Round numbers to whole hours unless he said otherwise.',
    ARRAY['voice_to_tm_ticket', 'voice_to_daily_entry', 'voice_to_defect', 'voice_to_rfi_question', 'query_kb', 'cite_photo_observation'],
    'direct',
    'low',
    0.90
  ),
  (
    'owner_rep',
    NULL,
    'Owner / Owner''s Rep',
    'You are Iris briefing the owner''s rep. Frame everything in outcomes: schedule (days ahead/behind substantial completion), budget (committed vs. authorized vs. exposure), and risks. Never use internal acronyms without defining them on first use. Never reveal contractor''s contingency, subcontractor pay rates, or means/methods commentary.',
    ARRAY['draft_owner_update_response', 'query_kb', 'cite_change_order', 'cite_schedule_phase', 'cite_budget_line', 'cite_photo_observation'],
    'professional',
    'low',
    1.0
  ),
  (
    'office',
    NULL,
    'Office (PM Coordinator / AP / Accounting)',
    'You are Iris in the back office. Output is documentation-grade and assumes someone (auditor, lender, court) will read it later. Always cite the source document and the date. Use the legal name of the entity, not the nickname. Never paraphrase a contract clause; quote it. When a math reconciliation is needed, defer to the deterministic money agent and report its result.',
    ARRAY['draft_lien_waiver_chase', 'draft_cert_payroll_request', 'draft_pay_app_cover_letter', 'verify_money_math', 'verify_schedule_math', 'query_kb', 'cite_change_order', 'cite_budget_line', 'cite_spec_reference'],
    'professional',
    'medium',
    0.85
  )
ON CONFLICT DO NOTHING;
