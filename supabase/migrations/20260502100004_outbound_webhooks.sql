-- ═══════════════════════════════════════════════════════════════
-- Migration: outbound_webhooks + webhook_deliveries
-- Version: 20260502100004
--
-- Purpose: every entity state change can fan out to org-defined
-- webhook subscriptions. The data-engineering team builds dashboards
-- in Snowflake / PowerBI / etc. from this stream.
--
-- Subscription has a filter (event types + entity types + status
-- transitions). Delivery is HMAC-signed with a per-subscription
-- secret. Failures are retried with exponential backoff for 7 days
-- (see webhook-dispatch edge fn).
--
-- Compat note: an earlier migration (00022_integration_framework.sql)
-- created a `webhook_deliveries` table FK'd to a separate `webhooks`
-- table. We extend that table additively here so both the legacy
-- inbound flow and the new outbound dispatcher can write to it. The
-- legacy FK on webhook_id → webhooks is dropped because the new code
-- inserts ids that reference outbound_webhooks; the column is left as
-- a plain uuid and integrity is enforced by the writers.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  url             text NOT NULL CHECK (url ~ '^https://'),
  -- HMAC signing secret. Stored hashed (we only need to sign, not
  -- compare against a presented value, but we keep the original in
  -- a Supabase Vault secret keyed by id; this column has the SHA-256
  -- for at-rest hardening).
  secret_hint     text NOT NULL,
  -- Event types this subscription cares about. Supported values:
  --   'rfi.created' 'rfi.status_changed' 'rfi.answered' 'rfi.closed'
  --   'submittal.*' 'change_order.*' 'punch.*' 'daily_log.submitted' …
  --   '*' = all events
  event_types     text[] NOT NULL DEFAULT ARRAY['*']::text[],
  -- Project scope. NULL = all projects.
  project_ids     uuid[],
  -- Status transition filter. JSON object: { "from": ["open"], "to":
  -- ["answered"] }. Empty {} = no filter.
  status_filter   jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Pause toggle. The dispatcher skips paused subscriptions but
  -- continues to enqueue them so when the receiver comes back online
  -- the admin can replay.
  paused          boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  -- Delivery health: bumped by the dispatcher.
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_org
  ON outbound_webhooks (organization_id, active);

-- Idempotent base — only fires on a brand-new DB; on existing DBs the prior
-- migration (00022_integration_framework.sql) already created this table.
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      uuid NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Drop the legacy FK if it's there — webhook_id now holds ids from either
-- `webhooks` (legacy) or `outbound_webhooks` (new).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'webhook_deliveries_webhook_id_fkey'
       AND conrelid = 'public.webhook_deliveries'::regclass
  ) THEN
    ALTER TABLE webhook_deliveries DROP CONSTRAINT webhook_deliveries_webhook_id_fkey;
  END IF;
END $$;

-- Additive new columns for the outbound dispatcher.
-- (The legacy table uses `delivered_at`; the new dispatcher uses `created_at`.
--  We add created_at and backfill from delivered_at where it exists.)
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS organization_id      uuid,
  ADD COLUMN IF NOT EXISTS event_type           text,
  ADD COLUMN IF NOT EXISTS status               text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempt_count        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_response_status int,
  ADD COLUMN IF NOT EXISTS last_response_body   text,
  ADD COLUMN IF NOT EXISTS last_attempt_at      timestamptz,
  ADD COLUMN IF NOT EXISTS succeeded_at         timestamptz,
  ADD COLUMN IF NOT EXISTS created_at           timestamptz NOT NULL DEFAULT now();

-- Backfill created_at from legacy delivered_at where it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'webhook_deliveries'
       AND column_name = 'delivered_at'
  ) THEN
    EXECUTE 'UPDATE webhook_deliveries SET created_at = delivered_at WHERE delivered_at IS NOT NULL';
  END IF;
END $$;

-- Status check (added by name so it's idempotent across re-applies).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'webhook_deliveries_status_chk'
       AND conrelid = 'public.webhook_deliveries'::regclass
  ) THEN
    ALTER TABLE webhook_deliveries
      ADD CONSTRAINT webhook_deliveries_status_chk
      CHECK (status IN ('pending','succeeded','failed','dead_letter'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
  ON webhook_deliveries (status, next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
  ON webhook_deliveries (webhook_id, created_at DESC);

ALTER TABLE outbound_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outbound_webhooks_admin_rw') THEN
    CREATE POLICY outbound_webhooks_admin_rw ON outbound_webhooks
      FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
      WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'webhook_deliveries_admin_read') THEN
    CREATE POLICY webhook_deliveries_admin_read ON webhook_deliveries
      FOR SELECT
      USING (organization_id IS NULL OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
END $$;
