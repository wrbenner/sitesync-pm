-- =============================================================================
-- crew_checkins.dispute_status — auto-flag check-ins that fail the geofence
-- =============================================================================
-- Replaces the simpler disputed_at boolean flow with an explicit status:
--   'none'         no dispute
--   'auto_flagged' geofence said the check-in was outside the site polygon
--   'disputed'     a crew lead manually rejected
--   'resolved'     a GC superintendent reviewed and approved despite the flag
--
-- The auto-linker excludes auto_flagged + disputed rows from sub attribution.
-- resolved rows are attributable.
-- =============================================================================

ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS dispute_status text
  NOT NULL DEFAULT 'none'
  CHECK (dispute_status IN ('none','auto_flagged','disputed','resolved'));
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS dispute_meta jsonb;
  -- shape examples:
  --   {"reason": "outside_geofence", "distance_m": 122, "polygon_used": "Main site"}
  --   {"resolved_by": "gc-super", "resolution_note": "offsite welding shop"}

ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_crew_checkins_dispute_status
  ON crew_checkins(project_id, dispute_status)
  WHERE dispute_status <> 'none';

-- Backfill: existing disputed_at rows become dispute_status='disputed'.
UPDATE crew_checkins
   SET dispute_status = 'disputed'
 WHERE disputed_at IS NOT NULL AND dispute_status = 'none';
