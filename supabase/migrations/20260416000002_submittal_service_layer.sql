-- Submittal Service Layer: provenance columns, soft-delete, description

-- Provenance and soft-delete
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

-- Index for soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_submittals_deleted_at ON submittals(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submittals_project_active ON submittals(project_id) WHERE deleted_at IS NULL;
