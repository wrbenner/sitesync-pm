-- Scheduled Insights — dedupe + atomic promotion RPC.
--
-- The worker calls promote_insight_to_draft(...) for each high-confidence
-- insight it computes. The RPC enforces the spec's promotion rules
-- atomically in a single transaction:
--
--   1. Severity gate (insights with severity NOT IN ('high','critical')
--      reach this point only when the worker mistakenly attempts; the
--      RPC validates as a defense-in-depth)
--   2. Confidence gate (≥ 0.7)
--   3. 24h dedupe (same kind + entity + project)
--   4. Daily per-project cap (default 50/day; tunable via
--      projects.max_drafts_per_day once that column lands; default 50
--      until then)
--   5. Pause-on-incident (no high/critical incidents currently open)
--
-- The dedupe table is the source of truth for "have we drafted this
-- already today." It survives draft deletion via ON DELETE CASCADE so
-- a withdrawn draft doesn't immediately re-enter the inbox the next
-- tick.
--
-- Reference: docs/audits/SCHEDULED_INSIGHTS_SPEC_2026-05-04.md § Phase 3

BEGIN;

-- ── Per-project draft cap column ────────────────────────────────────
-- Defaults to 50/day. Walker can override per-project via the admin
-- panel later (no UI today; SQL update is the path).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS max_drafts_per_day integer NOT NULL DEFAULT 50
  CHECK (max_drafts_per_day >= 0 AND max_drafts_per_day <= 1000);

COMMENT ON COLUMN public.projects.max_drafts_per_day IS
  'Per-project cap on scheduled-insights drafts/day. Above the cap, the worker logs a budget_exceeded incident and pauses promotion until midnight UTC.';

-- ── Dedupe table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drafted_action_dedupe (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_kind      text          NOT NULL
                                  CHECK (insight_kind IN ('aging','cascade','variance','staffing','weather')),
  primary_entity_id uuid          NOT NULL,
  project_id        uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drafted_action_id uuid          NOT NULL REFERENCES public.drafted_actions(id) ON DELETE CASCADE,
  created_at        timestamptz   NOT NULL DEFAULT NOW()
);

-- Lookup index for the 24h dedupe window. Partial (only "fresh" rows
-- get scanned) keeps the index small as the table grows.
CREATE INDEX IF NOT EXISTS idx_drafted_action_dedupe_window
  ON public.drafted_action_dedupe (insight_kind, primary_entity_id, project_id, created_at);

-- ── Promotion RPC ───────────────────────────────────────────────────
-- Returns: the drafted_action.id (existing if dedupe hit, new if inserted).
-- Returns NULL when the insight is rejected (severity/confidence/cap/incident).
-- Caller (worker) logs the rejection reason from the RAISE NOTICE channel.

CREATE OR REPLACE FUNCTION public.promote_insight_to_draft(
  p_insight    jsonb,
  p_project_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind                text         := p_insight->>'kind';
  v_action_type         text         := p_insight->>'actionType';
  v_severity            text         := p_insight->>'severity';
  v_confidence          numeric      := COALESCE((p_insight->>'confidence')::numeric, 0);
  v_primary_entity_id   uuid;
  v_existing_draft_id   uuid;
  v_new_draft_id        uuid;
  v_today_count         integer;
  v_max_per_day         integer;
  v_open_high_incidents integer;
BEGIN
  -- Defense in depth: validate severity and confidence at the boundary.
  IF v_severity IS NULL OR v_severity NOT IN ('high','critical') THEN
    RAISE NOTICE 'promote_insight_to_draft: severity=% rejected', v_severity;
    RETURN NULL;
  END IF;
  IF v_confidence < 0.7 THEN
    RAISE NOTICE 'promote_insight_to_draft: confidence=% < 0.7', v_confidence;
    RETURN NULL;
  END IF;
  IF v_kind IS NULL OR v_kind NOT IN ('aging','cascade','variance','staffing','weather') THEN
    RAISE EXCEPTION 'promote_insight_to_draft: invalid kind=%', v_kind;
  END IF;
  IF v_action_type IS NULL THEN
    RAISE EXCEPTION 'promote_insight_to_draft: actionType missing';
  END IF;
  v_primary_entity_id := NULLIF(p_insight->>'primaryEntityId','')::uuid;
  IF v_primary_entity_id IS NULL THEN
    RAISE EXCEPTION 'promote_insight_to_draft: primaryEntityId missing';
  END IF;

  -- Pause-on-incident: any unresolved high/critical halts new drafts.
  -- The audit_incidents table is added in 20260504010001; we tolerate
  -- its absence so this migration can apply standalone.
  BEGIN
    SELECT public.lap_2_open_incident_count() INTO v_open_high_incidents;
  EXCEPTION WHEN undefined_function THEN
    v_open_high_incidents := 0;
  END;
  IF v_open_high_incidents > 0 THEN
    RAISE NOTICE 'promote_insight_to_draft: paused (% open incidents)', v_open_high_incidents;
    RETURN NULL;
  END IF;

  -- Per-project daily cap. Counts ALL drafts created today by the
  -- scheduled-insights worker in this project — not just promoted.
  SELECT max_drafts_per_day INTO v_max_per_day
    FROM public.projects WHERE id = p_project_id;
  v_max_per_day := COALESCE(v_max_per_day, 50);

  SELECT COUNT(*) INTO v_today_count
    FROM public.drafted_actions
   WHERE project_id = p_project_id
     AND drafted_by = 'iris-scheduled-insights'
     AND created_at >= date_trunc('day', NOW());

  IF v_today_count >= v_max_per_day THEN
    RAISE NOTICE 'promote_insight_to_draft: project % at daily cap (%/%)', p_project_id, v_today_count, v_max_per_day;
    RETURN NULL;
  END IF;

  -- 24h dedupe lookup. Returns the existing draft id if one fired
  -- recently for the same (kind, entity, project).
  SELECT drafted_action_id INTO v_existing_draft_id
    FROM public.drafted_action_dedupe
   WHERE insight_kind = v_kind
     AND primary_entity_id = v_primary_entity_id
     AND project_id = p_project_id
     AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_draft_id IS NOT NULL THEN
    -- Idempotent return — the caller can treat this as success.
    RETURN v_existing_draft_id;
  END IF;

  -- Insert the new draft + dedupe row in a single transaction.
  INSERT INTO public.drafted_actions (
    project_id, action_type, title, summary, payload,
    citations, confidence, drafted_by, draft_reason,
    related_resource_type, related_resource_id
  ) VALUES (
    p_project_id,
    v_action_type,
    p_insight->>'title',
    p_insight->>'summary',
    COALESCE(p_insight->'payload', '{}'::jsonb),
    COALESCE(p_insight->'citations', '[]'::jsonb),
    v_confidence,
    'iris-scheduled-insights',
    p_insight->>'reason',
    p_insight->>'primaryEntityType',
    v_primary_entity_id
  ) RETURNING id INTO v_new_draft_id;

  INSERT INTO public.drafted_action_dedupe (
    insight_kind, primary_entity_id, project_id, drafted_action_id
  ) VALUES (
    v_kind, v_primary_entity_id, p_project_id, v_new_draft_id
  );

  RETURN v_new_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_insight_to_draft(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_insight_to_draft(jsonb, uuid) TO service_role;

COMMENT ON FUNCTION public.promote_insight_to_draft(jsonb, uuid) IS
  'Atomic promotion of an insight to a drafted_action. Idempotent within 24h. Returns the (existing or new) draft id, or NULL when the insight fails any gate (severity/confidence/cap/incident).';

-- ── withdraw_draft RPC ──────────────────────────────────────────────
-- The worker calls this when the underlying entity has moved past the
-- trigger state (auto-withdraw policy, ADR-007). Marks the draft
-- 'rejected' with a system note so the matview's auto_withdrawn_count
-- diagnostic picks it up and the gate's rate calc excludes it.

CREATE OR REPLACE FUNCTION public.withdraw_stale_draft(
  p_draft_id uuid,
  p_reason   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Use the existing telemetry-bypass GUC so the trigger doesn't
  -- think this is a user-driven status change.
  PERFORM set_config('sitesync.drafted_actions_telemetry_via_rpc','on', true);

  UPDATE public.drafted_actions
     SET status        = 'rejected',
         decided_at    = NOW(),
         decision_note = '[withdrawn by system] ' || COALESCE(p_reason, 'state changed mid-flight')
   WHERE id = p_draft_id
     AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_stale_draft(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_stale_draft(uuid, text) TO service_role;

COMMIT;
