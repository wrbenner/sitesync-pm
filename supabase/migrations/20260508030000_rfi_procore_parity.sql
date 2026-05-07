-- =============================================================================
-- RFI Procore-parity wave — schema additions
--
-- Drives:    docs/audits/RFI_FINAL_GAP_AUDIT_2026-05-07.md
--            ~/.claude/plans/rfi-page-and-rfi-purrfect-cake.md (Track A12, D4)
--
-- Scope: three column additions on `rfis` to wrap existing fields with the
-- enum semantics Procore uses (Yes/No/TBD for impact, reopen reason
-- categorisation). All ADDITIVE; nullable; no backfill required.
--
-- Note: question_html intentionally NOT added — RFIRichTextEditor already
-- writes HTML to the existing `question TEXT` column (verified 2026-05-08).
-- The detail-page render swap (pre-wrap → sanitised HTML) is a UI-only fix.
-- =============================================================================

-- Reopen-with-reason picker (plan A12)
ALTER TABLE public.rfis
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rfis' AND column_name='reopen_category'
  ) THEN
    ALTER TABLE public.rfis
      ADD COLUMN reopen_category TEXT
      CHECK (reopen_category IN ('new_information','incorrect_answer','change_in_scope','other'));
  END IF;
END $$;

-- Cost impact status wrapper (plan D4)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rfis' AND column_name='cost_impact_status'
  ) THEN
    ALTER TABLE public.rfis
      ADD COLUMN cost_impact_status TEXT
      CHECK (cost_impact_status IN ('yes','no','tbd'));
  END IF;
END $$;

-- Schedule impact status wrapper (parallel to cost)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rfis' AND column_name='schedule_impact_status'
  ) THEN
    ALTER TABLE public.rfis
      ADD COLUMN schedule_impact_status TEXT
      CHECK (schedule_impact_status IN ('yes','no','tbd'));
  END IF;
END $$;

COMMENT ON COLUMN public.rfis.reopen_category IS
  'Captured at Reopen action via RFIReopenDialog (plan track A12). One of: '
  'new_information, incorrect_answer, change_in_scope, other.';
COMMENT ON COLUMN public.rfis.cost_impact_status IS
  'Procore-style Yes/No/TBD wrapper for cost_impact_cents (plan track D4). '
  'cost_impact_cents stays nullable: status=yes implies a $ value, status=no '
  'implies zero, status=tbd implies pending estimate.';
COMMENT ON COLUMN public.rfis.schedule_impact_status IS
  'Procore-style Yes/No/TBD wrapper for schedule_days_impact (plan track D4 '
  'parallel). schedule_days_impact stays nullable on tbd/no.';
