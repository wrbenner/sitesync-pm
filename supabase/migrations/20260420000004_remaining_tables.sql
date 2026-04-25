-- Remainder of catchall migration — everything after the project_metrics
-- block that errored out (it's a materialized view, not a table).
-- Safe to run: all IF NOT EXISTS / EXCEPTION WHEN duplicate_object.

CREATE TABLE IF NOT EXISTS weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  forecast_data jsonb DEFAULT '{}',
  cached_at timestamptz DEFAULT now()
);
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY weather_cache_member_access ON weather_cache
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS zip_upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  file_count integer DEFAULT 0,
  processed_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE zip_upload_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY zip_upload_jobs_owner ON zip_upload_jobs
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  value numeric,
  status text DEFAULT 'active',
  percent_complete numeric DEFAULT 0,
  end_date date,
  closed_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY benchmarks_member_access ON benchmarks
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  trade text,
  insurance_status text DEFAULT 'pending',
  insurance_expiry date,
  contact_email text,
  contact_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY companies_member_access ON companies
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS contract_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  clause_id text,
  clause_title text,
  clause_category text,
  clause_text text,
  clause_version integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE contract_clauses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY contract_clauses_access ON contract_clauses
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM contracts c
        JOIN project_members pm ON pm.project_id = c.project_id
        WHERE c.id = contract_clauses.contract_id
          AND pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS payment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric DEFAULT 0,
  due_date date,
  status text DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY payment_milestones_access ON payment_milestones
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM contracts c
        JOIN project_members pm ON pm.project_id = c.project_id
        WHERE c.id = payment_milestones.contract_id
          AND pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS rfi_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  subject text,
  question text,
  source_description text,
  source_photo text,
  source_drawing text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE rfi_drafts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY rfi_drafts_owner ON rfi_drafts
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ai_rfi_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  source text,
  source_ref text,
  subject text,
  question text,
  severity text DEFAULT 'medium',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_rfi_drafts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY ai_rfi_drafts_member_access ON ai_rfi_drafts
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS async_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  integration_id uuid,
  payload jsonb DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY async_jobs_service ON async_jobs FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS signature_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text,
  is_required boolean DEFAULT false,
  response_value text,
  signed_by uuid REFERENCES auth.users(id),
  signed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE signature_fields ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY signature_fields_all ON signature_fields FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('daily-log-photos', 'daily-log-photos', false, 52428800),
  ('daily-log-signatures', 'daily-log-signatures', false, 10485760),
  ('documents', 'documents', false, 104857600),
  ('punch-list-photos', 'punch-list-photos', false, 52428800),
  ('safety-photos', 'safety-photos', false, 52428800),
  ('submittal-specs', 'submittal-specs', false, 104857600),
  ('attachments', 'attachments', false, 104857600),
  ('reports', 'reports', false, 104857600)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  bkt text;
BEGIN
  FOR bkt IN SELECT unnest(ARRAY[
    'daily-log-photos','daily-log-signatures','documents',
    'punch-list-photos','safety-photos','submittal-specs',
    'attachments','reports'
  ]) LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR ALL USING (bucket_id = %L AND auth.uid() IS NOT NULL)',
        'storage_' || replace(bkt, '-', '_') || '_access',
        bkt
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
