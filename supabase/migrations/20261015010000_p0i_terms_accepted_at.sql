-- BRT sub-0 Day 4 PM — P0-I: Terms/Privacy acceptance timestamp on profiles.
--
-- Adds `terms_accepted_at timestamptz` to `public.profiles` so the signup
-- flow can record when a user explicitly accepted the Terms of Service +
-- Privacy Policy.
--
-- NULLABLE because existing profiles predate the checkbox and shouldn't
-- be retroactively flagged. New profiles created via the signup form
-- always populate this on insert (required by zod schema validation +
-- write through the supabase profile insert path).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'BRT sub-0 day-4 P0-I: timestamp when the user explicitly accepted '
  'the Terms of Service + Privacy Policy at signup. NULL for profiles '
  'created before the checkbox shipped (2026-05-13).';
