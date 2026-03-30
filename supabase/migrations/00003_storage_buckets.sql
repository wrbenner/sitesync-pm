-- Storage buckets for SiteSync PM
INSERT INTO storage.buckets (id, name, public) VALUES
  ('project-files', 'project-files', false),
  ('drawings', 'drawings', false),
  ('field-captures', 'field-captures', false),
  ('avatars', 'avatars', true),
  ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage
-- project-files: project members can read/write
CREATE POLICY "Project members can read project files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-files' AND auth.role() = 'authenticated');

CREATE POLICY "Project members can upload project files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-files' AND auth.role() = 'authenticated');

CREATE POLICY "Project members can update project files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-files' AND auth.role() = 'authenticated');

CREATE POLICY "Project members can delete project files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-files' AND auth.role() = 'authenticated');

-- drawings: same as project-files
CREATE POLICY "Authenticated users can read drawings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'drawings' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload drawings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'drawings' AND auth.role() = 'authenticated');

-- field-captures: same
CREATE POLICY "Authenticated users can read field captures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'field-captures' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload field captures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'field-captures' AND auth.role() = 'authenticated');

-- avatars: public read, authenticated write
CREATE POLICY "Anyone can read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- exports: authenticated read/write
CREATE POLICY "Authenticated users can read exports"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'exports' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create exports"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'exports' AND auth.role() = 'authenticated');
