-- =============================================================================
-- RFI parity wave — schema unblock for the 3 deferred UI items
--
-- Drives:    docs/audits/RFI_PROCORE_PARITY_FOLLOW_ON_RECEIPT_2026-05-07.md
--            (the "schema-blocked" section: C3, E1, E2)
--
-- C3 — Default Distribution pre-fill on Create flow
-- E2 — Default Distribution config in Settings
--   Both need a `default_distribution` JSONB column on
--   public.project_rfi_settings. Today only submittal_settings has the
--   equivalent. Add it here so the next session can wire the chip-editor
--   UI in RFICreateWizard.tsx + RFISettingsPage.tsx without a migration
--   round-trip.
--
-- E1 — Settings email matrix (8 events × 5 recipient roles)
--   Today public.project_rfi_notification_prefs is shaped as
--   (event, channel, enabled) — Procore's matrix model is
--   (event, recipient_role, enabled). Add a recipient_role enum + the
--   column. Existing channel-based rows stay valid (recipient_role is
--   nullable until the UI cuts over).
--
-- Style: ADDITIVE only. No backfill, no behavior change to existing
-- callers. The new columns are nullable / defaulted so all current code
-- paths continue to work.
-- =============================================================================


-- ── 1. Default Distribution on project_rfi_settings (C3 + E2) ───────────────

ALTER TABLE public.project_rfi_settings
  ADD COLUMN IF NOT EXISTS default_distribution JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.project_rfi_settings.default_distribution IS
  'JSON array of recipient identifiers (user_id UUIDs OR raw email '
  'strings) that pre-populate the Distribution chip editor on the RFI '
  'create form. Set in RFISettingsPage > General; consumed by '
  'RFICreateWizard. Empty array (default) means no pre-fill — admin '
  'must enable explicitly. Per the May-7 RFI gap audit items C3 + E2.';


-- ── 2. recipient_role enum + column on project_rfi_notification_prefs (E1) ──

DO $$ BEGIN
  CREATE TYPE public.rfi_notification_recipient_role AS ENUM (
    'creator',
    'manager',
    'assignee',
    'distribution_group',
    'watcher'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE public.rfi_notification_recipient_role IS
  '5 recipient roles for the Procore-parity email matrix on the RFI '
  'Settings page. Each (event, recipient_role) pair has its own enabled '
  'flag — 8 events × 5 roles = 40 rows per project at full saturation. '
  'Per the May-7 RFI gap audit item E1.';

ALTER TABLE public.project_rfi_notification_prefs
  ADD COLUMN IF NOT EXISTS recipient_role public.rfi_notification_recipient_role;

COMMENT ON COLUMN public.project_rfi_notification_prefs.recipient_role IS
  'New (2026-05-08) per E1 — the row''s recipient_role for the email '
  'matrix. Nullable until the matrix UI cuts over from the legacy '
  '(event, channel) shape; the existing channel column stays in force '
  'for current notification senders.';

-- New uniqueness constraint for the matrix layer: one row per
-- (project_id, event, recipient_role). Partial — only applies when
-- recipient_role is set, so the legacy channel-keyed rows aren't
-- affected. Without this the matrix UI's upsert (project_id + event +
-- recipient_role → enabled) has no key to target.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_rfi_notification_prefs_matrix
  ON public.project_rfi_notification_prefs (project_id, event, recipient_role)
  WHERE recipient_role IS NOT NULL;


-- ── 3. Sanity-check: list the new shape so the receipt is verifiable ────────
-- (Read-only; no DDL.)
DO $$
DECLARE
  has_default_dist  BOOLEAN;
  has_recipient_role BOOLEAN;
  has_role_enum     BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='project_rfi_settings'
      AND column_name='default_distribution'
  ) INTO has_default_dist;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='project_rfi_notification_prefs'
      AND column_name='recipient_role'
  ) INTO has_recipient_role;

  SELECT EXISTS(
    SELECT 1 FROM pg_type
    WHERE typname='rfi_notification_recipient_role'
  ) INTO has_role_enum;

  IF NOT has_default_dist THEN
    RAISE EXCEPTION 'C3/E2 unblock failed: default_distribution column missing';
  END IF;
  IF NOT has_recipient_role THEN
    RAISE EXCEPTION 'E1 unblock failed: recipient_role column missing';
  END IF;
  IF NOT has_role_enum THEN
    RAISE EXCEPTION 'E1 unblock failed: rfi_notification_recipient_role enum missing';
  END IF;
END $$;
