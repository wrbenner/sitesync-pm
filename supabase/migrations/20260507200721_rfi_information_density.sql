-- ── RFI Information-Density Wave — Schema Foundation ──────────────────────
--
-- Adds the column substrate consumed by the next 3 PRs in the wave:
--   • Tier S4 backfill on rfis (the 5 Procore fields we don't track yet)
--   • Close-action richness (disposition + final_response link + summary
--     + actuals + signoff)
--   • Distribute richness on rfi_distributions (per-row role, due-by,
--     to/cc/bcc, attachment selection)
--
-- ZERO behavior change. Every column nullable; existing INSERT/UPDATE
-- sites keep working untouched. The next 3 PRs add the UI that fills
-- these columns and the read paths that surface them.

-- ── 1. Tier S4 backfill on rfis ───────────────────────────────────────────
ALTER TABLE public.rfis
  ADD COLUMN IF NOT EXISTS responsible_contractor_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS cost_code TEXT,
  ADD COLUMN IF NOT EXISTS location_id UUID,
  ADD COLUMN IF NOT EXISTS rfi_stage TEXT,
  ADD COLUMN IF NOT EXISTS received_from_user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.rfis.responsible_contractor_id IS
  'Procore parity (S4) — the sub/contractor whose scope the RFI lives in. '
  'Distinct from assigned_to (the user who owes the answer); RC is the '
  'organizational owner. Drives reports + responsibility filters.';

COMMENT ON COLUMN public.rfis.cost_code IS
  'Procore parity (S4) — free text for now (e.g. "03-30-00"). When the '
  'budget module emits a canonical cost-code dictionary, callers can pin '
  'this against budget_line_items.code.';

COMMENT ON COLUMN public.rfis.location_id IS
  'Procore parity (S4) — building/floor/area pointer. FK constraint added '
  'when the locations module lands; today the column is free-form UUID for '
  'forward compat (typeahead writes plain UUIDs from project_directory or '
  'similar — invalid values are tolerated until the FK is enforced).';

COMMENT ON COLUMN public.rfis.rfi_stage IS
  'Procore parity (S4) — admin-defined stage label (e.g. Bidding, '
  'Construction, Closeout). The list is project_rfi_settings-driven; the '
  'column stays plain text so admins can edit without enum migrations.';

COMMENT ON COLUMN public.rfis.received_from_user_id IS
  'Procore parity (S4) — the originating party (RFI received from a sub, '
  'logged centrally). Distinct from created_by (the SiteSync user who '
  'typed the row in).';

-- ── 2. Close-action richness on rfis ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.rfi_close_disposition AS ENUM (
    'approved',
    'approved_as_noted',
    'revise_and_resubmit',
    'returned_for_clarification',
    'no_comment',
    'forwarded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE public.rfi_close_disposition IS
  'Procore parity — the architect/engineer''s decision when the RFI is '
  'closed. The 6 enum values mirror Procore''s disposition list 1:1.';

ALTER TABLE public.rfis
  ADD COLUMN IF NOT EXISTS closed_disposition public.rfi_close_disposition,
  ADD COLUMN IF NOT EXISTS closed_summary TEXT,
  ADD COLUMN IF NOT EXISTS final_response_id UUID REFERENCES public.rfi_responses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_actual_days INT,
  ADD COLUMN IF NOT EXISTS cost_actual_cents BIGINT,
  ADD COLUMN IF NOT EXISTS closed_signoff_user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.rfis.closed_disposition IS
  'The architect/engineer''s decision label captured at close time.';

COMMENT ON COLUMN public.rfis.closed_summary IS
  'Free-text narrative captured by the closer — the audit-chain story for '
  'legal review. RFICloseDialog enforces a 20-char minimum; column stays '
  'TEXT for forward compat.';

COMMENT ON COLUMN public.rfis.final_response_id IS
  'Pointer to the rfi_responses row that is the official answer. Set at '
  'close time. ON DELETE SET NULL so a deleted response orphans the link '
  'rather than blocking deletion.';

COMMENT ON COLUMN public.rfis.schedule_actual_days IS
  'Captured at close — the actual days of schedule impact (vs the '
  'estimate captured in schedule_impact_days at create/edit). Only filled '
  'when schedule_impact_status = ''yes''.';

COMMENT ON COLUMN public.rfis.cost_actual_cents IS
  'Captured at close — the actual cost impact in cents (vs the estimate '
  'in cost_impact_cents). Cents to match the project-wide money_cents '
  'invariant. Only filled when cost_impact_status = ''yes''.';

COMMENT ON COLUMN public.rfis.closed_signoff_user_id IS
  'The user_id that signed off the close. Auto-fills to the closer; an '
  'admin can override (e.g. to attribute the close to the PM whose '
  'authority backs the disposition).';

-- ── 3. Distribute richness on rfi_distributions ───────────────────────────
DO $$ BEGIN
  CREATE TYPE public.rfi_distribution_kind AS ENUM ('to', 'cc', 'bcc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE public.rfi_distribution_kind IS
  'Email semantic — to (primary), cc (visible carbon), bcc (hidden '
  'carbon). Default ''to''; existing rows backfill via column DEFAULT.';

ALTER TABLE public.rfi_distributions
  ADD COLUMN IF NOT EXISTS recipient_role public.rfi_notification_recipient_role,
  ADD COLUMN IF NOT EXISTS needs_response_by DATE,
  ADD COLUMN IF NOT EXISTS distribution_kind public.rfi_distribution_kind NOT NULL DEFAULT 'to',
  ADD COLUMN IF NOT EXISTS attachment_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.rfi_distributions.recipient_role IS
  'Per-recipient role chip (architect, mep_engineer, structural_engineer, '
  'gc_pm, sub_pm). Drives audit-pack labelling + project_rfi_settings '
  'default-distribution rehydration.';

COMMENT ON COLUMN public.rfi_distributions.needs_response_by IS
  'Per-recipient override of the RFI''s due_date. NULL means "uses the RFI '
  'due_date." Set when one recipient needs an answer earlier (e.g. the '
  'architect needs it 5 days before drawing issuance).';

COMMENT ON COLUMN public.rfi_distributions.distribution_kind IS
  'Email semantic. ''to'' = primary recipient (responsible for response); '
  '''cc'' = visible cc; ''bcc'' = hidden cc (visible only in audit pack).';

COMMENT ON COLUMN public.rfi_distributions.attachment_ids IS
  'Selection of rfi_attachments.id values that were sent with this '
  'distribution. Empty array = no attachments. Per-distribution rather '
  'than per-RFI so we can audit which recipient got which attachments.';

-- ── 4. Verification (raises if anything missing) ──────────────────────────
DO $$
DECLARE
  missing_count INT := 0;
BEGIN
  -- rfis Tier S4 columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='responsible_contractor_id') THEN
    RAISE EXCEPTION 'rfis.responsible_contractor_id missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='cost_code') THEN
    RAISE EXCEPTION 'rfis.cost_code missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='location_id') THEN
    RAISE EXCEPTION 'rfis.location_id missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='rfi_stage') THEN
    RAISE EXCEPTION 'rfis.rfi_stage missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='received_from_user_id') THEN
    RAISE EXCEPTION 'rfis.received_from_user_id missing';
  END IF;

  -- rfi_close_disposition enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='rfi_close_disposition') THEN
    RAISE EXCEPTION 'rfi_close_disposition enum missing';
  END IF;

  -- rfis close-action columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='closed_disposition') THEN
    RAISE EXCEPTION 'rfis.closed_disposition missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='final_response_id') THEN
    RAISE EXCEPTION 'rfis.final_response_id missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='schedule_actual_days') THEN
    RAISE EXCEPTION 'rfis.schedule_actual_days missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='cost_actual_cents') THEN
    RAISE EXCEPTION 'rfis.cost_actual_cents missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfis'
                 AND column_name='closed_signoff_user_id') THEN
    RAISE EXCEPTION 'rfis.closed_signoff_user_id missing';
  END IF;

  -- rfi_distribution_kind enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='rfi_distribution_kind') THEN
    RAISE EXCEPTION 'rfi_distribution_kind enum missing';
  END IF;

  -- rfi_distributions columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfi_distributions'
                 AND column_name='recipient_role') THEN
    RAISE EXCEPTION 'rfi_distributions.recipient_role missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfi_distributions'
                 AND column_name='needs_response_by') THEN
    RAISE EXCEPTION 'rfi_distributions.needs_response_by missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfi_distributions'
                 AND column_name='distribution_kind') THEN
    RAISE EXCEPTION 'rfi_distributions.distribution_kind missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='rfi_distributions'
                 AND column_name='attachment_ids') THEN
    RAISE EXCEPTION 'rfi_distributions.attachment_ids missing';
  END IF;

  RAISE NOTICE 'rfi_information_density: all columns + enums verified';
END $$;
