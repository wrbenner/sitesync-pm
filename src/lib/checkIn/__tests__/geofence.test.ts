import { describe, it, expect } from 'vitest'
import { classifyCheckIn, type SiteGeofence } from '../geofence'

// A square ~100m × 100m centered roughly on Avery Oaks coords.
// 0.0009° lat ≈ 100m; 0.001° lng ≈ 100m at this latitude (cos(30°) ≈ 0.866).
const AVERY: SiteGeofence = {
  regions: [{
    name: 'Main site',
    polygon: [
      { lat: 30.4080, lng: -97.7570 },
      { lat: 30.4089, lng: -97.7570 },
      { lat: 30.4089, lng: -97.7560 },
      { lat: 30.4080, lng: -97.7560 },
    ],
  }],
  tolerance_m: 50,
}

describe('classifyCheckIn', () => {
  it('returns no_geofence_set when geofence is missing', () => {
    expect(classifyCheckIn({ lat: 30.4085, lng: -97.7565 }, null).status).toBe('no_geofence_set')
    expect(classifyCheckIn({ lat: 30.4085, lng: -97.7565 }, undefined).status).toBe('no_geofence_set')
  })

  it('returns inside for a point clearly inside the polygon', () => {
    const r = classifyCheckIn({ lat: 30.4085, lng: -97.7565 }, AVERY)
    expect(r.status).toBe('inside')
    if (r.status === 'inside') expect(r.region).toBe('Main site')
  })

  it('returns inside_with_tolerance for a point ~10m outside (within 50m buffer)', () => {
    // ~9m north of the polygon top edge
    const r = classifyCheckIn({ lat: 30.4090, lng: -97.7565 }, AVERY)
    expect(r.status).toBe('inside_with_tolerance')
    if (r.status === 'inside_with_tolerance') {
      expect(r.distance_m).toBeLessThanOrEqual(50)
      expect(r.distance_m).toBeGreaterThan(0)
    }
  })

  it('returns outside for a point >50m beyond the buffer', () => {
    // ~250m east of the polygon
    const r = classifyCheckIn({ lat: 30.4085, lng: -97.7530 }, AVERY)
    expect(r.status).toBe('outside')
    if (r.status === 'outside') {
      expect(r.distance_m).toBeGreaterThan(50)
      expect(r.closest_region).toBe('Main site')
    }
  })

  it('respects multi-region polygons (offsite welding shop)', () => {
    const multi: SiteGeofence = {
      regions: [
        { name: 'Main site', polygon: AVERY.regions[0].polygon },
        { name: 'Welding shop', polygon: [
          { lat: 30.5000, lng: -97.7000 },
          { lat: 30.5010, lng: -97.7000 },
          { lat: 30.5010, lng: -97.6990 },
          { lat: 30.5000, lng: -97.6990 },
        ]},
      ],
      tolerance_m: 50,
    }
    const r = classifyCheckIn({ lat: 30.5005, lng: -97.6995 }, multi)
    expect(r.status).toBe('inside')
    if (r.status === 'inside') expect(r.region).toBe('Welding shop')
  })

  it('respects a tighter custom tolerance', () => {
    const tight: SiteGeofence = { ...AVERY, tolerance_m: 5 }
    const r = classifyCheckIn({ lat: 30.4090, lng: -97.7565 }, tight)
    // 9m out, tolerance 5m → outside now
    expect(r.status).toBe('outside')
  })
})
