-- Portal Access Enhancement: token-based auth for external stakeholders

-- Add portal access token table for direct link access
CREATE TABLE IF NOT EXISTS portal_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  portal_type text NOT NULL CHECK (portal_type IN ('owner','investor','architect','consultant')),
  token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  name text,
  email text,
  company text,
  permissions jsonb DEFAULT '["overview","photos","milestones"]',
  active boolean DEFAULT true,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  access_count int DEFAULT 0,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_portal_tokens_token ON portal_access_tokens(token);
CREATE INDEX idx_portal_tokens_project ON portal_access_tokens(project_id);

ALTER TABLE portal_access_tokens ENABLE ROW LEVEL SECURITY;

-- Portal tokens are managed by project admins
CREATE POLICY pat_select ON portal_access_tokens FOR SELECT
  USING (is_project_member(project_id));
CREATE POLICY pat_insert ON portal_access_tokens FOR INSERT
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));
CREATE POLICY pat_update ON portal_access_tokens FOR UPDATE
  USING (is_project_role(project_id, ARRAY['owner','admin']));
CREATE POLICY pat_delete ON portal_access_tokens FOR DELETE
  USING (is_project_role(project_id, ARRAY['owner','admin']));

-- Portal visibility settings per project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS portal_config jsonb DEFAULT '{
  "show_budget": true,
  "budget_detail_level": "summary",
  "show_schedule": true,
  "show_photos": true,
  "show_documents": true,
  "show_safety": false,
  "contractor_logo_url": null
}';

-- Seed: create a portal access token for the test project
DO $$
DECLARE
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  INSERT INTO portal_access_tokens (project_id, portal_type, name, email, company, permissions, created_by) VALUES
    (project_id, 'owner', 'James Bradford', 'jbradford@meridiandev.com', 'Meridian Development LLC',
     '["overview","budget","schedule","photos","reports","documents"]', user_mike)
  ON CONFLICT DO NOTHING;
END $$;
