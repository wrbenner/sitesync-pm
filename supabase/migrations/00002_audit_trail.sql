CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  organization_id uuid,
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  user_name text,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'status_change', 'approve', 'reject', 'submit', 'close')),
  before_state jsonb,
  after_state jsonb,
  changed_fields text[],
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_log_project ON audit_log(project_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can read audit logs" ON audit_log
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System writes audit logs" ON audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "No updates to audit logs" ON audit_log
  FOR UPDATE USING (false);

CREATE POLICY "No deletes from audit logs" ON audit_log
  FOR DELETE USING (false);
