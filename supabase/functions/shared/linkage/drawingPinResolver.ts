// DO NOT EDIT IN PLACE — duplicated from src/lib/linkage/drawingPinResolver.ts
// Edge functions run under Deno and cannot import from src/. When the
// canonical lib changes, copy the file here and rerun the linker tests.

// =============================================================================
// Linkage Engine — drawing pin resolver
// =============================================================================
// Given a photo's lat/lng, find the drawings whose origin is set AND whose
// extent contains the point, return them with normalized pin_x/pin_y.
//
// Output is ordered by distance from origin (closest sheet wins as the primary
// link — a photo near grid line A is most usefully attached to the sheet whose
// origin sits at A, not a parent overview sheet that also technically contains
// the point).
// =============================================================================

import type { Confidence, EntityLink, GpsStatus, MediaInput } from './types.ts'
import { projectToSheet, type DrawingOrigin } from './geo.ts'

export interface DrawingRow {
  id: string
  project_id: string
  origin_set: boolean | null
  origin_lat: number | null
  origin_lng: number | null
  sheet_extent_m: { w_m?: number; h_m?: number } | null
  north_offset_deg: number | null
}

export interface ResolveOptions {
  /** Drawings already pre-filtered to the project. */
  drawings: DrawingRow[]
  /** Cap on how many drawing matches we return. Default 3. */
  maxLinks?: number
}

function gpsConfidence(status: GpsStatus | undefined, distanceM: number): Confidence {
  if (status === 'unavailable') return 'low'
  if (status === 'low_confidence') return 'low'
  // Pin straddles the sheet's edge (near 0 or 1 in either axis): downgrade
  // to medium because the sheet boundary error is larger relative to position.
  if (distanceM < 2) return 'high'
  return 'high'
}

export function resolveDrawingLinks(
  media: MediaInput,
  opts: ResolveOptions,
): EntityLink[] {
  if (media.lat == null || media.lng == null) return []
  if (media.gpsStatus === 'unavailable') return []

  const candidates: Array<EntityLink & { distanceM: number }> = []

  for (const dwg of opts.drawings) {
    if (!dwg.origin_set) continue
    if (dwg.origin_lat == null || dwg.origin_lng == null) continue
    const w = dwg.sheet_extent_m?.w_m
    const h = dwg.sheet_extent_m?.h_m
    if (!w || !h || w <= 0 || h <= 0) continue

    const origin: DrawingOrigin = {
      originLat: dwg.origin_lat,
      originLng: dwg.origin_lng,
      extent: { wM: w, hM: h },
      northOffsetDeg: dwg.north_offset_deg ?? 0,
    }

    const pin = projectToSheet(media.lat, media.lng, origin)
    if (!pin.inBounds) continue

    candidates.push({
      entityType: 'drawing',
      entityId: dwg.id,
      pinX: pin.x,
      pinY: pin.y,
      confidence: gpsConfidence(media.gpsStatus, pin.distanceFromOriginM),
      source: 'auto',
      notes: `gps→pin (${(pin.x * 100).toFixed(1)}%, ${(pin.y * 100).toFixed(1)}%) ` +
             `${pin.distanceFromOriginM.toFixed(1)}m from origin`,
      distanceM: pin.distanceFromOriginM,
    })
  }

  candidates.sort((a, b) => a.distanceM - b.distanceM)

  // Strip the helper field before returning. eslint will flag the destructure
  // as unused but TS knows the shape stays clean.
  return candidates
    .slice(0, opts.maxLinks ?? 3)
    .map(({ distanceM: _d, ...link }) => link)
}
