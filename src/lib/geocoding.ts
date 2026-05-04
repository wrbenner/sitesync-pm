/**
 * Geocoding utility for converting project addresses to lat/lon coordinates.
 * Uses built-in lookup table for known cities + Nominatim (OpenStreetMap) API as fallback.
 * Results are cached in the projects table (latitude/longitude columns).
 */


import { fromTable } from '../lib/db/queries'

// Common US city coordinates for instant lookup (no API call needed)
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'dallas, tx': { lat: 32.7767, lon: -96.7970 },
  'houston, tx': { lat: 29.7604, lon: -95.3698 },
  'austin, tx': { lat: 30.2672, lon: -97.7431 },
  'san antonio, tx': { lat: 29.4241, lon: -98.4936 },
  'fort worth, tx': { lat: 32.7555, lon: -97.3308 },
  'new york, ny': { lat: 40.7128, lon: -74.0060 },
  'los angeles, ca': { lat: 34.0522, lon: -118.2437 },
  'chicago, il': { lat: 41.8781, lon: -87.6298 },
  'phoenix, az': { lat: 33.4484, lon: -112.0740 },
  'philadelphia, pa': { lat: 39.9526, lon: -75.1652 },
  'san diego, ca': { lat: 32.7157, lon: -117.1611 },
  'san jose, ca': { lat: 37.3382, lon: -121.8863 },
  'san francisco, ca': { lat: 37.7749, lon: -122.4194 },
  'seattle, wa': { lat: 47.6062, lon: -122.3321 },
  'denver, co': { lat: 39.7392, lon: -104.9903 },
  'nashville, tn': { lat: 36.1627, lon: -86.7816 },
  'atlanta, ga': { lat: 33.7490, lon: -84.3880 },
  'miami, fl': { lat: 25.7617, lon: -80.1918 },
  'boston, ma': { lat: 42.3601, lon: -71.0589 },
  'portland, or': { lat: 45.5155, lon: -122.6789 },
  'las vegas, nv': { lat: 36.1699, lon: -115.1398 },
  'charlotte, nc': { lat: 35.2271, lon: -80.8431 },
  'detroit, mi': { lat: 42.3314, lon: -83.0458 },
  'minneapolis, mn': { lat: 44.9778, lon: -93.2650 },
  'tampa, fl': { lat: 27.9506, lon: -82.4572 },
  'orlando, fl': { lat: 28.5383, lon: -81.3792 },
  'pittsburgh, pa': { lat: 40.4406, lon: -79.9959 },
  'st. louis, mo': { lat: 38.6270, lon: -90.1994 },
  'baltimore, md': { lat: 39.2904, lon: -76.6122 },
  'sacramento, ca': { lat: 38.5816, lon: -121.4944 },
  'kansas city, mo': { lat: 39.0997, lon: -94.5786 },
  'cleveland, oh': { lat: 41.4993, lon: -81.6944 },
  'columbus, oh': { lat: 39.9612, lon: -82.9988 },
  'indianapolis, in': { lat: 39.7684, lon: -86.1581 },
  'milwaukee, wi': { lat: 43.0389, lon: -87.9065 },
  'raleigh, nc': { lat: 35.7796, lon: -78.6382 },
  'salt lake city, ut': { lat: 40.7608, lon: -111.8910 },
}

export interface GeocodingResult {
  lat: number
  lon: number
  source: 'database' | 'lookup' | 'nominatim' | 'default'
}

/**
 * Get coordinates for a project, checking DB first, then geocoding.
 * If successfully geocoded, saves coordinates back to the project record.
 */
export async function getProjectCoordinates(
  projectId: string,
  address?: string | null,
  city?: string | null,
  state?: string | null,
  existingLat?: number | null,
  existingLon?: number | null,
): Promise<GeocodingResult> {
  // 1. Already have coordinates stored
  if (existingLat && existingLon) {
    return { lat: existingLat, lon: existingLon, source: 'database' }
  }

  // 2. Try city lookup table
  if (city && state) {
    const key = `${city}, ${state}`.toLowerCase()
    const match = CITY_COORDS[key]
    if (match) {
      // Save to DB for future use
      persistCoordinates(projectId, match.lat, match.lon)
      return { lat: match.lat, lon: match.lon, source: 'lookup' }
    }
  }

  // 3. Try Nominatim geocoding with full address
  const addressParts = [address, city, state].filter(Boolean).join(', ')
  if (addressParts) {
    try {
      const result = await geocodeAddress(addressParts)
      if (result) {
        persistCoordinates(projectId, result.lat, result.lon)
        return { ...result, source: 'nominatim' }
      }
    } catch {
      // Nominatim failed — fall through to default
    }
  }

  // 4. Default: use Dallas, TX (most projects are in Texas based on data)
  const defaultCoords = city && state
    ? (CITY_COORDS['dallas, tx'] ?? { lat: 32.7767, lon: -96.7970 })
    : { lat: 32.7767, lon: -96.7970 }

  return { lat: defaultCoords.lat, lon: defaultCoords.lon, source: 'default' }
}

/**
 * Geocode an address string using Nominatim (OpenStreetMap).
 * Free, no API key required, rate-limited to 1 req/sec.
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'us',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'SiteSyncPM/1.0' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    }
  } catch {
    return null
  }
}

/**
 * Persist geocoded coordinates to the project record (fire-and-forget).
 */
function persistCoordinates(projectId: string, lat: number, lon: number): void {
  fromTable('projects')
    .update({ latitude: lat, longitude: lon } as never)
    .eq('id' as never, projectId)
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        console.warn('[Geocoding] Failed to persist coordinates:', error.message)
      }
    })
}
