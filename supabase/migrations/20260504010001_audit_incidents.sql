-- audit_incidents — the security/audit-fault log for the Lap 2 gate.
--
-- The Day 60 acceptance gate runs four programmatic checks; gate 4
-- ("zero security/audit incidents") reads from this table plus
-- verify_audit_chain. An incident is anything that should make Walker
-- stop the pilot mid-flight: a chain break, an RLS leak, a draft
-- decided by a user not on `pilot_user_ids`, an LLM key found in a
-- build artifact, or anything else of similar weight.
--
-- The table is append-only by design. Resolution is tracked via
-- resolved_at + resolution_note; we never DELETE incidents — we
-- annotate them. Lap 2 hash-chain integrity demands the full history
-- stays intact.
--
-- Reference:
--   docs/audits/LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md § Gate 4
--   docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md (retention)
--   supabase/migrations/20260426000001_audit_log_hash_chain.sql (sibling)

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_incidents (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at          timestamptz   NOT NULL DEFAULT NOW(),
  severity             text          NOT NULL
                                     CHECK (severity IN ('low','medium','high','critical')),
  category             text          NOT NULL
                                     CHECK (category IN (
                                       'chain_break',          -- audit chain hash mismatch
                                       'rls_leak',             -- citation referenced cross-tenant data
                                       'unauthorized_decision',-- decided_by not in pilot_user_ids
                                       'ghost_approval',       -- approved without first_viewed_at
                                       'key_leak',             -- LLM key in dist/ artifact
                                       'webhook_replay',       -- replay attack signal
                                       'rate_limit_breach',    -- AI rate limit overrun
                                       'other'
                                     )),
  description          text          NOT NULL,
  related_entity_type  text,
  related_entity_id    uuid,
  related_project_id   uuid          REFERENCES public.projects(id) ON DELETE SET NULL,
  detected_by          text          NOT NULL DEFAULT 'system',
  -- Free-form JSON for diagnostic data. Indexable via JSONB ops.
  context              jsonb         NOT NULL DEFAULT '{}'::jsonb,
  resolved_at          timestamptz,
  resolution_note      text,
  resolved_by          uuid          REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_incidents_open_severity
  ON public.audit_incidents (detected_at DESC, severity)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_incidents_category
  ON public.audit_incidents (category, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_incidents_project
  ON public.audit_incidents (related_project_id, detected_at DESC)
  WHERE related_project_id IS NOT NULL;

COMMENT ON TABLE public.audit_incidents IS
  'Security/audit incident log. Append-only; resolution annotates rather than deletes. Read by Lap 2 acceptance gate (Gate 4).';
COMMENT ON COLUMN public.audit_incidents.context IS
  'Diagnostic JSON payload — chain-break expected/actual hashes, RLS-leak source row id, etc.';

-- ── RLS — admin-only ────────────────────────────────────────────────
ALTER TABLE public.audit_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_incidents FORCE ROW LEVEL SECURITY;

-- Service role bypasses RLS so cron + edge fns insert freely. For
-- authenticated users, only org admins of the related project's org
-- can read or annotate project-scoped incidents. Global (unscoped)
-- incidents are service-role only — they show up in the gate workflow
-- via the SECURITY DEFINER helper below; humans see them in admin
-- tooling.
DROP POLICY IF EXISTS audit_incidents_select_admin ON public.audit_incidents;
CREATE POLICY audit_incidents_select_admin ON public.audit_incidents
  FOR SELECT
  USING (
    related_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
       JOIN public.organization_members om ON om.organization_id = p.organization_id
       WHERE p.id = audit_incidents.related_project_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS audit_incidents_update_admin ON public.audit_incidents;
CREATE POLICY audit_incidents_update_admin ON public.audit_incidents
  FOR UPDATE
  USING (
    related_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
       JOIN public.organization_members om ON om.organization_id = p.organization_id
       WHERE p.id = audit_incidents.related_project_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner','admin')
    )
  );

-- INSERT/DELETE are service-role only (no policy needed; FORCE RLS
-- denies authenticated callers without a permissive policy).

-- ── Helper: open incidents count for the gate ──────────────────────
-- Returns the number of unresolved high/critical incidents. Used by
-- the lap-2-acceptance.yml workflow as the single-call gate input.

CREATE OR REPLACE FUNCTION public.lap_2_open_incident_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::integer
    FROM public.audit_incidents
   WHERE resolved_at IS NULL
     AND severity IN ('high','critical');
$$;

GRANT EXECUTE ON FUNCTION public.lap_2_open_incident_count() TO service_role;

COMMIT;
