-- SEC-C07: Storage bucket policies were previously authenticated-only, letting any
-- logged-in user read/write/delete ANY project's files. Replace with
-- project-membership-scoped policies keyed on the first path segment (project_id).
--
-- Convention enforced in application code (e.g. src/stores/fileStore.ts,
-- src/services/documentService.ts): uploads place files at `{project_id}/...`.
-- storage.foldername(name)[1] extracts that leading project_id segment.

-- ── Drop previous permissive policies ──────────────────────────────
DROP POLICY IF EXISTS "Project members can read project files"   ON storage.objects;
DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can delete project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read drawings"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload drawings"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read field captures"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload field captures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read exports"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can create exports" ON storage.objects;

-- ── Helper: is caller a member of the project encoded as the first path segment? ──
-- Declared inline per policy to keep this migration self-contained.

-- ── project-files bucket ───────────────────────────────────────────
CREATE POLICY "project_files_select_members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "project_files_insert_members"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "project_files_update_members"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "project_files_delete_members"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

-- ── drawings bucket ────────────────────────────────────────────────
CREATE POLICY "drawings_select_members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'drawings'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "drawings_insert_members"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'drawings'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "drawings_update_members"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'drawings'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "drawings_delete_members"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'drawings'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

-- ── field-captures bucket ──────────────────────────────────────────
CREATE POLICY "field_captures_select_members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'field-captures'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "field_captures_insert_members"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'field-captures'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "field_captures_update_members"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'field-captures'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "field_captures_delete_members"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'field-captures'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

-- ── exports bucket ─────────────────────────────────────────────────
CREATE POLICY "exports_select_members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "exports_insert_members"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "exports_update_members"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "exports_delete_members"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = (select auth.uid())
        AND pm.project_id::text = (storage.foldername(name))[1]
    )
  );

-- avatars bucket remains public-read; tightened write to only the owning user's folder.
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
