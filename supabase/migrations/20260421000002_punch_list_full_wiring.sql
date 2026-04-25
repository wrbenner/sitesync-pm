-- Punch List — full wiring: verification columns, relaxed FK types,
-- comment-display columns, public photo bucket.
--
-- The app UI consumes a verification pipeline (open → in_progress →
-- sub_complete → verified) plus before/after photos and rejection notes,
-- none of which existed in the schema. sanitizePunchData was silently
-- stripping these fields, so every workflow action was inert.

-- ── punch_items: verification columns ─────────────────────────────────────
ALTER TABLE punch_items
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS verified_by         text,
  ADD COLUMN IF NOT EXISTS verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS sub_completed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS before_photo_url    text,
  ADD COLUMN IF NOT EXISTS after_photo_url     text,
  ADD COLUMN IF NOT EXISTS rejection_reason    text;

-- Backfill from legacy status so existing rows aren't stuck on 'open'.
UPDATE punch_items
SET verification_status = CASE
  WHEN status = 'resolved' THEN 'sub_complete'
  WHEN status = 'verified' THEN 'verified'
  WHEN status = 'in_progress' THEN 'in_progress'
  ELSE 'open'
END
WHERE verification_status IS NULL OR verification_status = 'open';

-- Enforce the app's state set.
ALTER TABLE punch_items DROP CONSTRAINT IF EXISTS punch_items_verification_status_check;
ALTER TABLE punch_items ADD CONSTRAINT punch_items_verification_status_check
  CHECK (verification_status IN ('open','in_progress','sub_complete','verified','rejected'));

-- ── punch_items: relax assigned_to / reported_by to text ─────────────────
-- The UI sends free-text names (contacts may not map to auth.users).
-- Drop FKs and coerce to text so writes stop failing.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'punch_items'::regclass
      AND contype = 'f'
      AND conname ~ '(assigned_to|reported_by)'
  LOOP
    EXECUTE format('ALTER TABLE punch_items DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE punch_items ALTER COLUMN assigned_to TYPE text USING assigned_to::text;
ALTER TABLE punch_items ALTER COLUMN reported_by TYPE text USING reported_by::text;

-- ── punch_item_comments: align columns with UI shape ─────────────────────
ALTER TABLE punch_item_comments
  ADD COLUMN IF NOT EXISTS author   text,
  ADD COLUMN IF NOT EXISTS initials text,
  ADD COLUMN IF NOT EXISTS text     text;

-- Backfill text from content so existing comments still render.
UPDATE punch_item_comments SET text = content WHERE text IS NULL AND content IS NOT NULL;

-- ── storage: punch-list-photos must be public for <img src> to resolve ──
UPDATE storage.buckets SET public = true WHERE id = 'punch-list-photos';
