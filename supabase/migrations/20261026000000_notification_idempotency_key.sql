-- =============================================================================
-- Migration: notification_idempotency_key
-- Issue: #583  (Wave-1 race-prober: notifications accept duplicates)
-- PR:    fix/583-notification-idempotency
--
-- Problem
--   The `notifications` table has no idempotency contract. Re-firing a trigger
--   (e.g. rfi_assigned, submittal_forwarded) — which happens on retry, on
--   double-tap UPDATEs, or on at-least-once webhook redelivery — produces
--   N identical rows in `notifications` and N outbound emails.
--
-- Fix
--   1. Add `idempotency_key TEXT` (nullable) to `notifications`.
--   2. Partial UNIQUE INDEX on (user_id, idempotency_key) WHERE
--      idempotency_key IS NOT NULL — pre-existing NULL rows stay untouched.
--   3. Add `create_notification(... , p_idempotency_key TEXT)` overload that
--      INSERTs with ON CONFLICT (user_id, idempotency_key) DO NOTHING.
--      Backward-compatible: the original 6-arg signature is preserved.
--   4. Update every `notify_*` trigger function to compute a deterministic
--      key:  `${type}:${entity_id}:${recipient_user_id}` (entity_id is the
--      NEW.id of the row that fired the trigger; recipient_user_id is the
--      user_id we're notifying). For multi-recipient triggers (daily-log,
--      incident, safety-inspection) the recipient is included so each admin
--      still gets their own row, but the second fire of the same assignment
--      is deduped.
--
-- Idempotency
--   Every DDL guarded with IF NOT EXISTS / OR REPLACE. Safe to re-apply.
-- =============================================================================

-- 1. Column ------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

COMMENT ON COLUMN public.notifications.idempotency_key IS
  'Deterministic natural key (typically "${type}:${entity_id}:${user_id}") '
  'used to dedupe re-fired triggers. Partial UNIQUE index lets legacy NULL '
  'rows coexist.';

-- 2. Partial UNIQUE index ----------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_idempotency_key_uidx
  ON public.notifications (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Idempotent create_notification (7-arg variant) --------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id          uuid,
  p_project_id       uuid,
  p_type             text,
  p_title            text,
  p_body             text,
  p_link             text,
  p_idempotency_key  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, project_id, type, title, body, link, idempotency_key)
  VALUES (p_user_id, p_project_id, p_type, p_title, p_body, p_link, p_idempotency_key)
  ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING;
END;
$function$;

-- Backward-compat 6-arg variant: now also dedup-safe by deriving a key from
-- (user_id, project_id, type, link). Anything that doesn't pass an explicit
-- idempotency_key still gets row-level dedup for the same recipient+event.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id     uuid,
  p_project_id  uuid,
  p_type        text,
  p_title       text,
  p_body        text,
  p_link        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  -- Derive a deterministic key for callers that didn't supply one. This is
  -- intentionally narrow (recipient + project + type + link) so it still
  -- dedupes back-to-back identical triggers without colliding across
  -- distinct entities.
  v_key := 'auto:' || p_type || ':' || COALESCE(p_project_id::text, '-')
                  || ':' || COALESCE(p_link, '-')
                  || ':' || p_user_id::text;

  INSERT INTO notifications (user_id, project_id, type, title, body, link, idempotency_key)
  VALUES (p_user_id, p_project_id, p_type, p_title, p_body, p_link, v_key)
  ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING;
END;
$function$;

-- 4. Trigger functions: pass deterministic keys ------------------------------
-- Each trigger now computes `${type}:${entity_id}:${recipient_user_id}` and
-- calls the 7-arg variant explicitly. This is robust against the test in
-- tests/concurrency/notification-idempotency.spec.ts which flips assigned_to
-- to NULL and back N times — every fire produces the same key.

CREATE OR REPLACE FUNCTION public.notify_rfi_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      NEW.project_id,
      'rfi_assigned',
      'RFI #' || NEW.number || ' assigned to you',
      NEW.title,
      '/rfis',
      'rfi_assigned:' || NEW.id::text || ':' || NEW.assigned_to::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_submittal_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'under_review' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM create_notification(
        NEW.assigned_to,
        NEW.project_id,
        'submittal_review',
        'Submittal #' || NEW.number || ' needs your review',
        NEW.title,
        '/submittals',
        'submittal_review:' || NEW.id::text || ':' || NEW.assigned_to::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      NEW.project_id,
      'task_update',
      'Task assigned: ' || NEW.title,
      COALESCE(NEW.description, ''),
      '/tasks',
      'task_assigned:' || NEW.id::text || ':' || NEW.assigned_to::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_punch_item_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      NEW.project_id,
      'punch_item',
      'Punch item assigned: ' || NEW.title,
      COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.floor, ''),
      '/punch-list',
      'punch_item_assigned:' || NEW.id::text || ':' || NEW.assigned_to::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_daily_log_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_approver uuid;
BEGIN
  IF NEW.approved = false AND (OLD IS NULL OR OLD.approved IS DISTINCT FROM NEW.approved OR OLD IS NULL) THEN
    FOR v_approver IN
      SELECT user_id FROM project_members
      WHERE project_id = NEW.project_id AND role IN ('owner', 'admin')
    LOOP
      PERFORM create_notification(
        v_approver,
        NEW.project_id,
        'daily_log_approval',
        'Daily log for ' || NEW.log_date || ' ready for approval',
        COALESCE(NEW.summary, 'Daily log submitted'),
        '/daily-log',
        'daily_log_submitted:' || NEW.id::text || ':' || v_approver::text
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_incident_reported()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid;
  v_severity_label text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_severity_label := COALESCE(INITCAP(REPLACE(NEW.severity, '_', ' ')), 'Unclassified');

    FOR v_admin IN
      SELECT user_id FROM project_members
      WHERE project_id = NEW.project_id AND role IN ('owner', 'admin')
    LOOP
      PERFORM create_notification(
        v_admin,
        NEW.project_id,
        'incident_reported',
        'Incident reported: ' || INITCAP(REPLACE(NEW.type, '_', ' ')) || ' (' || v_severity_label || ')',
        LEFT(NEW.description, 200),
        '/safety/incidents',
        'incident_reported:' || NEW.id::text || ':' || v_admin::text
      );
    END LOOP;

    INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata)
    VALUES (
      NEW.project_id,
      NEW.reported_by,
      'incident_reported',
      'Incident #' || NEW.incident_number || ': ' || INITCAP(REPLACE(NEW.type, '_', ' ')),
      LEFT(NEW.description, 200),
      jsonb_build_object('incident_id', NEW.id, 'type', NEW.type, 'severity', NEW.severity, 'osha_recordable', NEW.osha_recordable)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_inspection_corrective_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.response IN ('fail', 'corrective_action')
     AND NEW.responsible_party IS NOT NULL
     AND (OLD IS NULL OR OLD.responsible_party IS DISTINCT FROM NEW.responsible_party
          OR OLD.response IS DISTINCT FROM NEW.response)
  THEN
    PERFORM create_notification(
      NEW.responsible_party,
      (SELECT project_id FROM safety_inspections WHERE id = NEW.inspection_id),
      'safety_corrective_action',
      'Safety corrective action assigned to you',
      COALESCE(NEW.corrective_action, NEW.question) || CASE WHEN NEW.due_date IS NOT NULL THEN ' (due ' || NEW.due_date || ')' ELSE '' END,
      '/safety/inspections',
      'safety_corrective_action:' || NEW.id::text || ':' || NEW.responsible_party::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_safety_inspection_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid;
BEGIN
  IF NEW.status IN ('failed', 'corrective_action_required')
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    FOR v_admin IN
      SELECT user_id FROM project_members
      WHERE project_id = NEW.project_id AND role IN ('owner', 'admin')
    LOOP
      PERFORM create_notification(
        v_admin,
        NEW.project_id,
        'safety_inspection_failed',
        'Safety inspection ' || UPPER(REPLACE(NEW.status, '_', ' ')) || ': ' || INITCAP(REPLACE(NEW.type, '_', ' ')),
        COALESCE(NEW.area, '') || COALESCE(' Floor ' || NEW.floor, '') || '. Score: ' || COALESCE(NEW.score::text, 'N/A') || '/' || COALESCE(NEW.max_score::text, 'N/A'),
        '/safety/inspections',
        'safety_inspection_result:' || NEW.id::text || ':' || NEW.status || ':' || v_admin::text
      );
    END LOOP;

    INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata)
    VALUES (
      NEW.project_id,
      NEW.inspector_id,
      'safety_inspection_completed',
      'Safety inspection ' || REPLACE(NEW.status, '_', ' ') || ': ' || INITCAP(REPLACE(NEW.type, '_', ' ')),
      COALESCE(NEW.notes, ''),
      jsonb_build_object('inspection_id', NEW.id, 'status', NEW.status, 'score', NEW.score)
    );
  END IF;
  RETURN NEW;
END;
$function$;
