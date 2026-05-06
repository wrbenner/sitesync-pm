-- ═══════════════════════════════════════════════════════════════
-- Migration: sealed_exports_bucket
-- Version:   20260506000002
-- Purpose:   Provision the `sealed-exports` storage bucket used by
--            supabase/functions/sealed-entity-export/. The function
--            uploads deposition-grade evidence (HTML rendering of
--            an entity's full audit trail) and returns a 1-hour
--            signed URL.
--
--            Without this bucket the function silently swallows the
--            upload error and then 500s on createSignedUrl. The
--            function has been hardened in the same PR to surface
--            bucket-not-found loudly going forward.
--
--            Privacy: PRIVATE bucket. The only legitimate access
--            path is the signed URL returned by the edge function,
--            which is gated by `verifyProjectMembership`.
--
--            Idempotent: ON CONFLICT DO NOTHING.
-- ═══════════════════════════════════════════════════════════════

-- ── Bucket ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sealed-exports',
  'sealed-exports',
  false,
  10 * 1024 * 1024,           -- 10 MB ceiling per sealed export
  ARRAY['text/html', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ──────────────────────────────────────────────
-- All access goes through service-role-issued signed URLs.
-- We deny direct user reads/writes; the function uses the service
-- role and is responsible for membership enforcement before upload.
DROP POLICY IF EXISTS sealed_exports_no_user_access ON storage.objects;
CREATE POLICY sealed_exports_no_user_access ON storage.objects
  FOR ALL
  USING (bucket_id <> 'sealed-exports')
  WITH CHECK (bucket_id <> 'sealed-exports');

COMMENT ON POLICY sealed_exports_no_user_access ON storage.objects IS
  'sealed-exports is service-role-only. Users access via signed URLs '
  'returned by supabase/functions/sealed-entity-export — never directly.';
