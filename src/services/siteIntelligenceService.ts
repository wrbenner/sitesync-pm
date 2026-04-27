// ── Site Intelligence Service ─────────────────────────────────
// REAL API integrations — zero mock data.
// Calls: Nominatim (geocoding), FEMA NFHL (flood), USDA NRCS (soil),
// OpenWeatherMap (weather), Overpass/OSM (amenities), USGS (elevation),
// EPA (environmental). All free public APIs.

// ── Types ─────────────────────────────────────────────────────

export interface GeocodingResult {
  lat: number;
  lng: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  boundingbox?: [string, string, string, string];
}

export interface FloodZoneData {
  zone: string;
  zone_subtype: string;
  is_sfha: boolean;
  base_flood_elevation: number | null;
  risk_level: 'High' | 'Moderate' | 'Low' | 'Minimal';
  insurance_required: boolean;
  description: string;
}

export interface SoilData {
  map_unit_symbol: string;
  map_unit_name: string;
  drainage_class: string;
  hydrologic_group: string;
  taxonomic_order: string;
  taxonomic_subgroup: string;
}

export interface WeatherCurrent {
  temperature: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust: number;
  conditions: string;
  description: string;
  icon: string;
  visibility: number;
  clouds: number;
}

export interface WeatherForecastDay {
  date: string;
  temp_high: number;
  temp_low: number;
  conditions: string;
  description: string;
  icon: string;
  wind_speed: number;
  wind_gust: number;
  humidity: number;
  precipitation_probability: number;
  rain_mm: number;
  snow_mm: number;
}

export interface ConstructionWeatherAssessment {
  pour_day: boolean;
  pour_reason: string;
  crane_hold: boolean;
  crane_reason: string;
  freeze_risk: boolean;
  heat_risk: boolean;
  rain_risk: boolean;
  summary: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherForecastDay[];
  construction: ConstructionWeatherAssessment;
}

export interface NearbyAmenity {
  name: string;
  type: string;
  category: string;
  lat: number;
  lng: number;
  distance_mi: number;
  distance_ft: number;
}

export interface ElevationData {
  elevation_ft: number;
  source: string;
}

export interface EPAFacility {
  name: string;
  registry_id: string;
  street: string;
  city: string;
  state: string;
  distance_mi: number;
  programs: string[];
}

export interface SunData {
  sunrise: string;
  sunset: string;
  day_length_hours: number;
  summer_solstice_hours: number;
  winter_solstice_hours: number;
  annual_avg_hours: number;
  optimal_orientation: string;
}

export interface SiteIntelligenceData {
  address: GeocodingResult;
  flood: FloodZoneData | null;
  soil: SoilData | null;
  weather: WeatherData | null;
  nearby: NearbyAmenity[];
  elevation: ElevationData | null;
  epa_facilities: EPAFacility[];
  sun: SunData | null;
  fetched_at: string;
}

// ── Constants ─────────────────────────────────────────────────

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';
const API_TIMEOUT = 12000; // 12 seconds

// ── Helpers ───────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): { miles: number; feet: number } {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const miles = R * c;
  return { miles: Math.round(miles * 100) / 100, feet: Math.round(miles * 5280) };
}

function driveTimeEstimate(miles: number): string {
  if (miles < 0.3) return `${Math.round(miles * 5280 / 260)} min walk`;
  const minutes = Math.max(1, Math.round(miles * 2.5)); // ~24mph avg city speed
  return `${minutes} min`;
}

// ── 1. Geocoding (Nominatim) ──────────────────────────────────

export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '1',
      countrycodes: 'us',
    });
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { 'User-Agent': 'SiteSync-PM/1.0 (construction-pm-software)' } }
    );
    if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
    const data = await response.json();
    return data.map((r: any) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display_name: r.display_name,
      address: r.address || {},
      boundingbox: r.boundingbox,
    }));
  } catch (err) {
    console.error('[SiteIntelligence] Geocoding error:', err);
    return [];
  }
}

// ── 2. FEMA Flood Zone ────────────────────────────────────────

function mapFloodZone(zone: string, subtype: string): { risk_level: FloodZoneData['risk_level']; insurance_required: boolean; description: string } {
  const zoneUpper = (zone || '').toUpperCase().trim();
  switch (zoneUpper) {
    case 'A':
    case 'AE':
    case 'AH':
    case 'AO':
    case 'AR':
    case 'A99':
      return {
        risk_level: 'High',
        insurance_required: true,
        description: `Zone ${zoneUpper} — Special Flood Hazard Area (1% annual chance flood). Mandatory flood insurance. Base flood elevations may apply.`,
      };
    case 'VE':
    case 'V':
      return {
        risk_level: 'High',
        insurance_required: true,
        description: `Zone ${zoneUpper} — Coastal High Hazard Area with wave action. Mandatory flood insurance. Elevated construction required.`,
      };
    case 'X':
      if (subtype && subtype.includes('500')) {
        return {
          risk_level: 'Moderate',
          insurance_required: false,
          description: 'Zone X (Shaded) — 0.2% annual chance (500-year) flood area. Flood insurance recommended but not mandatory.',
        };
      }
      return {
        risk_level: 'Minimal',
        insurance_required: false,
        description: 'Zone X (Unshaded) — Minimal flood hazard. Area outside the 0.2% annual chance floodplain. Flood insurance optional.',
      };
    case 'D':
      return {
        risk_level: 'Low',
        insurance_required: false,
        description: 'Zone D — Undetermined risk. Flood hazards are possible but not determined. Flood insurance available.',
      };
    default:
      return {
        risk_level: 'Low',
        insurance_required: false,
        description: zone ? `Zone ${zone} — Flood hazard data available from FEMA NFHL.` : 'No FEMA flood data available for this location.',
      };
  }
}

async function fetchFloodZone(lat: number, lng: number): Promise<FloodZoneData | null> {
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE',
      returnGeometry: 'false',
      f: 'json',
      inSR: '4326',
    });
    const response = await fetchWithTimeout(
      `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params}`
    );
    if (!response.ok) throw new Error(`FEMA API: ${response.status}`);
    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      return {
        zone: 'X',
        zone_subtype: '',
        is_sfha: false,
        base_flood_elevation: null,
        ...mapFloodZone('X', ''),
      };
    }
    const feat = data.features[0].attributes;
    const zone = feat.FLD_ZONE || 'X';
    const subtype = feat.ZONE_SUBTY || '';
    const mapping = mapFloodZone(zone, subtype);
    return {
      zone,
      zone_subtype: subtype,
      is_sfha: feat.SFHA_TF === 'T',
      base_flood_elevation: feat.STATIC_BFE && feat.STATIC_BFE > 0 ? feat.STATIC_BFE : null,
      ...mapping,
    };
  } catch (err) {
    console.error('[SiteIntelligence] FEMA flood zone error:', err);
    return null;
  }
}

// ── 3. USDA Soil Data ─────────────────────────────────────────

async function fetchSoilData(lat: number, lng: number): Promise<SoilData | null> {
  try {
    const query = `SELECT TOP 1 musym, muname, drclassdcd, hydgrpdcd, taxorder, taxsubgrp
FROM mapunit mu
INNER JOIN component co ON mu.mukey = co.mukey
WHERE mu.mukey IN (
  SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lng} ${lat})')
) AND co.comppct_r IS NOT NULL
ORDER BY co.comppct_r DESC`;

    // USDA SDA requires form-urlencoded with uppercase param names
    const body = new URLSearchParams();
    body.append('QUERY', query);
    body.append('FORMAT', 'JSON');

    const response = await fetchWithTimeout(
      'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }
    );
    if (!response.ok) throw new Error(`USDA SDA: ${response.status}`);
    const data = await response.json();
    if (!data.Table || data.Table.length === 0) return null;
    const row = data.Table[0];
    return {
      map_unit_symbol: row[0] || '',
      map_unit_name: row[1] || '',
      drainage_class: row[2] || 'Unknown',
      hydrologic_group: row[3] || 'Unknown',
      taxonomic_order: row[4] || '',
      taxonomic_subgroup: row[5] || '',
    };
  } catch (err) {
    console.error('[SiteIntelligence] USDA soil error:', err);
    return null;
  }
}

// ── 4. Weather (OpenWeatherMap) ───────────────────────────────

function assessConstructionWeather(current: WeatherCurrent, forecast: WeatherForecastDay[]): ConstructionWeatherAssessment {
  const temp = current.temperature;
  const wind = current.wind_speed;
  const precip = forecast.length > 0 ? forecast[0].precipitation_probability : 0;

  // ACI 306: concrete placement 40-95°F, precip < 40%, wind < 25 mph
  const pourDay = temp > 40 && temp < 95 && precip < 40 && wind < 25;
  let pourReason = '';
  if (!pourDay) {
    if (temp <= 40) pourReason = 'Too cold for concrete (ACI 306: min 40°F)';
    else if (temp >= 95) pourReason = 'Too hot for concrete (ACI 306: max 95°F)';
    else if (precip >= 40) pourReason = `${precip}% precipitation probability`;
    else if (wind >= 25) pourReason = `Wind ${wind} mph exceeds 25 mph limit`;
  } else {
    pourReason = 'All conditions within ACI 306 parameters';
  }

  // OSHA crane: sustained > 20 mph requires evaluation
  const craneHold = wind > 20;
  const craneReason = craneHold
    ? `Wind ${wind} mph — crane operations require evaluation (OSHA: >20 mph)`
    : `Wind ${wind} mph — within crane operating limits`;

  const freezeRisk = current.temp_min !== undefined ? current.temp_min < 32 : temp < 35;
  const heatRisk = temp >= 95;
  const rainRisk = precip > 50;

  const parts: string[] = [];
  if (pourDay) parts.push('Good pour day');
  else parts.push('No-pour conditions');
  if (craneHold) parts.push('Wind hold possible');
  if (freezeRisk) parts.push('Freeze protection needed');
  if (heatRisk) parts.push('Heat advisory — hydration protocol');
  if (rainRisk) parts.push('Cover exposed materials');

  return {
    pour_day: pourDay,
    pour_reason: pourReason,
    crane_hold: craneHold,
    crane_reason: craneReason,
    freeze_risk: freezeRisk,
    heat_risk: heatRisk,
    rain_risk: rainRisk,
    summary: parts.join(' · '),
  };
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) {
    console.warn('[SiteIntelligence] No OpenWeatherMap API key');
    return null;
  }
  try {
    // Fetch current + forecast in parallel
    const [currentRes, forecastRes] = await Promise.all([
      fetchWithTimeout(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=imperial`
      ),
      fetchWithTimeout(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=imperial`
      ),
    ]);

    if (!currentRes.ok) throw new Error(`Weather current: ${currentRes.status}`);
    if (!forecastRes.ok) throw new Error(`Weather forecast: ${forecastRes.status}`);

    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();

    const current: WeatherCurrent = {
      temperature: Math.round(currentData.main.temp),
      feels_like: Math.round(currentData.main.feels_like),
      temp_min: Math.round(currentData.main.temp_min),
      temp_max: Math.round(currentData.main.temp_max),
      humidity: currentData.main.humidity,
      pressure: currentData.main.pressure,
      wind_speed: Math.round(currentData.wind.speed),
      wind_deg: currentData.wind.deg || 0,
      wind_gust: Math.round(currentData.wind.gust || currentData.wind.speed),
      conditions: currentData.weather[0]?.main || 'Unknown',
      description: currentData.weather[0]?.description || '',
      icon: currentData.weather[0]?.icon || '01d',
      visibility: currentData.visibility || 10000,
      clouds: currentData.clouds?.all || 0,
    };

    // Aggregate 3-hour forecast into daily summaries
    const dailyMap = new Map<string, any[]>();
    for (const item of forecastData.list || []) {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyMap.has(date)) dailyMap.set(date, []);
      dailyMap.get(date)!.push(item);
    }

    const forecast: WeatherForecastDay[] = [];
    for (const [date, items] of dailyMap) {
      if (forecast.length >= 5) break;
      const temps = items.map((i: any) => i.main.temp);
      const winds = items.map((i: any) => i.wind.speed);
      const gusts = items.map((i: any) => i.wind.gust || i.wind.speed);
      const pops = items.map((i: any) => (i.pop || 0) * 100);
      const rains = items.map((i: any) => i.rain?.['3h'] || 0);
      const snows = items.map((i: any) => i.snow?.['3h'] || 0);
      // Pick the most common weather condition
      const condCounts = new Map<string, number>();
      for (const i of items) {
        const c = i.weather[0]?.main || 'Clear';
        condCounts.set(c, (condCounts.get(c) || 0) + 1);
      }
      let bestCond = 'Clear';
      let bestCount = 0;
      for (const [c, cnt] of condCounts) {
        if (cnt > bestCount) { bestCond = c; bestCount = cnt; }
      }
      const midItem = items[Math.floor(items.length / 2)];

      forecast.push({
        date,
        temp_high: Math.round(Math.max(...temps)),
        temp_low: Math.round(Math.min(...temps)),
        conditions: bestCond,
        description: midItem.weather[0]?.description || '',
        icon: midItem.weather[0]?.icon || '01d',
        wind_speed: Math.round(Math.max(...winds)),
        wind_gust: Math.round(Math.max(...gusts)),
        humidity: Math.round(items.reduce((s: number, i: any) => s + i.main.humidity, 0) / items.length),
        precipitation_probability: Math.round(Math.max(...pops)),
        rain_mm: Math.round(rains.reduce((s: number, v: number) => s + v, 0) * 10) / 10,
        snow_mm: Math.round(snows.reduce((s: number, v: number) => s + v, 0) * 10) / 10,
      });
    }

    const construction = assessConstructionWeather(current, forecast);

    return { current, forecast, construction };
  } catch (err) {
    console.error('[SiteIntelligence] Weather error:', err);
    return null;
  }
}

// ── 5. Nearby Amenities (Overpass/OSM) ────────────────────────

const AMENITY_CATEGORIES: Record<string, { label: string; type: string }> = {
  school: { label: 'School', type: 'school' },
  hospital: { label: 'Hospital', type: 'hospital' },
  fire_station: { label: 'Fire Station', type: 'fire_station' },
  police: { label: 'Police Station', type: 'police' },
  fuel: { label: 'Gas Station', type: 'fuel' },
  supermarket: { label: 'Grocery', type: 'grocery' },
};

async function fetchNearbyAmenities(lat: number, lng: number): Promise<NearbyAmenity[]> {
  try {
    // Query amenities within ~3km radius
    const radius = 3000;
    const query = `
[out:json][timeout:10];
(
  node["amenity"="school"](around:${radius},${lat},${lng});
  way["amenity"="school"](around:${radius},${lat},${lng});
  node["amenity"="hospital"](around:${radius},${lat},${lng});
  way["amenity"="hospital"](around:${radius},${lat},${lng});
  node["amenity"="fire_station"](around:${radius},${lat},${lng});
  way["amenity"="fire_station"](around:${radius},${lat},${lng});
  node["amenity"="police"](around:${radius},${lat},${lng});
  way["amenity"="police"](around:${radius},${lat},${lng});
  node["amenity"="fuel"](around:${radius},${lat},${lng});
  node["shop"="supermarket"](around:${radius},${lat},${lng});
  way["shop"="supermarket"](around:${radius},${lat},${lng});
  node["public_transport"="station"](around:${radius},${lat},${lng});
  node["railway"="station"](around:${radius},${lat},${lng});
  node["aeroway"="aerodrome"](around:8000,${lat},${lng});
  way["aeroway"="aerodrome"](around:8000,${lat},${lng});
);
out center;`;

    const response = await fetchWithTimeout(
      'https://overpass-api.de/api/interpreter',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      },
      15000 // Overpass can be slow
    );
    if (!response.ok) throw new Error(`Overpass: ${response.status}`);
    const data = await response.json();

    const amenities: NearbyAmenity[] = [];
    const seen = new Set<string>();

    for (const element of data.elements || []) {
      const elLat = element.lat || element.center?.lat;
      const elLng = element.lon || element.center?.lon;
      if (!elLat || !elLng) continue;

      const tags = element.tags || {};
      const name = tags.name || tags['name:en'] || '';
      if (!name) continue;

      // Deduplicate by name
      const key = `${name}-${tags.amenity || tags.shop || tags.aeroway || tags.railway || tags.public_transport}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let category = 'other';
      let type = tags.amenity || tags.shop || tags.aeroway || tags.railway || tags.public_transport || '';

      if (tags.amenity && AMENITY_CATEGORIES[tags.amenity]) {
        category = AMENITY_CATEGORIES[tags.amenity].type;
      } else if (tags.shop === 'supermarket') {
        category = 'grocery';
        type = 'supermarket';
      } else if (tags.aeroway === 'aerodrome') {
        category = 'airport';
        type = 'airport';
      } else if (tags.railway === 'station' || tags.public_transport === 'station') {
        category = 'transit';
        type = 'transit';
      }

      const dist = haversineDistance(lat, lng, elLat, elLng);
      amenities.push({
        name,
        type,
        category,
        lat: elLat,
        lng: elLng,
        distance_mi: dist.miles,
        distance_ft: dist.feet,
      });
    }

    // Sort by distance
    amenities.sort((a, b) => a.distance_mi - b.distance_mi);

    // Take closest of each category + extras
    const result: NearbyAmenity[] = [];
    const categorySeen = new Map<string, number>();
    for (const a of amenities) {
      const count = categorySeen.get(a.category) || 0;
      if (count < 2) { // Max 2 per category
        result.push(a);
        categorySeen.set(a.category, count + 1);
      }
    }

    return result.slice(0, 16);
  } catch (err) {
    console.error('[SiteIntelligence] Overpass amenities error:', err);
    return [];
  }
}

// ── 6. USGS Elevation ─────────────────────────────────────────

async function fetchElevation(lat: number, lng: number): Promise<ElevationData | null> {
  try {
    const response = await fetchWithTimeout(
      `https://epqs.nationalmap.gov/v1/json?x=${lng}&y=${lat}&wkid=4326&units=Feet&includeDate=false`
    );
    if (!response.ok) throw new Error(`USGS elevation: ${response.status}`);
    const data = await response.json();
    const elev = data.value;
    if (elev === undefined || elev === null || elev === -1000000) return null;
    return {
      elevation_ft: Math.round(parseFloat(elev)),
      source: 'USGS National Map',
    };
  } catch (err) {
    console.error('[SiteIntelligence] USGS elevation error:', err);
    return null;
  }
}

// ── 7. EPA Environmental ──────────────────────────────────────

async function fetchEPAData(lat: number, lng: number): Promise<EPAFacility[]> {
  // Query EPA facility data through ArcGIS feature services (CORS-friendly)
  // Uses EPA Facility Registry Service (FRS) hosted on geodata.epa.gov
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '4828', // ~3 miles in meters
      units: 'esriSRUnit_Meter',
      outFields: 'PRIMARY_NAME,REGISTRY_ID,LOCATION_ADDRESS,CITY_NAME,STATE_CODE,INTEREST_TYPES',
      returnGeometry: 'true',
      f: 'json',
      inSR: '4326',
      outSR: '4326',
      resultRecordCount: '15',
    });

    const response = await fetchWithTimeout(
      `https://geodata.epa.gov/arcgis/rest/services/OEI/FRS_INTERESTS/MapServer/0/query?${params}`,
      {},
      15000
    );

    if (!response.ok) {
      console.warn('[SiteIntelligence] EPA FRS ArcGIS returned', response.status);
      // Fallback to Superfund sites layer
      return await fetchEPASuperfund(lat, lng);
    }

    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      // Try Superfund as fallback
      return await fetchEPASuperfund(lat, lng);
    }

    return data.features.slice(0, 10).map((f: any) => {
      const a = f.attributes;
      const geom = f.geometry;
      const dist = geom ? haversineDistance(lat, lng, geom.y, geom.x) : { miles: 0, feet: 0 };
      return {
        name: a.PRIMARY_NAME || 'Unknown',
        registry_id: a.REGISTRY_ID || '',
        street: a.LOCATION_ADDRESS || '',
        city: a.CITY_NAME || '',
        state: a.STATE_CODE || '',
        distance_mi: dist.miles,
        programs: (a.INTEREST_TYPES || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      };
    });
  } catch (err) {
    console.error('[SiteIntelligence] EPA ArcGIS error:', err);
    return await fetchEPASuperfund(lat, lng);
  }
}

async function fetchEPASuperfund(lat: number, lng: number): Promise<EPAFacility[]> {
  // Fallback: query Superfund/NPL sites through ArcGIS
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '8047', // ~5 miles in meters
      units: 'esriSRUnit_Meter',
      outFields: 'SITE_NAME,SITE_EPA_ID,ADDRESS,CITY,STATE',
      returnGeometry: 'true',
      f: 'json',
      inSR: '4326',
      outSR: '4326',
      resultRecordCount: '10',
    });

    const response = await fetchWithTimeout(
      `https://services.arcgis.com/cJ9YHowT8TU7DUyn/ArcGIS/rest/services/Superfund_National_Priorities_List_(NPL)_Sites_with_Status_Information/FeatureServer/0/query?${params}`,
      {},
      10000
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.features) return [];
    return data.features.slice(0, 10).map((f: any) => {
      const a = f.attributes;
      const geom = f.geometry;
      const dist = geom ? haversineDistance(lat, lng, geom.y, geom.x) : { miles: 0, feet: 0 };
      return {
        name: a.SITE_NAME || 'Unknown',
        registry_id: a.SITE_EPA_ID || '',
        street: a.ADDRESS || '',
        city: a.CITY || '',
        state: a.STATE || '',
        distance_mi: dist.miles,
        programs: ['Superfund/NPL'],
      };
    });
  } catch (err) {
    console.error('[SiteIntelligence] EPA Superfund fallback error:', err);
    return [];
  }
}

// ── 8. Sun Exposure Calculation ───────────────────────────────

function calculateSunData(lat: number, _lng: number): SunData {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);

  // Solar declination (approximate)
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));

  // Day length calculation
  function dayLength(decl: number): number {
    const latRad = lat * Math.PI / 180;
    const declRad = decl * Math.PI / 180;
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);
    if (cosHourAngle < -1) return 24; // Midnight sun
    if (cosHourAngle > 1) return 0;  // Polar night
    const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
    return (2 * hourAngle) / 15;
  }

  const todayLength = dayLength(declination);
  const summerSolstice = dayLength(23.45);
  const winterSolstice = dayLength(-23.45);
  const annualAvg = (summerSolstice + winterSolstice) / 2;

  // Sunrise/sunset times (approximate)
  const solarNoon = 12; // simplified
  const halfDay = todayLength / 2;
  const sunrise = solarNoon - halfDay;
  const sunset = solarNoon + halfDay;

  const formatTime = (h: number): string => {
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Optimal solar orientation based on latitude
  let orientation = 'South (180°)';
  if (lat > 45) orientation = 'South-Southwest (195°)';
  else if (lat > 35) orientation = 'South (180°)';
  else if (lat > 25) orientation = 'South-Southeast (165°)';
  else orientation = 'South-Southeast (155°)';

  return {
    sunrise: formatTime(sunrise),
    sunset: formatTime(sunset),
    day_length_hours: Math.round(todayLength * 10) / 10,
    summer_solstice_hours: Math.round(summerSolstice * 10) / 10,
    winter_solstice_hours: Math.round(winterSolstice * 10) / 10,
    annual_avg_hours: Math.round(annualAvg * 10) / 10,
    optimal_orientation: orientation,
  };
}

// ── Main: Fetch All Site Intelligence ─────────────────────────

export async function fetchSiteIntelligence(address: string): Promise<SiteIntelligenceData | null> {
  // Step 1: Geocode the address
  const results = await geocodeAddress(address);
  if (results.length === 0) {
    console.error('[SiteIntelligence] Could not geocode address:', address);
    return null;
  }

  const geocoded = results[0];
  const { lat, lng } = geocoded;

  // Step 2: Fire ALL API calls in parallel
  const [floodResult, soilResult, weatherResult, nearbyResult, elevResult, epaResult] = await Promise.allSettled([
    fetchFloodZone(lat, lng),
    fetchSoilData(lat, lng),
    fetchWeather(lat, lng),
    fetchNearbyAmenities(lat, lng),
    fetchElevation(lat, lng),
    fetchEPAData(lat, lng),
  ]);

  // Step 3: Calculate sun data (no API needed)
  const sunData = calculateSunData(lat, lng);

  return {
    address: geocoded,
    flood: floodResult.status === 'fulfilled' ? floodResult.value : null,
    soil: soilResult.status === 'fulfilled' ? soilResult.value : null,
    weather: weatherResult.status === 'fulfilled' ? weatherResult.value : null,
    nearby: nearbyResult.status === 'fulfilled' ? nearbyResult.value : [],
    elevation: elevResult.status === 'fulfilled' ? elevResult.value : null,
    epa_facilities: epaResult.status === 'fulfilled' ? epaResult.value : [],
    sun: sunData,
    fetched_at: new Date().toISOString(),
  };
}

// ── Export Individual Fetchers (for targeted refresh) ──────────

export {
  fetchFloodZone,
  fetchSoilData,
  fetchWeather,
  fetchNearbyAmenities,
  fetchElevation,
  fetchEPAData,
  calculateSunData,
};
