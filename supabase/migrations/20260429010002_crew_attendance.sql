-- ═══════════════════════════════════════════════════════════════
-- Migration: crew_attendance + planned_arrival_time
-- Version: 20260429010002
--
-- Purpose: enables the daily-log "expected vs actual" crew widget.
--
-- The schema today has no notion of "this crew was supposed to be onsite
-- at 7am and is now 60 min late." We add:
--   • crews.planned_arrival_time     — daily planned arrival (HH:MM, e.g. '07:00')
--   • crew_attendance                — one row per crew per day; planned vs actual
--
-- The widget reads from this table; the L2 chain that fires meeting
-- action items reads from this table; the optional foreman clock-in
-- writes to this table.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS planned_arrival_time text;
-- Validate HH:MM format if provided. NULL means "no planned time" — the
-- widget skips those crews silently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crews_planned_arrival_format'
  ) THEN
    ALTER TABLE crews ADD CONSTRAINT crews_planned_arrival_format
      CHECK (planned_arrival_time IS NULL OR planned_arrival_time ~ '^[0-2][0-9]:[0-5][0-9]$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crew_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  crew_id         uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  planned_arrival_time text,           -- snapshot at row-creation
  actual_check_in_at   timestamptz,    -- foreman taps "we're here"
  no_show_flagged_at   timestamptz,    -- the chain set this when 60 min late
  meeting_action_item_id uuid REFERENCES meeting_action_items(id),
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crew_attendance_unique
  ON crew_attendance(crew_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_crew_attendance_project_date
  ON crew_attendance(project_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_crew_attendance_metadata
  ON crew_attendance USING gin (metadata);

ALTER TABLE crew_attendance ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'crew_attendance_project_access') THEN
    CREATE POLICY crew_attendance_project_access ON crew_attendance
      FOR ALL
      USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))
      WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
  END IF;
END $$;
