-- Add is_demo flag to projects so the demo seed (src/services/demoSeed.ts)
-- can mark the curated "Maple Ridge" sample distinctly from real work.
-- Used by the UI to show a demo banner and the "Reset Demo" button only
-- on the seeded project, never on real customer projects.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_projects_org_demo
  ON projects (organization_id, is_demo)
  WHERE is_demo = true;

COMMENT ON COLUMN projects.is_demo IS
  'True only for organization-scoped seeded demo projects (Maple Ridge fixture). UI surfaces a demo banner + Reset Demo button. Real customer projects always remain false.';
