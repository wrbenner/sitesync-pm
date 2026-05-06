-- ═══════════════════════════════════════════════════════════════
-- Migration: rfi_escalations audit trail + SLA pause/policy fields
-- Version: 20260429010001
--
-- Purpose:
--   The legal trail for "we tried to reach you N times before declaring
--   the RFI overdue." Every escalation event written here so the GC can
--   defend a time extension or a delay claim with a clean audit log.
--
-- Tables / columns:
--   • rfi_escalations          — append-only event log
--   • rfis.sla_paused_at       — clock pause anchor (null = ticking)
--   • rfis.sla_paused_reason   — required when pausing
--   • rfis.sla_paused_by       — user who paused
--   • directory_contacts.escalation_policy — 'gentle' | 'standard' | 'silent'
--   • project_holidays         — per-project working-calendar override
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rfi_escalations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id        uuid NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Stage of the SLA ladder this event represents.
  -- 't_minus_2' = soft nudge; 'overdue_first' = day-0+ first overdue mail;
  -- 'cc_manager' = +3 day CC; 'delay_risk' = +7 day delay-risk flag with
  -- auto-drafted CO narrative; 'pause' = SLA clock paused; 'resume' = clock
  -- resumed; 'manual' = user-triggered ad-hoc escalation.
  stage         text NOT NULL CHECK (stage IN (
                  't_minus_2','overdue_first','cc_manager','delay_risk',
                  'pause','resume','manual'
                )),
  channel       text NOT NULL CHECK (channel IN ('email','in_app','slack','sms','none')),
  recipient_user_id    uuid REFERENCES auth.users(id),
  recipient_email      text,
  recipient_contact_id uuid REFERENCES directory_contacts(id),
  triggered_at  timestamptz NOT NULL DEFAULT now(),
  -- The notification_queue row this event enqueued (if any). Lets us
  -- correlate bounces / failures back to the escalation event.
  notification_queue_id uuid REFERENCES notification_queue(id),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by  uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfi_escalations_rfi
  ON rfi_escalations(rfi_id, stage, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfi_escalations_project
  ON rfi_escalations(project_id, triggered_at DESC);
-- The escalator's most-frequent query: "has this rfi already received
-- this stage?" Idempotency depends on this index being fast.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfi_escalations_rfi_stage_once
  ON rfi_escalations(rfi_id, stage)
  WHERE stage IN ('t_minus_2','overdue_first','cc_manager','delay_risk');

-- ── RFI clock pause/resume ───────────────────────────────────────────
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS sla_paused_at      timestamptz,
  ADD COLUMN IF NOT EXISTS sla_paused_reason  text,
  ADD COLUMN IF NOT EXISTS sla_paused_by      uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sla_total_pause_seconds bigint NOT NULL DEFAULT 0;
-- Constraint: paused_reason is required when paused_at is set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfis_pause_reason_required'
  ) THEN
    ALTER TABLE rfis ADD CONSTRAINT rfis_pause_reason_required
      CHECK (sla_paused_at IS NULL OR sla_paused_reason IS NOT NULL);
  END IF;
END $$;

-- ── Per-recipient escalation policy ──────────────────────────────────
-- 'gentle'   = single overdue mail; no CC manager, no delay-risk flag
-- 'standard' = full ladder (default)
-- 'silent'   = in-app only; never email this contact
ALTER TABLE directory_contacts
  ADD COLUMN IF NOT EXISTS escalation_policy text NOT NULL DEFAULT 'standard';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'directory_contacts_escalation_policy_check'
  ) THEN
    ALTER TABLE directory_contacts ADD CONSTRAINT directory_contacts_escalation_policy_check
      CHECK (escalation_policy IN ('gentle','standard','silent'));
  END IF;
END $$;

-- Optional parent contact (a sub's PM, an architect's principal). The +3
-- day "CC manager" stage walks up via this link.
ALTER TABLE directory_contacts
  ADD COLUMN IF NOT EXISTS parent_contact_id uuid REFERENCES directory_contacts(id);
CREATE INDEX IF NOT EXISTS idx_directory_contacts_parent
  ON directory_contacts(parent_contact_id);

-- ── Per-project holiday calendar ─────────────────────────────────────
-- The business-days calculator already excludes weekends. Holidays are
-- per-project (a Texas project respects different days than a Quebec
-- one). NULL project_id = global default holiday (rare; for the default
-- list only).
CREATE TABLE IF NOT EXISTS project_holidays (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_holidays_project
  ON project_holidays(project_id, holiday_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_holidays_unique
  ON project_holidays(project_id, holiday_date);

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE rfi_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_holidays ENABLE ROW LEVEL SECURITY;

-- Project-scoped read; service role can write (the escalator runs as
-- service role, never as a user).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rfi_escalations_project_read') THEN
    CREATE POLICY rfi_escalations_project_read ON rfi_escalations
      FOR SELECT
      USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rfi_escalations_service_write') THEN
    CREATE POLICY rfi_escalations_service_write ON rfi_escalations
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role'
        OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'project_holidays_project_access') THEN
    CREATE POLICY project_holidays_project_access ON project_holidays
      FOR ALL
      USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))
      WITH CHECK (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
  END IF;
END $$;
