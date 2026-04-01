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
const DEFAULT_LAT = 40.7128 // New York (project site default)
const DEFAULT_LON = -74.0060

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
// Uses the OWM 5-day/3-hour forecast endpoint (free tier) so we get
// precipitation probability (pop). Falls back to defaults if the API is
// unavailable — in that case weather_source is 'manual' so no badge appears.
export async function fetchWeatherForProject(
  _projectId: string,
  lat?: number,
  lon?: number,
): Promise<WeatherSnapshot> {
  const useLat = lat ?? DEFAULT_LAT
  const useLon = lon ?? DEFAULT_LON

  if (!OPENWEATHER_API_KEY) {
    return getDefaultSnapshot()
  }

  try {
    // cnt=8 gives one full day of 3-hour intervals
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${useLat}&lon=${useLon}&cnt=8&units=imperial&appid=${OPENWEATHER_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return getDefaultSnapshot()

    const data = await res.json()
    const items: Record<string, unknown>[] = data.list ?? []
    if (!items.length) return getDefaultSnapshot()

    const first = items[0] as Record<string, Record<string, number>>
    const mainEntry = (first.weather as unknown as { main: string }[])?.[0]?.main || 'Clear'

    const allTemps = items.map(h => ((h as Record<string, Record<string, number>>).main?.temp ?? 0)).filter(Boolean)
    const tempHigh = allTemps.length ? Math.round(Math.max(...allTemps)) : Math.round(first.main?.temp_max ?? 75)
    const tempLow = allTemps.length ? Math.round(Math.min(...allTemps)) : Math.round(first.main?.temp_min ?? 55)

    // pop is 0–1 in OWM; take the max across the day
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
  } catch {
    return getDefaultSnapshot()
  }
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

  if (!OPENWEATHER_API_KEY) {
    return getDefaultWeather()
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${useLat}&lon=${useLon}&units=imperial&appid=${OPENWEATHER_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return getDefaultWeather()

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
  } catch {
    return getDefaultWeather()
  }
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
