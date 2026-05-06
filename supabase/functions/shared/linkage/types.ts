// DO NOT EDIT IN PLACE — duplicated from src/lib/linkage/types.ts
// Edge functions run under Deno and cannot import from src/. When the
// canonical lib changes, copy the file here and rerun the linker tests.

// =============================================================================
// Linkage Engine — shared types
// =============================================================================
// Kept in one file so the resolvers, the orchestrator, and the visualizer agree
// on the shape of an edge without circular imports. None of these types depend
// on Supabase row shapes — that's by design. The persistence layer (photoLinker
// .writeLinks) translates EntityLink rows into media_links row inserts.
// =============================================================================

export type MediaType = 'photo_pin' | 'field_capture'

export type EntityType =
  | 'drawing'
  | 'crew'
  | 'daily_log'
  | 'punch_item'
  | 'rfi'
  | 'submittal'
  | 'change_order'

export type Confidence = 'high' | 'medium' | 'low'

export type LinkSource = 'auto' | 'manual'

export type GpsStatus = 'good' | 'low_confidence' | 'unavailable'

export interface MediaInput {
  /** photo_pins.id or field_captures.id */
  mediaId: string
  mediaType: MediaType
  projectId: string
  /** ISO timestamp the photo was actually captured */
  takenAt: string
  /** WGS84 lat/lng. May be missing/zero when gpsStatus='unavailable'. */
  lat?: number | null
  lng?: number | null
  gpsAccuracyMeters?: number | null
  /** Pre-classified at upload time. The linker also re-derives from accuracy. */
  gpsStatus?: GpsStatus
  /** Optional spec section nudge — used as a tie-breaker for sub attribution. */
  specSection?: string | null
}

export interface EntityLink {
  entityType: EntityType
  entityId: string
  confidence: Confidence
  source: LinkSource
  /** Drawing-relative pin coordinates in [0..1]. Only set for entityType='drawing'. */
  pinX?: number | null
  pinY?: number | null
  /** Human-readable why we picked this; surfaces in the audit log. */
  notes?: string
}
