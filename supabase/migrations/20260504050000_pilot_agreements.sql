-- pilot_agreements — signed-pilot-agreement records.
--
-- Per ADR-006 (pilot data isolation = row-level + is_soft_pilot flag),
-- every pilot organization has a counterpart row here recording:
--   * who signed (name, email, role, ts)
--   * which 4 users are the pilot users (PMs + supers)
--   * what they consented to (telemetry retention, case-study quote
--     permission, data-handling)
--   * the agreement text version pinned at signing time
--   * a URL to the archived signed PDF
--
-- The table is the authority for `is_pilot_user(uuid)`, which the gate
-- query and the scheduled-insights worker check before counting a
-- decision toward Lap 2 acceptance.
--
-- Reference:
--   docs/audits/SOFT_PILOT_PLAYBOOK_2026-05-04.md § Phase 2
--   docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md
--   docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md (referenced
--     by data_handling_consent)
--
-- The is_soft_pilot / soft_pilot_started_at / soft_pilot_agreement_signed_at
-- columns on `organizations` already shipped in 20260504020003.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pilot_agreements (
  id                       uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid           NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  signed_by_name           text           NOT NULL,
  signed_by_email          text           NOT NULL,
  signed_by_role           text,
  signed_at                timestamptz    NOT NULL,
  /* Agreement text is pinned at signing time so the row remains the
     authoritative record even when the template evolves. */
  agreement_text_version   text           NOT NULL,
  agreement_pdf_url        text,
  /* The 4 pilot user uuids (2 PMs + 2 supers in the spec). The array
     shape lets the gate query intersect with decided_by directly. */
  pilot_user_ids           uuid[]         NOT NULL,
  /* Free-form consent record — booleans + free text capturing what
     the pilot org agreed to. Keys defined by the playbook:
       telemetry_retention_24mo  bool
       case_study_quote_permission_required  bool
       right_to_erasure          bool
       audit_chain_export        bool
     and any future additions. */
  data_handling_consent    jsonb          NOT NULL DEFAULT '{}'::jsonb,
  /* When the pilot ended (or NULL if active). Set by the post-pilot
     debrief workflow on Day 60. */
  pilot_ended_at           timestamptz,
  ended_reason             text           CHECK (ended_reason IS NULL OR ended_reason IN (
    'pilot_completed',
    'gate_passed',
    'gate_failed',
    'pilot_user_request',
    'audit_chain_break',
    'real_world_harm',
    'standup_attendance_collapse',
    'pivoted_to_backup',
    'other'
  )),
  created_at               timestamptz    NOT NULL DEFAULT NOW(),
  updated_at               timestamptz    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_agreements_org
  ON public.pilot_agreements (organization_id, signed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_agreements_active
  ON public.pilot_agreements (organization_id)
  WHERE pilot_ended_at IS NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.pilot_agreements_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pilot_agreements_set_updated_at ON public.pilot_agreements;
CREATE TRIGGER pilot_agreements_set_updated_at
  BEFORE UPDATE ON public.pilot_agreements
  FOR EACH ROW EXECUTE FUNCTION public.pilot_agreements_set_updated_at();

COMMENT ON TABLE public.pilot_agreements IS
  'Per-pilot-org agreement record. One row per signed agreement. Authority for is_pilot_user().';

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.pilot_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_agreements FORCE ROW LEVEL SECURITY;

-- Org admins can read their org's agreement; service-role inserts.
DROP POLICY IF EXISTS pilot_agreements_select_admin ON public.pilot_agreements;
CREATE POLICY pilot_agreements_select_admin ON public.pilot_agreements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = pilot_agreements.organization_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner','admin')
    )
  );

-- ── is_pilot_user(uuid) — gate scoping helper ─────────────────────
-- Used by:
--   * scheduled-insights heartbeat fan-out (already filters by
--     organizations.is_soft_pilot — this helper is the user-grain check)
--   * lap_2_gate_metrics_daily counting rules (per spec § Gate 1: a
--     decided_by not in pilot_user_ids does not count toward 100)
--
-- Returns TRUE iff the user is named in an active pilot agreement.

CREATE OR REPLACE FUNCTION public.is_pilot_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.pilot_agreements pa
      JOIN public.organizations o ON o.id = pa.organization_id
     WHERE o.is_soft_pilot = TRUE
       AND pa.pilot_ended_at IS NULL
       AND p_user_id = ANY(pa.pilot_user_ids)
  );
$$;

REVOKE ALL ON FUNCTION public.is_pilot_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pilot_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_pilot_user(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_pilot_user(uuid) IS
  'TRUE iff the user is in any active pilot_agreements row for an org with is_soft_pilot=TRUE. Used by gate counting + telemetry scope.';

COMMIT;
