-- =============================================================================
-- Linkage Engine — media_links + crew_checkins + photo gps fields
-- =============================================================================
-- Tab B foundation: a tired super takes a photo, the system links it to drawing,
-- sub on site, daily log, and nearby punch items automatically. Six months later
-- when insurance asks who installed the flashing, the chain is already there.
--
-- This migration sets up the prerequisites + the headline media_links table.
-- A second migration (drawing_scopes) layers on the area→sub mapping for
-- punch-item auto-assignment.
-- =============================================================================

-- 1. Photo GPS confidence fields ---------------------------------------------
-- gps_status:        'good' | 'low_confidence' | 'unavailable'
--   - good           accuracy <= 20 m, used freely
--   - low_confidence accuracy > 20 m, used but flagged in the visualizer
--   - unavailable    no GPS at capture (basement, signal jam) — manual pin only
-- gps_accuracy_m:    raw accuracy in meters from the device
-- The existing location_x/y/z columns continue to hold the captured coords
-- (or 0/0/0 when unavailable). photo_360_url etc. unchanged.

ALTER TABLE photo_pins ADD COLUMN IF NOT EXISTS gps_status text
  CHECK (gps_status IN ('good','low_confidence','unavailable'));
ALTER TABLE photo_pins ADD COLUMN IF NOT EXISTS gps_accuracy_m numeric;

CREATE INDEX IF NOT EXISTS idx_photo_pins_gps_status
  ON photo_pins(project_id, gps_status)
  WHERE gps_status IS NOT NULL;

-- 2. crew_checkins -----------------------------------------------------------
-- Rolling record of which crew was on site between checked_in_at and checked_out_at.
-- Sub attribution leans on this: photo at T → crew with checked_in_at <= T <= COALESCE(checked_out_at, now()).
--
-- The crew_checkins table was originally created in 20260424000002 as a
-- lightweight QR-scan log (user_id text, location_id text, checked_in_at).
-- Here we extend it additively with the linkage-engine fields needed for sub
-- attribution: a crew_id FK, GPS coords, who recorded the checkin, and dispute
-- soft-flags. Existing QR-scan rows pre-date crews and leave crew_id NULL —
-- the auto-linker simply skips rows missing crew_id.
--
-- disputed_at / disputed_reason: when a crew lead rejects a check-in their GC
-- super created (mis-checkin), we soft-flag the row so the auto-linker won't
-- use it for legal-grade attribution. We never delete (audit trail).

ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE CASCADE;
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS geo_lat double precision;
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS geo_lng double precision;
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS geo_accuracy_m numeric;
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES auth.users(id);
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS disputed_at timestamptz;
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS disputed_reason text;
ALTER TABLE crew_checkins ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_crew_checkins_project_window
  ON crew_checkins(project_id, checked_in_at, checked_out_at);
CREATE INDEX IF NOT EXISTS idx_crew_checkins_crew
  ON crew_checkins(crew_id, checked_in_at DESC)
  WHERE crew_id IS NOT NULL;
-- Partial index excluding disputed rows for the hot "find sub on site" query
CREATE INDEX IF NOT EXISTS idx_crew_checkins_undisputed
  ON crew_checkins(project_id, checked_in_at)
  WHERE disputed_at IS NULL;

-- RLS + base policies were already established in 20260424000002_crew_checkins.sql.
-- We re-assert ENABLE here defensively (no-op if already enabled) but do not
-- redefine the existing crew_checkins_select / _insert / _update / _delete policies.
ALTER TABLE crew_checkins ENABLE ROW LEVEL SECURITY;

-- 3. media_links -------------------------------------------------------------
-- Fan-out join. One row per (media → entity) edge.
--
--   media_type      'photo_pin' | 'field_capture' (extensible — drawings, files…)
--   entity_type     'drawing' | 'crew' | 'daily_log' | 'punch_item' | 'rfi' | 'submittal' | 'change_order'
--   confidence      'high' | 'medium' | 'low' — driven by gps_status + match strength
--   source          'auto' | 'manual'        — provenance for the audit log
--   pin_x, pin_y    drawing-relative coords (0..1 normalized) when entity_type = 'drawing'
--                    (null otherwise; only populated when GPS resolves to a sheet)
--   deleted_at,     soft-delete only (legal trail). The unlink handler sets these
--   deleted_reason  with a required reason; the row is never DELETEd.
--
-- Idempotency: re-running the linker for a media should produce the same edges.
-- A unique partial index on undeleted (media, entity) prevents duplicates while
-- still allowing relink after a soft-delete.

CREATE TABLE IF NOT EXISTS media_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id        uuid NOT NULL,
  media_type      text NOT NULL CHECK (media_type IN ('photo_pin','field_capture')),
  entity_id       uuid NOT NULL,
  entity_type     text NOT NULL CHECK (entity_type IN (
                    'drawing','crew','daily_log','punch_item','rfi','submittal','change_order'
                  )),
  pin_x           numeric,
  pin_y           numeric,
  confidence      text NOT NULL DEFAULT 'high'
                  CHECK (confidence IN ('high','medium','low')),
  source          text NOT NULL DEFAULT 'auto'
                  CHECK (source IN ('auto','manual')),
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_reason  text,
  deleted_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_media_links_media
  ON media_links(media_id, media_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_links_entity
  ON media_links(entity_id, entity_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_links_project
  ON media_links(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_links_audit
  ON media_links(project_id, source, confidence, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_links_active_edge
  ON media_links(media_id, media_type, entity_id, entity_type)
  WHERE deleted_at IS NULL;

ALTER TABLE media_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY media_links_member_select ON media_links
    FOR SELECT USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY media_links_member_write ON media_links
    FOR ALL USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    ) WITH CHECK (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
