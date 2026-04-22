-- Schedule Dependencies + Critical Path + Advanced Fields
-- Adds predecessor relationships, dependency types, lag, critical path, float, actuals,
-- description, milestone flag, and expands the status enum.
--
-- NOTE: This migration must be applied to the remote Supabase DB.
-- Run: supabase db push   OR   execute this SQL in the Supabase SQL Editor.

-- Expand status CHECK to include 'on_track'
-- (Drop and recreate the constraint since ALTER CHECK is not supported)
DO $$ BEGIN
  ALTER TABLE schedule_phases DROP CONSTRAINT IF EXISTS schedule_phases_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE schedule_phases ADD CONSTRAINT schedule_phases_status_check
  CHECK (status IN ('completed', 'active', 'upcoming', 'at_risk', 'delayed', 'on_track'));

-- New columns
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS is_milestone boolean DEFAULT false;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS predecessor_ids uuid[] DEFAULT '{}';
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS dependency_type text DEFAULT 'FS' CHECK (dependency_type IN ('FS','FF','SS','SF'));
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS lag_days integer DEFAULT 0;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT false;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS float_days integer DEFAULT 0;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS actual_start date;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS actual_end date;

-- percent_complete already exists as numeric; add range check if not present
DO $$ BEGIN
  ALTER TABLE schedule_phases ADD CONSTRAINT schedule_phases_pct_check
    CHECK (percent_complete >= 0 AND percent_complete <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
