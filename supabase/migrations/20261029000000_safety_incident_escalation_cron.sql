-- ═══════════════════════════════════════════════════════════════
-- Migration: safety_incident_escalation_cron
-- Version: 20261029000000
-- FMEA: B.SAFETY.1 (Wave 4) — close the escalation gap
--
-- Hazard closed:
--   `notify_incident_reported()` (00005_safety_module.sql) fires the
--   on-trigger notification ONCE when a safety incident is created.
--   If the incident stays unassigned (investigated_by IS NULL) and
--   its investigation_status remains 'open' for hours, the OSHA
--   reporting window is silently bleeding out. Wave-4 FMDC surfaced
--   this as a real gap: no cron job scans `incidents` for escalation.
--
-- Mitigation:
--   1. A SECURITY DEFINER scanner function that finds high-severity
--      (lost_time, fatality) incidents that have been 'open' AND
--      unassigned (investigated_by IS NULL) for ≥ 4 hours, then
--      enqueues a notification_queue row addressed to every owner /
--      admin on the project's organization. Idempotent via a
--      per-incident-per-recipient-per-day existence guard so the
--      hourly cron does not flood.
--   2. A pg_cron schedule at `0 * * * *` cadence (every hour, top of
--      the hour) that invokes the scanner. Idempotent
--      cron.unschedule guard so re-apply is safe.
-- ═══════════════════════════════════════════════════════════════

-- ── Scanner function ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.escalate_unassigned_high_severity_incidents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_rows_enqueued integer := 0;
  v_incident      record;
  v_admin         record;
  v_today         date := (now() at time zone 'UTC')::date;
  v_already_sent  boolean;
BEGIN
  -- Walk every incident that is high-severity (lost_time / fatality),
  -- still recorded AS open, never assigned to an investigator, and
  -- older than 4 hours. The hourly cron cadence + the per-day
  -- existence guard in notification_queue prevent duplicate enqueues.
  FOR v_incident IN
    SELECT i.id,
           i.project_id,
           i.incident_number,
           i.severity,
           i.description,
           i.created_at,
           p.organization_id
      FROM public.incidents i
      JOIN public.projects   p ON p.id = i.project_id
     WHERE i.investigation_status = 'open'
       AND i.investigated_by IS NULL
       AND i.severity IN ('lost_time', 'fatality')
       AND i.created_at < now() - interval '4 hours'
  LOOP
    -- Enqueue one notification_queue row per org admin / owner.
    FOR v_admin IN
      SELECT m.user_id, u.email
        FROM public.organization_members m
        JOIN auth.users u ON u.id = m.user_id
       WHERE m.organization_id = v_incident.organization_id
         AND m.role IN ('owner', 'admin')
    LOOP
      -- Idempotency: skip if we already enqueued an escalation for
      -- this (incident, recipient, day) tuple.
      SELECT EXISTS (
        SELECT 1
          FROM public.notification_queue
         WHERE entity_type      = 'incident'
           AND entity_id        = v_incident.id
           AND recipient_user_id = v_admin.user_id
           AND template_name    = 'safety_incident_escalation'
           AND created_at::date = v_today
      ) INTO v_already_sent;

      IF v_already_sent THEN
        CONTINUE;
      END IF;

      INSERT INTO public.notification_queue (
        project_id,
        recipient_user_id,
        recipient_email,
        template_name,
        template_data,
        entity_type,
        entity_id
      ) VALUES (
        v_incident.project_id,
        v_admin.user_id,
        v_admin.email,
        'safety_incident_escalation',
        jsonb_build_object(
          'incident_id',     v_incident.id,
          'project_id',      v_incident.project_id,
          'incident_number', v_incident.incident_number,
          'severity',        v_incident.severity,
          'description',     v_incident.description,
          'created_at',      v_incident.created_at,
          'age_hours',       extract(epoch from (now() - v_incident.created_at)) / 3600
        ),
        'incident',
        v_incident.id
      );

      v_rows_enqueued := v_rows_enqueued + 1;
    END LOOP;
  END LOOP;

  RETURN v_rows_enqueued;
END;
$func$;

REVOKE ALL ON FUNCTION public.escalate_unassigned_high_severity_incidents() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.escalate_unassigned_high_severity_incidents() FROM anon;
-- service_role / authenticated keep EXECUTE via Supabase default privileges.

COMMENT ON FUNCTION public.escalate_unassigned_high_severity_incidents() IS
  'FMEA B.SAFETY.1 (Wave 4): scans incidents with investigation_status=open '
  'AND investigated_by IS NULL AND severity IN (lost_time, fatality) AND '
  'created_at < now() - interval ''4 hours''. Enqueues notification_queue '
  'rows to org owners/admins. Idempotent via per-day existence guard.';

-- ── Cron schedule ────────────────────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net')
  ) THEN
    RAISE NOTICE 'pg_cron/pg_net not installed — skipping safety escalation schedule.';
    RETURN;
  END IF;

  -- Idempotent — drop any prior schedule under the same name.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'safety-incident-escalation') THEN
    PERFORM cron.unschedule('safety-incident-escalation');
  END IF;

  PERFORM cron.schedule(
    'safety-incident-escalation',
    '0 * * * *', -- top of every hour
    $job$
      SELECT public.escalate_unassigned_high_severity_incidents();
    $job$
  );

  RAISE NOTICE 'safety-incident-escalation cron scheduled hourly.';
END
$do$;
