-- ═══════════════════════════════════════════════════════════════
-- Migration: RFI P1c — email integration
-- Version:   20260507000010
--
-- Drives the seven P1c deliverables that wire the existing
-- inbound-email + send-email functions into the RFI surface
-- end-to-end. The infra exists; this migration adds the columns the
-- integration needs, plus a tiny webhook log to receive bounces.
--
-- Scope (DB only; UI + edge fn changes live elsewhere in the PR):
--
--   1. rfi_distributions: delivery tracking columns
--      • message_id            text  — outbound Message-ID we stamped
--      • delivery_status       enum  — sent / delivered / bounced /
--                                      complained / unknown
--      • delivery_status_at    timestamptz
--      • bounce_reason         text  — provider-supplied reason on
--                                      bounce / complaint
--
--   2. rfi_responses: provenance + email metadata
--      • source                enum  — 'web' (default) | 'email_inbound'
--                                    | 'email_inbound_iris_review'
--      • source_email          text  — sender's address when source != web
--      • inbound_message_id    text  — provider Message-ID for chain
--                                      reconstruction
--
--   3. rfi_attachments: reuse the source column to mark inbound files
--      • source                enum  — 'web' | 'email_inbound'
--
--   4. resend_webhook_events: lightweight log of every signed webhook
--      we receive (delivered / bounced / complained / opened / etc.).
--      We don't try to model every payload shape — we keep the raw
--      JSON and project the fields we use.
--
-- Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. rfi_distributions delivery tracking ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'rfi_delivery_status'
  ) THEN
    CREATE TYPE public.rfi_delivery_status AS ENUM (
      'sent',
      'delivered',
      'bounced',
      'complained',
      'unknown'
    );
  END IF;
END$$;

ALTER TABLE rfi_distributions
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status public.rfi_delivery_status NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS delivery_status_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rfi_distributions_message_id
  ON rfi_distributions(message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rfi_distributions_delivery_status
  ON rfi_distributions(delivery_status)
  WHERE delivery_status IN ('bounced', 'complained');


-- ── 2. rfi_responses provenance ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'rfi_response_source'
  ) THEN
    CREATE TYPE public.rfi_response_source AS ENUM (
      'web',
      'email_inbound',
      'email_inbound_iris_review'
    );
  END IF;
END$$;

ALTER TABLE rfi_responses
  ADD COLUMN IF NOT EXISTS source public.rfi_response_source NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS source_email TEXT,
  ADD COLUMN IF NOT EXISTS inbound_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_rfi_responses_inbound_message_id
  ON rfi_responses(inbound_message_id)
  WHERE inbound_message_id IS NOT NULL;


-- ── 3. rfi_attachments source ───────────────────────────────────
ALTER TABLE rfi_attachments
  ADD COLUMN IF NOT EXISTS source public.rfi_response_source NOT NULL DEFAULT 'web';


-- ── 4. resend_webhook_events ────────────────────────────────────
-- Receives every signed event from the Resend webhook (delivered,
-- bounced, complained, opened, etc.). Keep raw payload for forensics;
-- project the fields we use into columns for cheap lookup.
CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  message_id      TEXT,
  to_email        TEXT,
  bounce_reason   TEXT,
  -- Best-effort link to the originating distribution. Populated by the
  -- handler when the event's email_id maps to a known message_id.
  rfi_distribution_id UUID REFERENCES rfi_distributions(id) ON DELETE SET NULL,
  raw_payload     JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_message_id
  ON public.resend_webhook_events(message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_event_type
  ON public.resend_webhook_events(event_type, received_at DESC);

ALTER TABLE public.resend_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role only. End users never read raw webhook payloads; they
-- read the projected delivery_status on rfi_distributions.
DROP POLICY IF EXISTS resend_webhook_events_select_admin ON public.resend_webhook_events;
CREATE POLICY resend_webhook_events_select_admin
  ON public.resend_webhook_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE public.resend_webhook_events IS
  'Signed Resend webhook events (delivered/bounced/complained). Source of truth for rfi_distributions.delivery_status.';
