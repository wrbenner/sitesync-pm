// Weather auto-fill for daily logs
// Uses OpenWeatherMap free tier (or falls back to reasonable defaults)

import { colors } from '../styles/theme'

export interface WeatherData {
  temp_high: number
  temp_low: number
  conditions: string
  precipitation: string
  wind_speed: string
  icon: string
  humidity: number
  fetched_at: string
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
    }
  } catch {
    return getDefaultWeather()
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
