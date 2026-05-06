-- ─────────────────────────────────────────────────────────────────────────────
-- iris_grounding_cache — demo safety net for the "Ground in the world" moment
-- ─────────────────────────────────────────────────────────────────────────────
-- Caches the merged three-lane (Claude / Perplexity / GPT-4o) grounding response
-- per (entity_type, entity_id) so a quota burst, 429, or network blip during the
-- investor demo never shows an empty drawer. Cache hits return in <50ms; the
-- edge function falls through to fixtures only if the cache is cold AND every
-- live provider misses.
--
-- TTL is 24h, enforced in the edge function (`iris-ground/index.ts`) — keeping
-- it out of the table avoids a cron and keeps the schema trivially auditable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS iris_grounding_cache (
  entity_type   text        NOT NULL,
  entity_id     uuid        NOT NULL,
  response      jsonb       NOT NULL,
  fingerprint   text        NOT NULL,           -- hash of (subject + question + spec) — invalidates on edit
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS iris_grounding_cache_created_at_idx
  ON iris_grounding_cache (created_at DESC);

CREATE INDEX IF NOT EXISTS iris_grounding_cache_fingerprint_idx
  ON iris_grounding_cache (fingerprint);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Project-scoped read: a user can read a cache row if they can read the entity.
-- Writes happen exclusively from the service-role inside the edge function, so
-- no INSERT/UPDATE policies are exposed to authenticated users.

ALTER TABLE iris_grounding_cache ENABLE ROW LEVEL SECURITY;

-- Read policy: derive project from entity_type + entity_id and check membership.
-- Today only `rfi` is supported. Extend the CASE as new entity types ground.
CREATE POLICY iris_grounding_cache_select ON iris_grounding_cache
  FOR SELECT
  TO authenticated
  USING (
    CASE entity_type
      WHEN 'rfi' THEN
        EXISTS (
          SELECT 1
          FROM rfis r
          WHERE r.id = iris_grounding_cache.entity_id
            AND has_project_permission(r.project_id, 'viewer')
        )
      WHEN 'submittal' THEN
        EXISTS (
          SELECT 1
          FROM submittals s
          WHERE s.id = iris_grounding_cache.entity_id
            AND has_project_permission(s.project_id, 'viewer')
        )
      ELSE false
    END
  );

-- Service-role bypasses RLS; authenticated users cannot write.
COMMENT ON TABLE  iris_grounding_cache IS
  'Per-entity cache of three-lane Iris grounding responses. 24h TTL enforced in edge function.';
COMMENT ON COLUMN iris_grounding_cache.fingerprint IS
  'Stable hash of subject+question+spec. Invalidates the row on entity edit.';
