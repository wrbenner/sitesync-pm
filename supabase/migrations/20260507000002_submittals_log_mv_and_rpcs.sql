-- =============================================================================
-- Submittals — Materialized view + 7 RPCs + bookkeeping RLS  (P0-D37)
--
-- Spec: docs/audits/SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md  Part 3.2 §9 +
--       Part 3.3 + Appendix B.3 (submittal_replace_user)
-- ADRs: ADR-003 (pg_cron heartbeat), ADR-006 (pilot data isolation)
-- Hash chain pattern: migration 20260426000001_audit_log_hash_chain.
--
-- Style: ADDITIVE only. Idempotent re-apply via DROP-IF-EXISTS for views,
-- CREATE-OR-REPLACE for functions, IF NOT EXISTS for indexes/policies.
--
-- Each of the 7 RPCs:
--   1. Validates auth.uid() (RLS on the parent table enforces project gate)
--   2. Reads the current row, computes hash_chain_prev/self
--   3. Mutates atomically inside the function transaction
--   4. Inserts a row into submittal_change_history (also hash-chained)
--   5. Inserts an audit_log row (existing trigger global hash-chain)
--   6. Returns the updated submittals row
-- =============================================================================


-- ── Section 1: search_index_dirty_flags + view_refresh_metadata RLS ─────────
-- D36 advisory carryover. Both tables shipped without RLS in their original
-- migrations (20260503110003 / 20260503110005). They are infrastructure-only
-- — no end-user is supposed to read or write them directly. Lock them down
-- to service_role; SECURITY DEFINER helpers continue to work.

ALTER TABLE public.search_index_dirty_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_refresh_metadata    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.search_index_dirty_flags FROM PUBLIC;
REVOKE ALL ON public.view_refresh_metadata    FROM PUBLIC;
GRANT  ALL ON public.search_index_dirty_flags TO   service_role;
GRANT  ALL ON public.view_refresh_metadata    TO   service_role;

DROP POLICY IF EXISTS search_index_dirty_flags_service_role
  ON public.search_index_dirty_flags;
CREATE POLICY search_index_dirty_flags_service_role
  ON public.search_index_dirty_flags
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS view_refresh_metadata_service_role
  ON public.view_refresh_metadata;
CREATE POLICY view_refresh_metadata_service_role
  ON public.view_refresh_metadata
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.search_index_dirty_flags IS
  'Bookkeeping table for incremental search reindex. service_role only. '
  'Triggers populate it; reindex worker drains it. End-users do not access.';
COMMENT ON TABLE public.view_refresh_metadata IS
  'Bookkeeping table for materialized-view freshness. service_role only. '
  'Read-side path is the STABLE view_freshness_status() helper.';


-- ── Section 2: Hash-chain helper for submittals ─────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_submittal_hash(
  p_id              uuid,
  p_status          text,
  p_rev_number      int,
  p_actor           uuid,
  p_action          text,
  p_payload         jsonb,
  p_prev_hash       text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(
    coalesce(p_id::text, '')              || '|' ||
    coalesce(p_status, '')                || '|' ||
    coalesce(p_rev_number::text, '')      || '|' ||
    coalesce(p_actor::text, '')           || '|' ||
    coalesce(p_action, '')                || '|' ||
    coalesce(p_payload::text, '{}')       || '|' ||
    coalesce(p_prev_hash, ''),
    'sha256'
  ), 'hex')
$$;


-- ── Section 3: Telemetry helper ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.emit_submittal_event(
  p_submittal_id  uuid,
  p_action        text,
  p_actor         uuid,
  p_metadata      jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
  v_org_id     uuid;
  v_email      text;
BEGIN
  SELECT s.project_id, p.organization_id
    INTO v_project_id, v_org_id
    FROM public.submittals s
    JOIN public.projects   p ON p.id = s.project_id
   WHERE s.id = p_submittal_id;

  SELECT email INTO v_email FROM auth.users WHERE id = p_actor;

  INSERT INTO public.audit_log (
    project_id, organization_id, user_id, user_email,
    entity_type, entity_id, action, metadata
  ) VALUES (
    v_project_id, v_org_id, p_actor, v_email,
    'submittal', p_submittal_id,
    CASE p_action
      WHEN 'advance_status'      THEN 'status_change'
      WHEN 'record_disposition'  THEN 'status_change'
      WHEN 'create_revision'     THEN 'create'
      WHEN 'distribute'          THEN 'update'
      WHEN 'close'               THEN 'close'
      WHEN 'compute_required'    THEN 'update'
      WHEN 'replace_user'        THEN 'update'
      ELSE 'update'
    END,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('event', p_action)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.emit_submittal_event(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.emit_submittal_event(uuid, text, uuid, jsonb) TO authenticated;


-- ── Section 4: submittals_log_mv ────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS public.submittals_log_mv;

CREATE MATERIALIZED VIEW public.submittals_log_mv AS
SELECT
  s.id,
  s.project_id,
  s.number,
  s.title,
  s.kind,
  s.status,
  s.csi_division,
  s.csi_section,
  s.spec_section_paragraph,
  s.spec_pdf_page,
  s.required_on_site_date,
  s.submit_by_date,
  s.lead_time_weeks,
  s.is_critical_path,
  s.is_federal,
  s.responsible_sub_id,
  s.current_reviewer_id,
  s.current_reviewer_role,
  s.ball_in_court_since,
  s.rev_number,
  s.is_soft_pilot,
  s.iris_preflight_score,
  s.iris_preflight_findings,
  s.is_private,
  s.confirmed_delivery_date,
  s.actual_delivery_date,
  s.anticipated_delivery_date,
  s.submittal_package_id,
  s.parent_submittal_id,
  s.created_at,
  s.created_by,
  s.updated_at,
  s.deleted_at,
  org_sub.name           AS sub_name,
  user_reviewer.email    AS current_reviewer_email,
  COALESCE(profile_reviewer.full_name, user_reviewer.email)
                         AS current_reviewer_name,
  CASE
    WHEN s.ball_in_court_since IS NULL THEN NULL
    ELSE EXTRACT(day FROM (now() - s.ball_in_court_since))::int
  END                    AS days_in_court,
  CASE
    WHEN s.required_on_site_date IS NULL                                THEN 'unscheduled'
    WHEN s.required_on_site_date < CURRENT_DATE
      AND COALESCE(s.status, '') NOT IN ('approved', 'closed')          THEN 'overdue'
    WHEN COALESCE(s.submit_by_date, s.due_date) IS NOT NULL
      AND COALESCE(s.submit_by_date, s.due_date) < CURRENT_DATE
      AND COALESCE(s.status, '') = 'draft'                              THEN 'submit_overdue'
    WHEN s.required_on_site_date - CURRENT_DATE < 7
      AND COALESCE(s.status, '') NOT IN ('approved', 'closed')          THEN 'at_risk'
    ELSE 'on_track'
  END                    AS risk_band
FROM       public.submittals     s
LEFT JOIN  public.organizations  org_sub        ON org_sub.id        = s.responsible_sub_id
LEFT JOIN  auth.users            user_reviewer  ON user_reviewer.id  = s.current_reviewer_id
LEFT JOIN  public.profiles       profile_reviewer ON profile_reviewer.id = s.current_reviewer_id
WHERE      s.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submittals_log_mv_id
  ON public.submittals_log_mv (id);
CREATE INDEX IF NOT EXISTS idx_submittals_log_mv_project_status
  ON public.submittals_log_mv (project_id, status);
CREATE INDEX IF NOT EXISTS idx_submittals_log_mv_risk
  ON public.submittals_log_mv (project_id, risk_band);
CREATE INDEX IF NOT EXISTS idx_submittals_log_mv_reviewer
  ON public.submittals_log_mv (current_reviewer_id)
  WHERE current_reviewer_id IS NOT NULL;

COMMENT ON MATERIALIZED VIEW public.submittals_log_mv IS
  'Log-surface read model. Refresh: trigger on submittals INSERT/UPDATE/DELETE '
  '(non-CONCURRENTLY for speed) and pg_cron every 5 min CONCURRENTLY (per ADR-003).';

INSERT INTO public.view_refresh_metadata (view_name, last_refresh_status, target_interval_seconds)
VALUES ('submittals_log_mv', 'unknown', 300)
ON CONFLICT DO NOTHING;


-- ── Section 5: Refresh function + trigger + pg_cron schedule ────────────────

CREATE OR REPLACE FUNCTION public.refresh_submittals_log_mv(
  p_concurrent boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_started_at  timestamptz := now();
  v_status      text        := 'success';
  v_error       text;
BEGIN
  UPDATE public.view_refresh_metadata
     SET last_refresh_started_at = v_started_at,
         last_refresh_status     = 'running',
         updated_at              = v_started_at
   WHERE view_name = 'submittals_log_mv';

  BEGIN
    IF p_concurrent THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.submittals_log_mv;
    ELSE
      REFRESH MATERIALIZED VIEW public.submittals_log_mv;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'failed';
    v_error  := SQLERRM;
  END;

  UPDATE public.view_refresh_metadata
     SET last_refresh_completed_at = now(),
         last_refresh_status       = v_status,
         last_refresh_duration_ms  = EXTRACT(epoch FROM (now() - v_started_at))::int * 1000,
         last_error                = v_error,
         updated_at                = now()
   WHERE view_name = 'submittals_log_mv';
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_submittals_log_mv(boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refresh_submittals_log_mv(boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_refresh_submittals_log_mv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.refresh_submittals_log_mv(false);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_submittals_refresh_log_mv ON public.submittals;
CREATE TRIGGER trg_submittals_refresh_log_mv
  AFTER INSERT OR UPDATE OR DELETE ON public.submittals
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_refresh_submittals_log_mv();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-submittals-log-mv')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-submittals-log-mv');

    PERFORM cron.schedule(
      'refresh-submittals-log-mv',
      '*/5 * * * *',
      $cron$ SELECT public.refresh_submittals_log_mv(true) $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — skipping submittals_log_mv refresh schedule.';
  END IF;
END $$;


-- ── Section 6: RPC #1 — submittal_advance_status ────────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_advance_status(
  p_id      uuid,
  p_to      text,
  p_actor   uuid,
  p_reason  text DEFAULT NULL
) RETURNS public.submittals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row       public.submittals;
  v_prev_hash text;
  v_self_hash text;
  v_payload   jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT * INTO v_row FROM public.submittals WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Submittal % not found', p_id;
  END IF;

  v_prev_hash := v_row.hash_chain_self;
  v_payload   := jsonb_build_object('from', v_row.status, 'to', p_to, 'reason', p_reason);
  v_self_hash := public.compute_submittal_hash(
    p_id, p_to, v_row.rev_number, p_actor, 'advance_status', v_payload, v_prev_hash
  );

  UPDATE public.submittals
     SET status              = p_to,
         updated_at          = now(),
         updated_by          = p_actor,
         ball_in_court_since = CASE
           WHEN p_to IN ('sent_to_reviewer', 'in_review', 'gc_review', 'preflight')
             THEN now()
           ELSE ball_in_court_since
         END,
         hash_chain_prev     = v_prev_hash,
         hash_chain_self     = v_self_hash
   WHERE id = p_id
   RETURNING * INTO v_row;

  INSERT INTO public.submittal_change_history
    (submittal_id, action_by, field, from_value, to_value, hash_chain_prev, hash_chain_self)
  VALUES
    (p_id, p_actor, 'status',
     to_jsonb(v_payload->'from'), to_jsonb(v_payload->'to'),
     v_prev_hash, v_self_hash);

  PERFORM public.emit_submittal_event(p_id, 'advance_status', p_actor, v_payload);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_advance_status(uuid, text, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_advance_status(uuid, text, uuid, text) TO authenticated;


-- ── Section 7: RPC #2 — submittal_record_disposition ────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_record_disposition(
  p_reviewer_id   uuid,
  p_disposition   text,
  p_comment       text DEFAULT NULL,
  p_stamp_url     text DEFAULT NULL
) RETURNS public.submittals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_submittal    public.submittals;
  v_submittal_id uuid;
  v_prev_hash    text;
  v_self_hash    text;
  v_payload      jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT submittal_id INTO v_submittal_id
    FROM public.submittal_reviewers WHERE id = p_reviewer_id;
  IF v_submittal_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer row % not found', p_reviewer_id;
  END IF;

  UPDATE public.submittal_reviewers
     SET disposition  = p_disposition,
         comments     = p_comment,
         stamp_url    = p_stamp_url,
         responded_at = now()
   WHERE id = p_reviewer_id;

  SELECT * INTO v_submittal FROM public.submittals WHERE id = v_submittal_id;

  v_prev_hash := v_submittal.hash_chain_self;
  v_payload   := jsonb_build_object(
    'reviewer_id', p_reviewer_id, 'disposition', p_disposition,
    'comment', p_comment, 'has_stamp', (p_stamp_url IS NOT NULL)
  );
  v_self_hash := public.compute_submittal_hash(
    v_submittal_id, v_submittal.status, v_submittal.rev_number,
    v_actor, 'record_disposition', v_payload, v_prev_hash
  );

  UPDATE public.submittals
     SET hash_chain_prev = v_prev_hash,
         hash_chain_self = v_self_hash,
         updated_at      = now(),
         updated_by      = v_actor
   WHERE id = v_submittal_id
   RETURNING * INTO v_submittal;

  INSERT INTO public.submittal_change_history
    (submittal_id, action_by, field, from_value, to_value, hash_chain_prev, hash_chain_self)
  VALUES
    (v_submittal_id, v_actor, 'disposition',
     NULL, v_payload, v_prev_hash, v_self_hash);

  PERFORM public.emit_submittal_event(v_submittal_id, 'record_disposition', v_actor, v_payload);

  RETURN v_submittal;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_record_disposition(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_record_disposition(uuid, text, text, text) TO authenticated;


-- ── Section 8: RPC #3 — submittal_create_revision ───────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_create_revision(
  p_parent_id  uuid
) RETURNS public.submittals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_parent      public.submittals;
  v_new         public.submittals;
  v_prev_hash   text;
  v_self_hash   text;
  v_payload     jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT * INTO v_parent FROM public.submittals WHERE id = p_parent_id;
  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'Parent submittal % not found', p_parent_id;
  END IF;

  v_prev_hash := v_parent.hash_chain_self;
  v_payload   := jsonb_build_object(
    'parent_id', p_parent_id, 'parent_rev_number', v_parent.rev_number
  );

  INSERT INTO public.submittals (
    project_id, title, status,
    kind, csi_division, csi_section, spec_section_paragraph,
    spec_pdf_page, spec_pdf_highlight_rect,
    required_on_site_date, submit_by_date, lead_time_weeks,
    review_duration_days, buffer_days, schedule_activity_id,
    is_critical_path, is_federal, is_private,
    responsible_sub_id,
    parent_submittal_id, rev_number, revision_number,
    submittal_package_id,
    is_soft_pilot,
    spec_section, assigned_to, subcontractor, due_date, lead_time_days,
    created_at, created_by, updated_at, updated_by, hash_chain_prev
  ) VALUES (
    v_parent.project_id, v_parent.title, 'draft',
    v_parent.kind, v_parent.csi_division, v_parent.csi_section,
    v_parent.spec_section_paragraph,
    v_parent.spec_pdf_page, v_parent.spec_pdf_highlight_rect,
    v_parent.required_on_site_date, v_parent.submit_by_date, v_parent.lead_time_weeks,
    v_parent.review_duration_days, v_parent.buffer_days, v_parent.schedule_activity_id,
    v_parent.is_critical_path, v_parent.is_federal, v_parent.is_private,
    v_parent.responsible_sub_id,
    p_parent_id, v_parent.rev_number + 1,
    COALESCE(v_parent.revision_number, 1) + 1,
    v_parent.submittal_package_id,
    v_parent.is_soft_pilot,
    v_parent.spec_section, v_parent.assigned_to, v_parent.subcontractor,
    v_parent.due_date, v_parent.lead_time_days,
    now(), v_actor, now(), v_actor, v_prev_hash
  ) RETURNING * INTO v_new;

  v_self_hash := public.compute_submittal_hash(
    v_new.id, v_new.status, v_new.rev_number, v_actor,
    'create_revision', v_payload, v_prev_hash
  );

  UPDATE public.submittals SET hash_chain_self = v_self_hash
   WHERE id = v_new.id RETURNING * INTO v_new;

  INSERT INTO public.submittal_change_history
    (submittal_id, action_by, field, from_value, to_value, hash_chain_prev, hash_chain_self)
  VALUES
    (v_new.id, v_actor, 'created_from_revision',
     NULL, v_payload, v_prev_hash, v_self_hash);

  PERFORM public.emit_submittal_event(v_new.id, 'create_revision', v_actor, v_payload);

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_create_revision(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_create_revision(uuid) TO authenticated;


-- ── Section 9: RPC #4 — submittal_distribute ────────────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_distribute(
  p_id            uuid,
  p_to_user_ids   uuid[]
) RETURNS public.submittals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_row       public.submittals;
  v_prev_hash text;
  v_self_hash text;
  v_payload   jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT * INTO v_row FROM public.submittals WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Submittal % not found', p_id;
  END IF;

  INSERT INTO public.submittal_distributions
    (submittal_id, distributed_by, to_user_ids)
  VALUES (p_id, v_actor, p_to_user_ids);

  v_prev_hash := v_row.hash_chain_self;
  v_payload   := jsonb_build_object(
    'to_user_ids', to_jsonb(p_to_user_ids),
    'recipient_count', COALESCE(array_length(p_to_user_ids, 1), 0)
  );
  v_self_hash := public.compute_submittal_hash(
    p_id, v_row.status, v_row.rev_number, v_actor, 'distribute', v_payload, v_prev_hash
  );

  UPDATE public.submittals
     SET hash_chain_prev = v_prev_hash,
         hash_chain_self = v_self_hash,
         updated_at      = now(),
         updated_by      = v_actor
   WHERE id = p_id RETURNING * INTO v_row;

  INSERT INTO public.submittal_change_history
    (submittal_id, action_by, field, from_value, to_value, hash_chain_prev, hash_chain_self)
  VALUES (p_id, v_actor, 'distribute', NULL, v_payload, v_prev_hash, v_self_hash);

  PERFORM public.emit_submittal_event(p_id, 'distribute', v_actor, v_payload);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_distribute(uuid, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_distribute(uuid, uuid[]) TO authenticated;


-- ── Section 10: RPC #5 — submittal_close ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_close(
  p_id      uuid,
  p_reason  text DEFAULT NULL
) RETURNS public.submittals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_row       public.submittals;
  v_prev_hash text;
  v_self_hash text;
  v_payload   jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT * INTO v_row FROM public.submittals WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Submittal % not found', p_id;
  END IF;

  v_prev_hash := v_row.hash_chain_self;
  v_payload   := jsonb_build_object('from_status', v_row.status, 'reason', p_reason);
  v_self_hash := public.compute_submittal_hash(
    p_id, 'closed', v_row.rev_number, v_actor, 'close', v_payload, v_prev_hash
  );

  UPDATE public.submittals
     SET status          = 'closed',
         closed_at       = now(),
         closed_by       = v_actor,
         closed_reason   = p_reason,
         updated_at      = now(),
         updated_by      = v_actor,
         hash_chain_prev = v_prev_hash,
         hash_chain_self = v_self_hash
   WHERE id = p_id RETURNING * INTO v_row;

  INSERT INTO public.submittal_change_history
    (submittal_id, action_by, field, from_value, to_value, hash_chain_prev, hash_chain_self)
  VALUES
    (p_id, v_actor, 'close',
     to_jsonb(v_payload->'from_status'), to_jsonb('closed'::text),
     v_prev_hash, v_self_hash);

  PERFORM public.emit_submittal_event(p_id, 'close', v_actor, v_payload);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_close(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_close(uuid, text) TO authenticated;


-- ── Section 11: RPC #6 — submittal_compute_required_on_site ─────────────────

CREATE OR REPLACE FUNCTION public.submittal_compute_required_on_site(
  p_id  uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row             public.submittals;
  v_activity_start  date;
  v_critical_path   boolean := false;
  v_lead_time_days  int     := 0;
  v_review_days     int     := 10;
  v_buffer_days     int     := 5;
  v_required_date   date;
  v_submit_by       date;
BEGIN
  SELECT * INTO v_row FROM public.submittals WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Submittal % not found', p_id;
  END IF;

  v_lead_time_days := COALESCE(v_row.lead_time_weeks, 0) * 7;
  v_review_days    := COALESCE(v_row.review_duration_days, 10);
  v_buffer_days    := COALESCE(v_row.buffer_days, 5);

  IF v_row.schedule_activity_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'schedule_activities'
     ) THEN
    EXECUTE format(
      'SELECT start_date FROM public.schedule_activities WHERE id = %L',
      v_row.schedule_activity_id
    ) INTO v_activity_start;
  END IF;

  v_required_date := COALESCE(v_activity_start, v_row.required_on_site_date);
  IF v_required_date IS NOT NULL THEN
    v_submit_by := v_required_date - (v_lead_time_days + v_review_days + v_buffer_days);
  END IF;

  v_critical_path := COALESCE(v_row.is_critical_path, false);

  RETURN jsonb_build_object(
    'schedule_activity_id',         v_row.schedule_activity_id,
    'schedule_start_date',          v_activity_start,
    'buffer_days',                  v_buffer_days,
    'fab_lead_time_days',           v_lead_time_days,
    'ship_lead_time_days',          0,
    'review_duration_days',         v_review_days,
    'computed_required_on_site',    v_required_date,
    'computed_submit_by',           v_submit_by,
    'is_critical_path',             v_critical_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_compute_required_on_site(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_compute_required_on_site(uuid) TO authenticated;


-- ── Section 12: RPC #7 — submittal_replace_user ─────────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_replace_user(
  p_old  uuid,
  p_new  uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_count       int  := 0;
  v_submittal_id uuid;
  v_payload     jsonb;
  v_prev_hash   text;
  v_self_hash   text;
  v_row         public.submittals;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;
  IF p_old IS NULL OR p_new IS NULL THEN
    RAISE EXCEPTION 'Both p_old and p_new are required';
  END IF;
  IF p_old = p_new THEN
    RETURN 0;
  END IF;

  UPDATE public.submittal_reviewers
     SET reviewer_id = p_new
   WHERE reviewer_id = p_old AND responded_at IS NULL;

  FOR v_submittal_id IN
    SELECT DISTINCT id FROM public.submittals WHERE current_reviewer_id = p_old
  LOOP
    SELECT * INTO v_row FROM public.submittals WHERE id = v_submittal_id;
    v_prev_hash := v_row.hash_chain_self;
    v_payload   := jsonb_build_object(
      'old_user_id', p_old, 'new_user_id', p_new, 'field', 'current_reviewer_id'
    );
    v_self_hash := public.compute_submittal_hash(
      v_submittal_id, v_row.status, v_row.rev_number, v_actor,
      'replace_user', v_payload, v_prev_hash
    );

    UPDATE public.submittals
       SET current_reviewer_id = p_new,
           updated_at          = now(),
           updated_by          = v_actor,
           hash_chain_prev     = v_prev_hash,
           hash_chain_self     = v_self_hash
     WHERE id = v_submittal_id;

    INSERT INTO public.submittal_change_history
      (submittal_id, action_by, field, from_value, to_value, hash_chain_prev, hash_chain_self)
    VALUES
      (v_submittal_id, v_actor, 'current_reviewer_id',
       to_jsonb(p_old), to_jsonb(p_new), v_prev_hash, v_self_hash);

    PERFORM public.emit_submittal_event(v_submittal_id, 'replace_user', v_actor, v_payload);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_replace_user(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_replace_user(uuid, uuid) TO authenticated;


-- =============================================================================
-- End of D37 migration.
-- =============================================================================
