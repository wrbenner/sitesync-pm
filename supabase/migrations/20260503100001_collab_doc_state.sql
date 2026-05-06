-- ═══════════════════════════════════════════════════════════════
-- Migration: collab_doc_state
-- Version: 20260503100001
--
-- Purpose: anchor table mapping our entity rows to Liveblocks document
-- room ids. CollabTextarea reads `liveblocks_room_id` from this table
-- to know which Liveblocks room to subscribe to.
--
-- Why a separate table instead of stuffing the room_id onto each entity:
--   • The Liveblocks room is shared across multiple text fields on the
--     same entity (RFI title + description + responses); one room_id
--     per (entity_type, entity_id, field) lets each field have its own
--     CRDT context.
--   • If we ever migrate off Liveblocks (Yjs over Supabase Realtime is
--     a credible fallback), we can rewrite the field mapping without
--     touching the entity tables.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS collab_doc_state (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id         uuid REFERENCES projects(id) ON DELETE CASCADE,
  entity_type        text NOT NULL,
  entity_id          uuid NOT NULL,
  -- The text field this room is bound to (e.g. 'description', 'response').
  -- Combined with the entity ref, this is the unique key.
  field              text NOT NULL,
  -- Liveblocks room id we generate at first edit. Format:
  --   <project_slug>-<entity_type>-<entity_id_short>-<field>
  liveblocks_room_id text NOT NULL,
  -- The most recent server-confirmed text snapshot. Used for offline-first
  -- merges (the Liveblocks state is authoritative when both are live).
  text_snapshot      text,
  last_synced_at     timestamptz,
  -- Schema version for the snapshot (in case we change serialization).
  snapshot_version   int NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field)
);

CREATE INDEX IF NOT EXISTS idx_collab_doc_state_room
  ON collab_doc_state (liveblocks_room_id);
CREATE INDEX IF NOT EXISTS idx_collab_doc_state_org
  ON collab_doc_state (organization_id, updated_at DESC);

ALTER TABLE collab_doc_state ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'collab_doc_state_org_access') THEN
    CREATE POLICY collab_doc_state_org_access ON collab_doc_state
      FOR ALL
      USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;
