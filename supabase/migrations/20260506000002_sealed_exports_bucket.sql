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
-- public=false + no explicit storage.objects RLS policy granting user
-- access means Supabase Storage default-denies direct user reads. All
-- legitimate access flows through service-role-issued signed URLs from
-- the sealed-entity-export edge function, which gates on
-- verifyProjectMembership() before upload.
--
-- We do NOT add an explicit storage.objects policy here: hosted Supabase
-- denies CREATE POLICY on storage.objects via the migration API (the
-- migration role lacks ownership). The default-deny posture is
-- equivalent for our threat model.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sealed-exports',
  'sealed-exports',
  false,
  10 * 1024 * 1024,           -- 10 MB ceiling per sealed export
  ARRAY['text/html', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;
