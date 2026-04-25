-- ══════════════════════════════════════════════════════════════
-- CATCH-ALL: Create every table the front-end references that
-- doesn't exist yet.  Safe to re-run (IF NOT EXISTS everywhere).
-- ══════════════════════════════════════════════════════════════

-- ── daily_summaries ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  summary_date date NOT NULL DEFAULT CURRENT_DATE,
  summary text,
  highlights jsonb DEFAULT '[]',
  concerns jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY daily_summaries_member_access ON daily_summaries
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── documents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  description text,
  storage_path text,
  file_size bigint,
  content_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY documents_member_access ON documents
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── drawing_annotations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS drawing_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid REFERENCES drawings(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  annotation_type text DEFAULT 'markup',
  content jsonb DEFAULT '{}',
  geometry jsonb,
  page_number integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE drawing_annotations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY drawing_annotations_member_access ON drawing_annotations
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── drawing_sheets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drawing_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid REFERENCES drawings(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  page_number integer NOT NULL DEFAULT 1,
  sheet_number text,
  title text,
  file_url text,
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE drawing_sheets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY drawing_sheets_member_access ON drawing_sheets
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── punch_item_comments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS punch_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_item_id uuid REFERENCES punch_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE punch_item_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY punch_item_comments_access ON punch_item_comments
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM punch_items pi
        JOIN project_members pm ON pm.project_id = pi.project_id
        WHERE pi.id = punch_item_comments.punch_item_id
          AND pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── submittal_revisions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS submittal_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id uuid REFERENCES submittals(id) ON DELETE CASCADE,
  revision_number integer NOT NULL DEFAULT 1,
  status text DEFAULT 'pending',
  submitted_by uuid REFERENCES auth.users(id),
  reviewer_id uuid REFERENCES auth.users(id),
  reviewer_role text DEFAULT 'gc',
  file_urls jsonb DEFAULT '[]',
  comments text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (submittal_id, revision_number)
);
ALTER TABLE submittal_revisions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY submittal_revisions_access ON submittal_revisions
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM submittals s
        JOIN project_members pm ON pm.project_id = s.project_id
        WHERE s.id = submittal_revisions.submittal_id
          AND pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── meeting_participants ────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text,
  email text,
  role text,
  attended boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY meeting_participants_access ON meeting_participants
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM meetings m
        JOIN project_members pm ON pm.project_id = m.project_id
        WHERE m.id = meeting_participants.meeting_id
          AND pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── pay_application_line_items ──────────────────────────────
CREATE TABLE IF NOT EXISTS pay_application_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_application_id uuid REFERENCES pay_applications(id) ON DELETE CASCADE,
  subcontractor_id uuid,
  vendor_id uuid,
  vendor_name text,
  description text,
  amount numeric DEFAULT 0,
  amount_this_period numeric DEFAULT 0,
  payment_period text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE pay_application_line_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY pay_app_line_items_access ON pay_application_line_items
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM pay_applications pa
        JOIN project_members pm ON pm.project_id = pa.project_id
        WHERE pa.id = pay_application_line_items.pay_application_id
          AND pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── edit_locks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS edit_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  locked_by_user_id uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);
ALTER TABLE edit_locks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY edit_locks_all ON edit_locks FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── user_invitations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  role text DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id),
  token text UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY user_invitations_org_access ON user_invitations
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = user_invitations.organization_id
          AND om.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ai_conversations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  title text,
  conversation_topic text,
  message_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY ai_conversations_owner ON ai_conversations
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ai_messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY ai_messages_access ON ai_messages
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM ai_conversations ac
        WHERE ac.id = ai_messages.conversation_id
          AND ac.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── conversations + chat_messages (real-time chat) ──────────
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text,
  type text DEFAULT 'group',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY conversations_member_access ON conversations
    FOR ALL USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  content text,
  message_type text DEFAULT 'text',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY chat_messages_access ON chat_messages
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = chat_messages.conversation_id
          AND is_project_member(c.project_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── message_reactions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY message_reactions_all ON message_reactions
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── project_metrics ─────────────────────────────────────────
-- SKIPPED: project_metrics already exists as a materialized view.
-- RLS cannot be applied to materialized views; access is controlled at query time.

-- ── weather_cache ───────────────────────────────────────────
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

-- ── zip_upload_jobs ─────────────────────────────────────────
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

-- ── benchmarks ──────────────────────────────────────────────
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

-- ── companies ───────────────────────────────────────────────
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

-- ── contract_clauses ────────────────────────────────────────
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

-- ── payment_milestones ──────────────────────────────────────
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

-- ── rfi_drafts (edge function) ──────────────────────────────
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

-- ── ai_rfi_drafts (edge function) ───────────────────────────
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

-- ── async_jobs (webhook processing) ─────────────────────────
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

-- ── signature_fields ────────────────────────────────────────
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

-- ── Missing storage buckets ─────────────────────────────────
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

-- Storage RLS: allow authenticated users to use these buckets
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
