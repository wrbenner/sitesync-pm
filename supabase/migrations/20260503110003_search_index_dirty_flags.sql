-- =============================================================================
-- search_index_dirty_flags — incremental reindex tracking
-- =============================================================================
-- The org_search_index view is computed at query time (no underlying
-- materialized table — this keeps it always-fresh on a small org). For
-- large orgs we'll switch to a materialized table; this dirty-flag
-- infrastructure lets the switch be incremental rather than full-rebuild
-- on every entity touch.
--
-- A trigger on every searchable entity flips `dirty=true`; the nightly
-- reindex job processes the dirty rows in batches and clears the flag.
-- =============================================================================

CREATE TABLE IF NOT EXISTS search_index_dirty_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  dirty         boolean NOT NULL DEFAULT true,
  marked_at     timestamptz NOT NULL DEFAULT now(),
  reindexed_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_search_dirty_entity
  ON search_index_dirty_flags(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_search_dirty_active
  ON search_index_dirty_flags(marked_at)
  WHERE dirty = true;

-- Generic trigger function — used by per-entity triggers below.
CREATE OR REPLACE FUNCTION fn_mark_search_dirty()
RETURNS trigger AS $$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_org_id uuid;
BEGIN
  -- Resolve organization_id via the project link (every searchable
  -- entity carries project_id today).
  SELECT pr.organization_id INTO v_org_id
    FROM projects pr WHERE pr.id = COALESCE(
      (CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW)->>'project_id' END),
      (CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)->>'project_id' END)
    )::uuid;

  INSERT INTO search_index_dirty_flags
    (entity_type, entity_id, project_id, organization_id, dirty, marked_at)
  VALUES (
    v_entity_type,
    COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid),
    COALESCE((to_jsonb(NEW)->>'project_id')::uuid, (to_jsonb(OLD)->>'project_id')::uuid),
    v_org_id,
    true,
    now()
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET dirty = true,
        marked_at = now(),
        reindexed_at = NULL;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Wire to the searchable entities. Triggers fire per row.
DROP TRIGGER IF EXISTS trg_mark_dirty_rfis ON rfis;
CREATE TRIGGER trg_mark_dirty_rfis
  AFTER INSERT OR UPDATE OR DELETE ON rfis
  FOR EACH ROW EXECUTE FUNCTION fn_mark_search_dirty('rfi');

DROP TRIGGER IF EXISTS trg_mark_dirty_submittals ON submittals;
CREATE TRIGGER trg_mark_dirty_submittals
  AFTER INSERT OR UPDATE OR DELETE ON submittals
  FOR EACH ROW EXECUTE FUNCTION fn_mark_search_dirty('submittal');

DROP TRIGGER IF EXISTS trg_mark_dirty_change_orders ON change_orders;
CREATE TRIGGER trg_mark_dirty_change_orders
  AFTER INSERT OR UPDATE OR DELETE ON change_orders
  FOR EACH ROW EXECUTE FUNCTION fn_mark_search_dirty('change_order');

DROP TRIGGER IF EXISTS trg_mark_dirty_punch_items ON punch_items;
CREATE TRIGGER trg_mark_dirty_punch_items
  AFTER INSERT OR UPDATE OR DELETE ON punch_items
  FOR EACH ROW EXECUTE FUNCTION fn_mark_search_dirty('punch_item');

DROP TRIGGER IF EXISTS trg_mark_dirty_meetings ON meetings;
CREATE TRIGGER trg_mark_dirty_meetings
  AFTER INSERT OR UPDATE OR DELETE ON meetings
  FOR EACH ROW EXECUTE FUNCTION fn_mark_search_dirty('meeting');

DROP TRIGGER IF EXISTS trg_mark_dirty_daily_logs ON daily_logs;
CREATE TRIGGER trg_mark_dirty_daily_logs
  AFTER INSERT OR UPDATE OR DELETE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION fn_mark_search_dirty('daily_log');

DROP TRIGGER IF EXISTS trg_mark_dirty_drawings ON drawings;
CREATE TRIGGER trg_mark_dirty_drawings
  AFTER INSERT OR UPDATE OR DELETE ON drawings
  FOR EACH ROW EXECUTE FUNCTION fn_mark_search_dirty('drawing');
