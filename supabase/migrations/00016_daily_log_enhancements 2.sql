-- Daily Log Module Enhancements

-- Add signature and status fields to daily_logs
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected'));
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS superintendent_signature_url text;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS manager_signature_url text;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS rejection_comments text;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS wind_speed text;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS precipitation text;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS weather_am text;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS weather_pm text;

-- Expand daily_log_entries types
-- Already has: manpower, equipment, incident, note
-- Add types for the new sections
ALTER TABLE daily_log_entries DROP CONSTRAINT IF EXISTS daily_log_entries_type_check;
ALTER TABLE daily_log_entries ADD CONSTRAINT daily_log_entries_type_check
  CHECK (type IN ('manpower','equipment','incident','note','material_received','visitor','delay','inspection','work_performed'));

-- Add fields for new entry types
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS time_in text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS time_out text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS delay_cause text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS delay_hours numeric;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS inspector_name text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS inspection_result text;
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]';
ALTER TABLE daily_log_entries ADD COLUMN IF NOT EXISTS location text;

-- Index for entry type filtering
CREATE INDEX IF NOT EXISTS idx_daily_log_entries_type ON daily_log_entries(type);
