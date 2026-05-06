-- ═══════════════════════════════════════════════════════════════
-- Migration: presence_room_keys
-- Version: 20260503100000
--
-- Purpose: stable per-entity room ids for live presence + cursors. The
-- entity detail pages and list pages broadcast on a Supabase Realtime
-- channel keyed by `room_key`; clients subscribe by computing the
-- room_key locally (entity_type:entity_id) but the table is the
-- canonical record so admin tooling can list active rooms.
--
-- We separately track "active heartbeats" via a presence_heartbeats
-- table — rows here just describe the room itself (org scope, max
-- concurrency cap, etc.), while the heartbeats table is the
-- ephemeral live state.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS presence_room_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  -- Stable identifier the client computes: '<entity_type>:<entity_id>' or
  -- '<entity_type>:list:<filter_hash>' for list pages.
  room_key        text NOT NULL,
  -- Display label for the admin "active rooms" list.
  label           text,
  -- Free-form metadata (rendering hints, sticky room flags, etc.).
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, room_key)
);

CREATE INDEX IF NOT EXISTS idx_presence_room_keys_org_recent
  ON presence_room_keys (organization_id, last_seen_at DESC);

-- Per-user heartbeats. Same shape as the Tab A typing_indicators table
-- but org-scoped; consider unifying later. For now, separate so a typing
-- heartbeat doesn't keep a user's overall presence "alive" forever.
CREATE TABLE IF NOT EXISTS presence_heartbeats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_key        text NOT NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name       text NOT NULL,
  -- Device identifier so the same user across devices is dedup-able
  -- (most-recently-active device wins for the cursor render).
  device_id       text NOT NULL,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  -- Optional cursor coords, JSON: { x: 0..1, y: 0..1, field?: "title" }.
  cursor_state    jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_presence_heartbeats_room_user_device
  ON presence_heartbeats (organization_id, room_key, user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_presence_heartbeats_room_recent
  ON presence_heartbeats (organization_id, room_key, last_seen_at DESC);

ALTER TABLE presence_room_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence_heartbeats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'presence_room_keys_org_access') THEN
    CREATE POLICY presence_room_keys_org_access ON presence_room_keys
      FOR ALL
      USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'presence_heartbeats_org_access') THEN
    CREATE POLICY presence_heartbeats_org_access ON presence_heartbeats
      FOR ALL
      USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- GC schedule (admin-apply): drop heartbeats older than 60s every minute.
--   SELECT cron.schedule(
--     'gc-presence-heartbeats',
--     '* * * * *',
--     $$ DELETE FROM presence_heartbeats WHERE last_seen_at < now() - interval '60 seconds' $$
--   );
