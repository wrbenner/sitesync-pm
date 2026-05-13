-- BRT sub-0 Day 3 PM — P0-F: project-scoped storage policies for 8 buckets.
--
-- Replaces 8 weak ALL-policies (form `bucket_id = 'X' AND auth.uid() IS
-- NOT NULL`) with per-command SELECT/INSERT/UPDATE/DELETE policies that
-- gate access via project_members + folder-level-1 project UUID.
--
-- Day 0 preflight (BRT_SUB_0_DAY_0_RECEIPT) confirmed: the 2 populated
-- buckets (daily-log-photos: 45 objects; documents: 21 objects) use
-- `<project_uuid>/...` paths at folder level 1 (100% confirmed). The 6
-- other buckets are empty so the policy change is no-op for existing
-- data; the constraint only fires on future inserts.
--
-- Path validation: `(storage.foldername(name))[1]` extracts the first
-- path segment. Regex-guard before `::uuid` cast so malformed paths
-- deny rather than raise (RLS predicate errors propagate up to the
-- caller; we want quiet denies on non-conforming paths).
--
-- NOTE: storage.objects is owned by `supabase_storage_admin`. MCP's
-- migration role does NOT have ownership; `DROP POLICY` and `CREATE
-- POLICY` against storage.objects raise 42501 must be owner of relation
-- objects. This migration is authored for on-disk source-of-truth but
-- must be applied via the Supabase dashboard SQL editor (which runs as
-- supabase_admin role) — see Day 3 PM receipt for the manual apply
-- step.

DO $$
DECLARE
  bkt TEXT;
  policy_name TEXT;
  uuid_re CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  FOREACH bkt IN ARRAY ARRAY[
    'attachments',
    'daily-log-photos',
    'daily-log-signatures',
    'documents',
    'punch-list-photos',
    'reports',
    'safety-photos',
    'submittal-specs'
  ] LOOP
    policy_name := 'storage_' || replace(bkt, '-', '_') || '_access';

    -- Drop the weak ALL-policy if present.
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);

    -- Per-command project-scoped policies (4 per bucket).
    -- SELECT — USING only.
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = %L
          AND (storage.foldername(name))[1] ~ %L
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
             WHERE pm.user_id    = (SELECT auth.uid())
               AND pm.project_id = (storage.foldername(name))[1]::uuid
          )
        )
    $f$, policy_name || '_select', bkt, uuid_re);

    -- INSERT — WITH CHECK only.
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = %L
          AND (storage.foldername(name))[1] ~ %L
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
             WHERE pm.user_id    = (SELECT auth.uid())
               AND pm.project_id = (storage.foldername(name))[1]::uuid
          )
        )
    $f$, policy_name || '_insert', bkt, uuid_re);

    -- UPDATE — USING + WITH CHECK (caller must own row pre and post).
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id = %L
          AND (storage.foldername(name))[1] ~ %L
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
             WHERE pm.user_id    = (SELECT auth.uid())
               AND pm.project_id = (storage.foldername(name))[1]::uuid
          )
        )
        WITH CHECK (
          bucket_id = %L
          AND (storage.foldername(name))[1] ~ %L
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
             WHERE pm.user_id    = (SELECT auth.uid())
               AND pm.project_id = (storage.foldername(name))[1]::uuid
          )
        )
    $f$, policy_name || '_update', bkt, uuid_re, bkt, uuid_re);

    -- DELETE — USING only.
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = %L
          AND (storage.foldername(name))[1] ~ %L
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
             WHERE pm.user_id    = (SELECT auth.uid())
               AND pm.project_id = (storage.foldername(name))[1]::uuid
          )
        )
    $f$, policy_name || '_delete', bkt, uuid_re);
  END LOOP;
END;
$$;
