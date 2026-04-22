-- Add wbs column to schedule_phases so imported section/building context
-- (e.g. "Building A", "PHASE 2 — FOUNDATION") can persist alongside each
-- activity. Used by the Schedule Import Wizard to preserve hierarchy from
-- PDF/P6/MS Project sources that include section headers or zone codes.

ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS wbs text;

CREATE INDEX IF NOT EXISTS idx_schedule_phases_wbs
  ON schedule_phases (project_id, wbs)
  WHERE wbs IS NOT NULL;
