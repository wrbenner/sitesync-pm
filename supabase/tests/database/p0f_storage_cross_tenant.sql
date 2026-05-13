-- BRT sub-0 day-3 P0-F verification: storage.objects policies are
-- project-scoped (per-command, project_members-gated). Confirms shape
-- only — functional cross-tenant tests require seed data and live
-- bucket interactions which are outside pgTAP's clean-transaction
-- scope.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(4);

-- 1. The 8 old weak ALL-policies are gone.
SELECT is(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN (
        'storage_attachments_access',
        'storage_daily_log_photos_access',
        'storage_daily_log_signatures_access',
        'storage_documents_access',
        'storage_punch_list_photos_access',
        'storage_reports_access',
        'storage_safety_photos_access',
        'storage_submittal_specs_access'
      ))::bigint,
  0::bigint,
  'Weak ALL-policies dropped on all 8 buckets'
);

-- 2. 32 new per-command policies exist (4 commands × 8 buckets).
SELECT is(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ~ '^storage_(attachments|daily_log_photos|daily_log_signatures|documents|punch_list_photos|reports|safety_photos|submittal_specs)_access_(select|insert|update|delete)$')::bigint,
  32::bigint,
  '32 per-command project-scoped policies present (4 cmds × 8 buckets)'
);

-- 3. Every new policy is restricted to `authenticated` role (not public).
SELECT is(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ~ '^storage_.*_access_(select|insert|update|delete)$'
      AND roles::text[] = ARRAY['authenticated'])::bigint,
  32::bigint,
  'All 32 new policies scoped to authenticated role'
);

-- 4. Every new policy references project_members (membership gate).
-- Combine USING (qual) and WITH CHECK (with_check) text.
SELECT is(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ~ '^storage_.*_access_(select|insert|update|delete)$'
      AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%project_members%')::bigint,
  32::bigint,
  'All 32 policies gate via project_members EXISTS'
);

SELECT * FROM finish();

ROLLBACK;
