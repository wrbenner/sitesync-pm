-- =============================================================================
-- Phase 5 — Unified Create + Spec Importer LIVE
--
-- Spec: docs/audits/SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md Part 3.2 §7d
--       (submittal_emails) + Part 6.3 (drawing pin engine reuse).
--
-- 1. submittal_emails — email-in / email-out audit table. Phase 5 wires the
--    UI consumer (Email-in entry handler + Emails tab on Detail). Phase 9
--    wires the actual edge function `submittal-email-in/index.ts` to receive
--    SES/Resend webhooks; this migration just defines the persistence layer.
-- 2. submittal_drawing_pins — spatial linkage between a submittal and a
--    drawing pin. Reuses the same shape as the RFI pin engine (sheet_id +
--    page_no + bbox_pct). Phase 5 wires the create-from-pin entry method;
--    Phase 8 wires the auto-pin-on-distribute action.
--
-- ADDITIVE only. Idempotent re-apply via IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ── 1. submittal_emails ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.submittal_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id    uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('in', 'out')),
  message_id      text NOT NULL,
  thread_id       text,
  subject         text,
  from_addr       text,
  to_addrs        text[] NOT NULL DEFAULT '{}'::text[],
  cc_addrs        text[] NOT NULL DEFAULT '{}'::text[],
  body_html       text,
  body_text       text,
  attachments     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Iris extracts a 1-line "what changed vs the prior email in this thread"
  -- summary; populated by the email-in worker (Phase 9).
  iris_diff_text  text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Inbound message_id is the canonical dedupe key.
  UNIQUE (message_id)
);

-- Schema-version-tolerant: when an older submittal_emails was created by
-- the canonical migration (which omitted thread_id / iris_diff_text /
-- created_at), add those columns now so the indexes below succeed.
ALTER TABLE public.submittal_emails
  ADD COLUMN IF NOT EXISTS thread_id      text,
  ADD COLUMN IF NOT EXISTS iris_diff_text text,
  ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_submittal_emails_submittal
  ON public.submittal_emails (submittal_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_submittal_emails_thread
  ON public.submittal_emails (thread_id)
  WHERE thread_id IS NOT NULL;

ALTER TABLE public.submittal_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS submittal_emails_project_member ON public.submittal_emails;
CREATE POLICY submittal_emails_project_member ON public.submittal_emails
  FOR SELECT
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
       JOIN public.project_members pm ON pm.project_id = s.project_id
       WHERE pm.user_id = auth.uid()
    )
  );

-- Inserts go through the service-role edge function only (Phase 9). No
-- client-side INSERT / UPDATE / DELETE policies — the SECURITY DEFINER
-- ingestion path is the only writer.

COMMENT ON TABLE public.submittal_emails IS
  'Email-in / email-out audit per submittal. Service-role write via the '
  'submittal-email-in edge function (Phase 9). Authenticated read for '
  'project members.';

-- ── 2. submittal_drawing_pins ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.submittal_drawing_pins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id  uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  -- Sheet + page reference. Soft FK to drawings.sheets via sheet_id when
  -- present; sheet_number / sheet_title denormalised so a deleted sheet
  -- still renders the pin's label.
  sheet_id      uuid,
  sheet_number  text,
  sheet_title   text,
  page_no       int  NOT NULL DEFAULT 1,
  -- Pin location as percentage-of-page coordinates (0..100, top-left origin).
  -- bbox_pct is the optional highlight rectangle for area-pins; null for
  -- single-point pins (most common).
  x_pct         numeric NOT NULL,
  y_pct         numeric NOT NULL,
  bbox_pct      jsonb,
  -- Free-form note rendered in the pin's hover tooltip.
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  CONSTRAINT submittal_drawing_pins_xy_range
    CHECK (x_pct >= 0 AND x_pct <= 100 AND y_pct >= 0 AND y_pct <= 100)
);

CREATE INDEX IF NOT EXISTS idx_submittal_drawing_pins_submittal
  ON public.submittal_drawing_pins (submittal_id);

CREATE INDEX IF NOT EXISTS idx_submittal_drawing_pins_sheet
  ON public.submittal_drawing_pins (sheet_id, page_no)
  WHERE sheet_id IS NOT NULL;

ALTER TABLE public.submittal_drawing_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS submittal_drawing_pins_project_member ON public.submittal_drawing_pins;
CREATE POLICY submittal_drawing_pins_project_member ON public.submittal_drawing_pins
  FOR ALL
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
       JOIN public.project_members pm ON pm.project_id = s.project_id
       WHERE pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
       JOIN public.project_members pm ON pm.project_id = s.project_id
       WHERE pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.submittal_drawing_pins IS
  'Spatial linkage between submittals and drawing sheets. Reuses the '
  'percentage-of-page coordinate convention from the RFI pin engine. '
  'Project-member RLS for SELECT/INSERT/UPDATE/DELETE.';

-- =============================================================================
-- End of Phase 5 emails + drawing pins migration.
-- =============================================================================
