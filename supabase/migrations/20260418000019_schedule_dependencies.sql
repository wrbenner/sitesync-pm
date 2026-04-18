-- Schedule Dependencies + Critical Path
-- Adds predecessor relationships, dependency types, lag, critical path, float, and actuals.

ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS predecessor_ids uuid[] DEFAULT '{}';
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS dependency_type text DEFAULT 'FS' CHECK (dependency_type IN ('FS','FF','SS','SF'));
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS lag_days integer DEFAULT 0;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT false;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS float_days integer DEFAULT 0;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS actual_start date;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS actual_end date;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS percent_complete integer DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100);
