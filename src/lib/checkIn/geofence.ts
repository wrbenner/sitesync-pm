// =============================================================================
// Geofence — multi-region polygon containment for crew check-ins
// =============================================================================
// Pure JS, no PostGIS. Each project's `site_geofence` is JSONB:
//
//   { regions: [{ name, polygon: [{lat, lng}, ...] }], tolerance_m }
//
// `tolerance_m` adds a buffer outside every polygon edge — defaults to 50m
// to handle GPS drift on the edge of a fence line. A check-in is "outside"
// only when it's outside every region by more than the tolerance.
//
// Algorithm:
//   1. For each region, run a standard ray-casting point-in-polygon test
//      on the polygon (treats the polygon as planar; fine at construction-
//      site scale where local-Cartesian error is well under one decimal
//      degree of GPS noise).
//   2. If inside any region → 'inside'.
//   3. Else compute the minimum distance to any polygon edge across all
//      regions. If the min distance ≤ tolerance_m → 'inside_with_tolerance'.
//   4. Else → 'outside' with the closest distance and the closest region's name.
// =============================================================================

export interface GeofencePoint { lat: number; lng: number }
export interface GeofenceRegion { name: string; polygon: GeofencePoint[] }
export interface SiteGeofence {
  regions: GeofenceRegion[]
  tolerance_m?: number
}

export type GeofenceResult =
  | { status: 'no_geofence_set' }
  | { status: 'inside'; region: string }
  | { status: 'inside_with_tolerance'; region: string; distance_m: number }
  | { status: 'outside'; closest_region: string | null; distance_m: number }

const EARTH_RADIUS_M = 6_371_000

function haversine(a: GeofencePoint, b: GeofencePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)))
}

/** Ray-casting point-in-polygon. Polygon is a list of vertices; closes implicitly. */
function pointInPolygon(point: GeofencePoint, polygon: GeofencePoint[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  const x = point.lng, y = point.lat
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat
    const intersect = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/** Distance from a point to a line segment (in meters via Haversine endpoints). */
function distanceToSegment(p: GeofencePoint, a: GeofencePoint, b: GeofencePoint): number {
  // Project to local meters using the midpoint as origin — accurate enough
  // for buffer-distance comparisons at construction scales.
  const lat0 = (a.lat + b.lat) / 2
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const toM = (q: GeofencePoint) => ({
    x: (q.lng - lat0) * cosLat * 111_320, // ~ meters per degree at equator × cos(lat)
    y: (q.lat - lat0) * 110_540,
  })
  void toM
  // Simpler: use Haversine directly; less precise at very small distances but
  // fine at the meter scale we care about.
  const ax = a, bx = b, px = p
  const ab = haversine(ax, bx)
  if (ab === 0) return haversine(px, ax)
  // Compute t = ((P-A)·(B-A)) / |B-A|² using local-flat-Earth deltas
  const ux = (bx.lng - ax.lng) * Math.cos((ax.lat * Math.PI) / 180)
  const uy = bx.lat - ax.lat
  const wx = (px.lng - ax.lng) * Math.cos((ax.lat * Math.PI) / 180)
  const wy = px.lat - ax.lat
  const denom = ux * ux + uy * uy
  let t = denom === 0 ? 0 : (wx * ux + wy * uy) / denom
  t = Math.max(0, Math.min(1, t))
  const closest = { lat: ax.lat + t * (bx.lat - ax.lat), lng: ax.lng + t * (bx.lng - ax.lng) }
  return haversine(px, closest)
}

function distanceToPolygon(p: GeofencePoint, polygon: GeofencePoint[]): number {
  if (polygon.length < 2) return Infinity
  let min = Infinity
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d = distanceToSegment(p, polygon[i], polygon[j])
    if (d < min) min = d
  }
  return min
}

/**
 * Classify a check-in point against a project's geofence.
 * Returns 'no_geofence_set' when the project hasn't configured any regions.
 */
export function classifyCheckIn(
  point: GeofencePoint,
  geofence: SiteGeofence | null | undefined,
): GeofenceResult {
  if (!geofence || !geofence.regions || geofence.regions.length === 0) {
    return { status: 'no_geofence_set' }
  }
  const tolerance = geofence.tolerance_m ?? 50

  for (const r of geofence.regions) {
    if (pointInPolygon(point, r.polygon)) {
      return { status: 'inside', region: r.name }
    }
  }

  let bestDist = Infinity
  let bestRegion: string | null = null
  for (const r of geofence.regions) {
    const d = distanceToPolygon(point, r.polygon)
    if (d < bestDist) { bestDist = d; bestRegion = r.name }
  }

  if (bestDist <= tolerance && bestRegion) {
    return { status: 'inside_with_tolerance', region: bestRegion, distance_m: Math.round(bestDist) }
  }
  return { status: 'outside', closest_region: bestRegion, distance_m: Math.round(bestDist) }
}
