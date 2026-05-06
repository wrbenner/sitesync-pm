-- =============================================================================
-- site_geofence — multi-region polygon for crew check-in dispute flagging
-- =============================================================================
-- Stored as JSONB instead of PostGIS geometry because PostGIS isn't installed
-- on this DB and adding it for one feature isn't worth the cluster cost.
-- Point-in-polygon math runs in JS (src/lib/checkIn/geofence.ts) which is
-- entirely sufficient for the polygon counts we're talking about (a single
-- project rarely has >5 regions; checking ~10 segments is sub-microsecond).
--
-- Shape:
-- {
--   "regions": [
--     { "name": "Main site", "polygon": [{lat, lng}, ...closed loop] },
--     { "name": "Offsite welding shop", "polygon": [...] }
--   ],
--   "tolerance_m": 50
-- }
-- =============================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_geofence jsonb;
COMMENT ON COLUMN projects.site_geofence IS
  'JSONB polygon set used to flag check-ins outside the project. Shape: {regions: [{name, polygon: [{lat, lng}, ...]}], tolerance_m}';

-- =============================================================================
-- entity_audit_chain — per-project, per-entity SHA-256 hash chain
-- =============================================================================
-- Distinct from `audit_chain_checkpoints` (introduced in
-- 20260426000001_audit_log_hash_chain.sql), which is a single-row high-water
-- mark used by the verify-audit-chain edge function. This table stores the
-- actual chain links for signed entities (daily logs, RFIs, etc.).
--
-- Each signed entity append a row with:
--   prev_hash:    the hash of the prior link for this project (or 0x00... at chain start)
--   payload_hash: SHA-256 of (entity_type || entity_id || content || created_at || actor_id)
--   chain_hash:   SHA-256 of (prev_hash || payload_hash) — this is the link
--
-- Verification: walk the chain, recompute each chain_hash, compare. Tampering
-- with any historical row breaks every subsequent chain_hash.
-- =============================================================================

CREATE TABLE IF NOT EXISTS entity_audit_chain (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  prev_hash       text NOT NULL,
  payload_hash    text NOT NULL,
  chain_hash      text NOT NULL,
  signed_by       uuid REFERENCES auth.users(id),
  signed_at       timestamptz NOT NULL DEFAULT now(),
  sequence        bigserial NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_audit_chain_project_seq
  ON entity_audit_chain(project_id, sequence DESC);
CREATE INDEX IF NOT EXISTS idx_entity_audit_chain_entity
  ON entity_audit_chain(entity_type, entity_id);

ALTER TABLE entity_audit_chain ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY entity_audit_chain_member_select ON entity_audit_chain
    FOR SELECT USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Inserts only — chain rows are immutable.
DO $$ BEGIN
  CREATE POLICY entity_audit_chain_member_insert ON entity_audit_chain
    FOR INSERT WITH CHECK (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
