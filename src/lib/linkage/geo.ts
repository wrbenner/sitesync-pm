// =============================================================================
// Linkage Engine — geo math (Haversine, sheet projection)
// =============================================================================
// All distance + sheet-coord work happens here, in pure JS. No PostGIS, no
// server round-trip. The engine is small enough that JS-side math is fast and
// keeps the migration story simple (no extension install required).
// =============================================================================

const EARTH_RADIUS_M = 6_371_000

/** Haversine great-circle distance in meters. */
export function haversineMeters(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

export interface DrawingOrigin {
  originLat: number
  originLng: number
  /** Sheet's depicted area in real-world meters (width × height). */
  extent: { wM: number; hM: number }
  /** Rotation of the sheet's +Y axis off true north, degrees clockwise. */
  northOffsetDeg: number
}

export interface SheetPin {
  /** Drawing-relative coords in [0..1]. */
  x: number
  y: number
  /** Distance from origin in meters — exposed so the resolver can pick the
   *  best-fit sheet when several drawings could plausibly contain the point. */
  distanceFromOriginM: number
  /** True iff (x,y) ∈ [0,1] both axes. Out-of-bounds means the photo isn't on
   *  this sheet — the resolver should drop the candidate. */
  inBounds: boolean
}

/**
 * Project a real-world lat/lng onto a sheet's normalized [0..1] coordinate
 * space using its origin + extent + rotation.
 *
 * Why local Cartesian and not a real projection: at construction-site scales
 * (a single project rarely spans more than ~1 km), the locally-flat-earth
 * approximation is well under one pixel of error on any practical drawing.
 * Using a full Mercator/UTM here would just trade clarity for spurious
 * precision. The Haversine north/east deltas below are still correct to
 * ~0.5% across our scale.
 */
export function projectToSheet(
  lat: number,
  lng: number,
  origin: DrawingOrigin,
): SheetPin {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  // North/east offsets from origin in meters.
  const northM = haversineMeters(origin.originLat, origin.originLng, lat, origin.originLng)
    * Math.sign(lat - origin.originLat)
  const eastM  = haversineMeters(origin.originLat, origin.originLng, origin.originLat, lng)
    * Math.sign(lng - origin.originLng)

  // Rotate into the sheet's local frame. north_offset_deg = how much the
  // sheet's +Y is rotated clockwise from true north; we apply the inverse.
  const theta = toRad(origin.northOffsetDeg)
  const sheetY = northM * Math.cos(theta) + eastM * Math.sin(theta)
  const sheetX = -northM * Math.sin(theta) + eastM * Math.cos(theta)

  const x = sheetX / origin.extent.wM
  const y = sheetY / origin.extent.hM

  return {
    x,
    y,
    distanceFromOriginM: Math.hypot(northM, eastM),
    inBounds: x >= 0 && x <= 1 && y >= 0 && y <= 1,
  }
}

/** Classify GPS accuracy into the bucket the visualizer expects. */
export function classifyGpsStatus(accuracyMeters: number | null | undefined): 'good' | 'low_confidence' | 'unavailable' {
  if (accuracyMeters == null) return 'unavailable'
  if (accuracyMeters > 20) return 'low_confidence'
  return 'good'
}
