-- ── submittal_emails drift heal ─────────────────────────────────────────────
-- Originally applied directly via Supabase Dashboard on 2026-05-07 20:08:10
-- during the May 7 RFI Procore-parity hot push. This file captures the same
-- SQL in the repo so `supabase db push` no longer flags it as orphan-on-
-- remote. Every statement is idempotent (IF NOT EXISTS guards), so a future
-- replay on a fresh database produces the same end-state.

ALTER TABLE public.submittal_emails
  ADD COLUMN IF NOT EXISTS thread_id      text,
  ADD COLUMN IF NOT EXISTS iris_diff_text text,
  ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_submittal_emails_thread
  ON public.submittal_emails (thread_id)
  WHERE thread_id IS NOT NULL;
