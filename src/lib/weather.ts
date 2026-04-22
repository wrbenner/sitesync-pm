// Weather auto-fill for daily logs and lookahead forecast
// Uses OpenWeatherMap free tier (or falls back to reasonable defaults)

import { colors } from '../styles/theme'

// Typed snapshot returned by fetchWeatherForProject — used by daily log modal
// and persisted to the DB row for legal defensibility.
export interface WeatherSnapshot {
  conditions: string
  temperature_high: number
  temperature_low: number
  wind_speed: number          // mph, numeric
  precipitation_probability: number  // 0–100
  weather_source: 'api' | 'manual'
  weather_fetched_at: string  // ISO timestamp, empty string when source is manual
}

export interface WeatherDay {
  date: string; // ISO YYYY-MM-DD
  precip_probability: number; // 0 to 100
  temp_high: number; // °F
  temp_low: number; // °F
  conditions: string;
  icon: string;
}

export interface WeatherData {
  temp_high: number
  temp_low: number
  conditions: string
  precipitation: string
  wind_speed: string
  icon: string
  humidity: number
  fetched_at: string
  source?: 'openweathermap' | 'default'
}

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || ''
const DEFAULT_LAT = 32.7767 // Dallas, TX (most projects are in Texas)
const DEFAULT_LON = -96.7970

const conditionsMap: Record<string, string> = {
  Clear: 'Clear',
  Clouds: 'Cloudy',
  Rain: 'Rain',
  Drizzle: 'Light Rain',
  Thunderstorm: 'Thunderstorm',
  Snow: 'Snow',
  Mist: 'Fog',
  Haze: 'Haze',
  Fog: 'Fog',
  Smoke: 'Smoke',
  Dust: 'Dust',
  Tornado: 'Tornado',
}

const iconMap: Record<string, string> = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  Mist: '🌫️',
  Haze: '🌫️',
  Fog: '🌫️',
}

// Fetch current weather for a project by lat/lon and return a WeatherSnapshot.
// Tries OWM first (if key available), then Open-Meteo (free, no key).
// Falls back to defaults only if both fail.
export async function fetchWeatherForProject(
  _projectId: string,
  lat?: number,
  lon?: number,
): Promise<WeatherSnapshot> {
  const useLat = lat ?? DEFAULT_LAT
  const useLon = lon ?? DEFAULT_LON

  // 1. Try OpenWeatherMap if key available
  if (OPENWEATHER_API_KEY) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${useLat}&lon=${useLon}&cnt=8&units=imperial&appid=${OPENWEATHER_API_KEY}`
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        const items: Record<string, unknown>[] = data.list ?? []
        if (items.length > 0) {
          const first = items[0] as Record<string, Record<string, number>>
          const mainEntry = (first.weather as unknown as { main: string }[])?.[0]?.main || 'Clear'
          const allTemps = items.map(h => ((h as Record<string, Record<string, number>>).main?.temp ?? 0)).filter(Boolean)
          const tempHigh = allTemps.length ? Math.round(Math.max(...allTemps)) : Math.round(first.main?.temp_max ?? 75)
          const tempLow = allTemps.length ? Math.round(Math.min(...allTemps)) : Math.round(first.main?.temp_min ?? 55)
          const maxPop = Math.max(...items.map(h => ((h as Record<string, number>).pop as number) ?? 0))
          return {
            conditions: conditionsMap[mainEntry] || mainEntry,
            temperature_high: tempHigh,
            temperature_low: tempLow,
            wind_speed: Math.round((first.wind as Record<string, number>)?.speed ?? 0),
            precipitation_probability: Math.round(maxPop * 100),
            weather_source: 'api',
            weather_fetched_at: new Date().toISOString(),
          }
        }
      }
    } catch {
      // OWM failed — fall through to Open-Meteo
    }
  }

  // 2. Fallback: Open-Meteo (free, no API key)
  try {
    const today = new Date().toISOString().split('T')[0]
    const params = new URLSearchParams({
      latitude: String(useLat),
      longitude: String(useLon),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode',
      temperature_unit: 'fahrenheit',
      windspeed_unit: 'mph',
      timezone: 'auto',
      start_date: today,
      end_date: today,
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data: {
        daily?: {
          weathercode?: number[]
          temperature_2m_max?: number[]
          temperature_2m_min?: number[]
          windspeed_10m_max?: number[]
          precipitation_probability_max?: number[]
        }
      } = await res.json()
      const d = data.daily
      if (d) {
        const wmo = d.weathercode?.[0] ?? 0
        return {
          conditions: WMO_CONDITIONS[wmo] ?? 'Clear',
          temperature_high: Math.round(d.temperature_2m_max?.[0] ?? 75),
          temperature_low: Math.round(d.temperature_2m_min?.[0] ?? 55),
          wind_speed: Math.round(d.windspeed_10m_max?.[0] ?? 0),
          precipitation_probability: Math.round(d.precipitation_probability_max?.[0] ?? 0),
          weather_source: 'api',
          weather_fetched_at: new Date().toISOString(),
        }
      }
    }
  } catch {
    // Open-Meteo also failed
  }

  return getDefaultSnapshot()
}

function getDefaultSnapshot(): WeatherSnapshot {
  // Fallback when API is unavailable — source is 'manual' so no badge displays
  return {
    conditions: 'Clear',
    temperature_high: 75,
    temperature_low: 58,
    wind_speed: 8,
    precipitation_probability: 10,
    weather_source: 'manual',
    weather_fetched_at: '',
  }
}

export async function fetchWeather(lat?: number, lon?: number): Promise<WeatherData> {
  const useLat = lat ?? DEFAULT_LAT
  const useLon = lon ?? DEFAULT_LON

  // 1. Try OpenWeatherMap if key is available
  if (OPENWEATHER_API_KEY) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${useLat}&lon=${useLon}&units=imperial&appid=${OPENWEATHER_API_KEY}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        const main = data.weather?.[0]?.main || 'Clear'
        return {
          temp_high: Math.round(data.main?.temp_max ?? 75),
          temp_low: Math.round(data.main?.temp_min ?? 55),
          conditions: conditionsMap[main] || main,
          precipitation: data.rain?.['1h'] ? `${data.rain['1h']}mm` : data.snow?.['1h'] ? `${data.snow['1h']}mm` : '0mm',
          wind_speed: `${Math.round(data.wind?.speed ?? 0)} mph`,
          icon: iconMap[main] || '☀️',
          humidity: data.main?.humidity ?? 50,
          fetched_at: new Date().toISOString(),
          source: 'openweathermap',
        }
      }
    } catch {
      // OWM failed — try Open-Meteo
    }
  }

  // 2. Fallback to Open-Meteo (free, no API key)
  try {
    const today = new Date().toISOString().split('T')[0]
    const params = new URLSearchParams({
      latitude: String(useLat),
      longitude: String(useLon),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode',
      temperature_unit: 'fahrenheit',
      windspeed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
      start_date: today,
      end_date: today,
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data: {
        daily?: {
          weathercode?: number[]
          temperature_2m_max?: number[]
          temperature_2m_min?: number[]
          windspeed_10m_max?: number[]
          precipitation_sum?: number[]
        }
      } = await res.json()
      const d = data.daily
      if (d) {
        const wmo = d.weathercode?.[0] ?? 0
        const cond = WMO_CONDITIONS[wmo] ?? 'Clear'
        const wmoToIcon: Record<number, string> = { 0: '☀️', 1: '☀️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '❄️', 73: '❄️', 75: '❄️', 80: '🌧️', 81: '🌧️', 82: '🌧️', 95: '⛈️', 96: '⛈️', 99: '⛈️' }
        const precip = d.precipitation_sum?.[0] ?? 0
        return {
          temp_high: Math.round(d.temperature_2m_max?.[0] ?? 75),
          temp_low: Math.round(d.temperature_2m_min?.[0] ?? 55),
          conditions: cond,
          precipitation: precip > 0 ? `${precip}"` : '0mm',
          wind_speed: `${Math.round(d.windspeed_10m_max?.[0] ?? 0)} mph`,
          icon: wmoToIcon[wmo] ?? '☀️',
          humidity: 50,
          fetched_at: new Date().toISOString(),
          source: 'openweathermap', // keep type-compat
        }
      }
    }
  } catch {
    // Open-Meteo also failed
  }

  return getDefaultWeather()
}

// Fetch weather for a specific log date using project coordinates.
// For today, uses the current conditions endpoint.
// For past dates, uses the One Call API timemachine (requires paid tier);
// falls back gracefully to current conditions or defaults when unavailable.
export async function fetchWeatherForLog(
  lat: number,
  lon: number,
  date: string,
): Promise<WeatherData & { source: 'openweathermap' | 'default' }> {
  if (!OPENWEATHER_API_KEY) {
    return { ...getDefaultWeather(), source: 'default' }
  }

  const today = new Date().toISOString().split('T')[0]
  const isToday = date === today

  try {
    if (isToday) {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return { ...getDefaultWeather(), source: 'default' }

      const data = await res.json()
      const main = data.weather?.[0]?.main || 'Clear'

      return {
        temp_high: Math.round(data.main?.temp_max ?? 75),
        temp_low: Math.round(data.main?.temp_min ?? 55),
        conditions: conditionsMap[main] || main,
        precipitation: data.rain?.['1h'] ? `${data.rain['1h']}mm` : data.snow?.['1h'] ? `${data.snow['1h']}mm` : '0mm',
        wind_speed: `${Math.round(data.wind?.speed ?? 0)} mph`,
        icon: iconMap[main] || '☀️',
        humidity: data.main?.humidity ?? 50,
        fetched_at: new Date().toISOString(),
        source: 'openweathermap',
      }
    }

    // Historical: One Call API 3.0 timemachine
    const dt = Math.floor(new Date(date).getTime() / 1000)
    const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${dt}&units=imperial&appid=${OPENWEATHER_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { ...getDefaultWeather(), source: 'default' }

    const data = await res.json()
    // timemachine returns hourly data; use noon (index 12) as representative
    const hour = Array.isArray(data.data) ? data.data[12] ?? data.data[0] : null
    if (!hour) return { ...getDefaultWeather(), source: 'default' }

    const main = hour.weather?.[0]?.main || 'Clear'
    const temps: number[] = (data.data ?? []).map((h: Record<string, number>) => h.temp as number).filter(Boolean)
    const tempHigh = temps.length ? Math.round(Math.max(...temps)) : Math.round(hour.temp ?? 75)
    const tempLow = temps.length ? Math.round(Math.min(...temps)) : Math.round(hour.temp ?? 55)
    const totalRain = (data.data ?? []).reduce((s: number, h: Record<string, Record<string, number>>) => s + (h.rain?.['1h'] ?? 0), 0)
    const totalSnow = (data.data ?? []).reduce((s: number, h: Record<string, Record<string, number>>) => s + (h.snow?.['1h'] ?? 0), 0)

    return {
      temp_high: tempHigh,
      temp_low: tempLow,
      conditions: conditionsMap[main] || main,
      precipitation: totalRain > 0 ? `${totalRain.toFixed(1)}mm` : totalSnow > 0 ? `${totalSnow.toFixed(1)}mm` : '0mm',
      wind_speed: `${Math.round(hour.wind_speed ?? 0)} mph`,
      icon: iconMap[main] || '☀️',
      humidity: hour.humidity ?? 50,
      fetched_at: new Date().toISOString(),
      source: 'openweathermap',
    }
  } catch {
    return { ...getDefaultWeather(), source: 'default' }
  }
}

function getDefaultWeather(): WeatherData {
  // Reasonable defaults for a construction site
  return {
    temp_high: 75,
    temp_low: 58,
    conditions: 'Clear',
    precipitation: '0mm',
    wind_speed: '8 mph',
    icon: '☀️',
    humidity: 45,
    fetched_at: new Date().toISOString(),
    source: 'default',
  }
}

function getMondayStart(): Date {
  const d = new Date();
  const dow = d.getDay();
  const offset = dow === 0 ? 1 : dow === 6 ? 2 : -(dow - 1);
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultDay(date: string): WeatherDay {
  return { date, precip_probability: 10, temp_high: 75, temp_low: 55, conditions: 'Clear', icon: '☀️' };
}

function defaultForecast(numDays: number): WeatherDay[] {
  const start = getMondayStart();
  return Array.from({ length: numDays }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return defaultDay(d.toISOString().split('T')[0]);
  });
}

// Returns a WeatherDay[] aligned to the 3-week lookahead board (starts Monday).
// Falls back silently to defaults if the API is unavailable or not configured.
export async function getWeatherForecast(
  _projectId: string,
  numDays: number,
): Promise<WeatherDay[]> {
  if (!OPENWEATHER_API_KEY) return defaultForecast(numDays);

  try {
    // TODO: accept lat/lon params from the project; for now use defaults
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}&units=imperial&appid=${OPENWEATHER_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return defaultForecast(numDays);

    const data = await res.json();

    // Group 3-hour forecast entries by calendar date
    const byDate: Record<string, { temps: number[]; pops: number[]; mains: string[] }> = {};
    for (const item of (data.list ?? [])) {
      const date: string = (item.dt_txt as string)?.split(' ')[0];
      if (!date) continue;
      if (!byDate[date]) byDate[date] = { temps: [], pops: [], mains: [] };
      byDate[date].temps.push(item.main?.temp ?? 70);
      byDate[date].pops.push((item.pop ?? 0) * 100);
      byDate[date].mains.push(item.weather?.[0]?.main || 'Clear');
    }

    const start = getMondayStart();
    return Array.from({ length: numDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = byDate[dateStr];
      if (!entry || entry.temps.length === 0) return defaultDay(dateStr);
      const midMain = entry.mains[Math.floor(entry.mains.length / 2)] || 'Clear';
      return {
        date: dateStr,
        precip_probability: Math.round(Math.max(...entry.pops)),
        temp_high: Math.round(Math.max(...entry.temps)),
        temp_low: Math.round(Math.min(...entry.temps)),
        conditions: conditionsMap[midMain] || midMain,
        icon: iconMap[midMain] || '☀️',
      };
    });
  } catch {
    return defaultForecast(numDays);
  }
}

// ── Open-Meteo (free, no API key) ─────────────────────────────────────────────
// WMO weather interpretation codes → human-readable condition strings

const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear',
  1: 'Clear',
  2: 'Partly Cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Fog',
  51: 'Light Rain',
  53: 'Light Rain',
  55: 'Rain',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain',
  81: 'Rain',
  82: 'Heavy Rain',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
}

export interface WeatherForDate {
  conditions: string
  temp_high: number
  temp_low: number
  wind_speed: number        // mph
  precipitation_inches: number
  source: string            // 'open-meteo' | 'default'
}

function fallbackWeatherForDate(): WeatherForDate {
  return { conditions: 'Clear', temp_high: 75, temp_low: 55, wind_speed: 8, precipitation_inches: 0, source: 'default' }
}

/**
 * Fetch daily weather for a specific date using Open-Meteo (free, no API key).
 * Results are cached in localStorage keyed by `weather:{date}:{lat}:{lon}` so
 * re-opening the modal is instant and does not burn network requests.
 */
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CachedEntry<T> { cachedAt: number; value: T }

function readCache<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedEntry<T> | T
    if (parsed && typeof parsed === 'object' && 'cachedAt' in parsed && 'value' in parsed) {
      const entry = parsed as CachedEntry<T>
      if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
        localStorage.removeItem(key)
        return null
      }
      return entry.value
    }
    // Legacy cache entry without TTL wrapper — treat as expired
    localStorage.removeItem(key)
    return null
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function writeCache<T>(key: string, value: T): void {
  const entry: CachedEntry<T> = { cachedAt: Date.now(), value }
  try { localStorage.setItem(key, JSON.stringify(entry)) } catch { /* quota exceeded */ }
}

export async function fetchWeatherForDate(
  lat: number,
  lon: number,
  date: string,
): Promise<WeatherForDate> {
  const cacheKey = `weather:${date}:${lat.toFixed(4)}:${lon.toFixed(4)}`
  const cached = readCache<WeatherForDate>(cacheKey)
  if (cached) return cached

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode',
      temperature_unit: 'fahrenheit',
      windspeed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
      start_date: date,
      end_date: date,
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return fallbackWeatherForDate()

    const data: {
      daily?: {
        weathercode?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        windspeed_10m_max?: number[]
        precipitation_sum?: number[]
      }
    } = await res.json()

    const d = data.daily
    if (!d) return fallbackWeatherForDate()

    const wmo: number = d.weathercode?.[0] ?? 0
    const result: WeatherForDate = {
      conditions: WMO_CONDITIONS[wmo] ?? 'Clear',
      temp_high: Math.round(d.temperature_2m_max?.[0] ?? 75),
      temp_low: Math.round(d.temperature_2m_min?.[0] ?? 55),
      wind_speed: Math.round(d.windspeed_10m_max?.[0] ?? 0),
      precipitation_inches: Math.round((d.precipitation_sum?.[0] ?? 0) * 100) / 100,
      source: 'open-meteo',
    }
    writeCache(cacheKey, result)
    return result
  } catch {
    return fallbackWeatherForDate()
  }
}

/**
 * Fetch a 5-day daily forecast using Open-Meteo (free, no API key required).
 * Falls back to OpenWeatherMap if available, then to defaults.
 */
export async function fetchWeatherForecast5Day(lat: number, lon: number): Promise<WeatherDay[]> {
  const today = new Date()
  const dates: string[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const cacheKey = `forecast5:${dates[0]}:${lat.toFixed(3)}:${lon.toFixed(3)}`
  const cached = readCache<WeatherDay[]>(cacheKey)
  if (cached) return cached

  const fallback = (): WeatherDay[] => dates.map(date => ({
    date, temp_high: 75, temp_low: 55, conditions: 'Clear', icon: '☀️', precip_probability: 10,
  }))

  // WMO code → icon mapping for Open-Meteo
  const wmoIcon = (code: number): string => {
    if (code <= 1) return '☀️'
    if (code <= 3) return '⛅'
    if (code <= 48) return '🌫️'
    if (code <= 55) return '🌦️'
    if (code <= 65) return '🌧️'
    if (code <= 75) return '❄️'
    if (code <= 82) return '🌧️'
    if (code <= 99) return '⛈️'
    return '☀️'
  }

  // 1. Try Open-Meteo (free, no API key)
  try {
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode',
      temperature_unit: 'fahrenheit',
      windspeed_unit: 'mph',
      timezone: 'auto',
      start_date: startDate,
      end_date: endDate,
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data: {
        daily?: {
          time?: string[]
          weathercode?: number[]
          temperature_2m_max?: number[]
          temperature_2m_min?: number[]
          precipitation_probability_max?: number[]
          windspeed_10m_max?: number[]
        }
      } = await res.json()

      const d = data.daily
      if (d && d.time && d.time.length > 0) {
        const result: WeatherDay[] = d.time.map((date, i) => {
          const wmo = d.weathercode?.[i] ?? 0
          const cond = WMO_CONDITIONS[wmo] ?? 'Clear'
          return {
            date,
            temp_high: Math.round(d.temperature_2m_max?.[i] ?? 75),
            temp_low: Math.round(d.temperature_2m_min?.[i] ?? 55),
            conditions: cond,
            icon: wmoIcon(wmo),
            precip_probability: Math.round(d.precipitation_probability_max?.[i] ?? 0),
          }
        })
        writeCache(cacheKey, result)
        return result
      }
    }
  } catch {
    // Open-Meteo failed — try OWM fallback
  }

  // 2. Fallback: OpenWeatherMap (if API key available)
  if (OPENWEATHER_API_KEY) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        const byDate: Record<string, { temps: number[]; pops: number[]; mains: string[] }> = {}
        for (const item of (data.list ?? [])) {
          const date: string = (item.dt_txt as string)?.split(' ')[0]
          if (!date) continue
          if (!byDate[date]) byDate[date] = { temps: [], pops: [], mains: [] }
          byDate[date].temps.push(item.main?.temp ?? 70)
          byDate[date].pops.push((item.pop ?? 0) * 100)
          byDate[date].mains.push(item.weather?.[0]?.main || 'Clear')
        }
        const result: WeatherDay[] = dates.map((date) => {
          const entry = byDate[date]
          if (!entry || entry.temps.length === 0) {
            return { date, temp_high: 75, temp_low: 55, conditions: 'Clear', icon: '☀️', precip_probability: 10 }
          }
          const midMain = entry.mains[Math.floor(entry.mains.length / 2)] || 'Clear'
          return {
            date,
            temp_high: Math.round(Math.max(...entry.temps)),
            temp_low: Math.round(Math.min(...entry.temps)),
            conditions: conditionsMap[midMain] || midMain,
            icon: iconMap[midMain] || '☀️',
            precip_probability: Math.round(Math.max(...entry.pops)),
          }
        })
        writeCache(cacheKey, result)
        return result
      }
    } catch {
      // OWM also failed
    }
  }

  return fallback()
}

export function formatWeatherSummary(w: WeatherData): string {
  return `${w.temp_high}°F ${w.conditions}`
}

export function getWeatherImpact(w: WeatherData): { level: 'none' | 'low' | 'high'; label: string; color: string } {
  if (w.conditions === 'Thunderstorm' || w.conditions === 'Tornado') {
    return { level: 'high', label: 'Work stoppage likely', color: colors.statusCritical }
  }
  if (w.conditions === 'Rain' || w.conditions === 'Snow') {
    return { level: 'high', label: 'Outdoor work impacted', color: colors.statusPending }
  }
  if (w.conditions === 'Light Rain' || w.conditions === 'Fog' || parseInt(w.wind_speed) > 25) {
    return { level: 'low', label: 'Minor impact possible', color: colors.statusPending }
  }
  if (w.temp_high > 100 || w.temp_low < 20) {
    return { level: 'low', label: 'Extreme temperature', color: colors.statusPending }
  }
  return { level: 'none', label: 'No impact expected', color: colors.statusActive }
}
