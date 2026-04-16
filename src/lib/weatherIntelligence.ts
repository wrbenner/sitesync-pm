// Construction-specific weather interpretation
// Translates raw weather data into actionable intelligence for job sites.

import type { WeatherSnapshot } from './weather'

export interface ConstructionWeather {
  temperature: number
  temperatureLow: number
  conditions: string
  windSpeed: number
  precipitationChance: number
  pourDay: boolean
  craneHold: boolean
  freezeRisk: boolean
  rainRisk: boolean
  heatRisk: boolean
  constructionSummary: string
}

/**
 * Interpret a WeatherSnapshot into construction-specific intelligence.
 * Rules based on ACI 306, OSHA crane standards, and field superintendent heuristics.
 */
export function interpretWeather(weather: WeatherSnapshot): ConstructionWeather {
  const temp = weather.temperature_high
  const tempLow = weather.temperature_low
  const wind = weather.wind_speed
  const precip = weather.precipitation_probability

  // ACI 306: concrete placement allowed 40-95F, precip < 40%, wind < 25 mph
  const pourDay = temp > 40 && temp < 95 && precip < 40 && wind < 25
  // OSHA crane wind limits: sustained > 20 mph requires evaluation
  const craneHold = wind > 20
  // Freeze protection needed when low < 32F
  const freezeRisk = tempLow < 32
  // Rain risk: > 50% chance means cover exposed materials
  const rainRisk = precip > 50
  // Heat stress: OSHA heat index triggers at 95F+
  const heatRisk = temp >= 95

  const parts: string[] = []

  if (pourDay) parts.push('Good pour day')
  else if (rainRisk) parts.push('No pour \u2014 rain expected')
  else if (freezeRisk && temp <= 40) parts.push('No pour \u2014 cold weather')
  else if (wind >= 25) parts.push('No pour \u2014 high wind')
  else parts.push('Pour conditions marginal')

  if (craneHold) parts.push('Wind hold possible')
  else parts.push('No wind hold')

  if (freezeRisk) parts.push(`Freeze risk \u2014 low ${tempLow}\u00B0F`)
  else parts.push('Freeze risk 0%')

  if (heatRisk) parts.push('Heat advisory')
  if (rainRisk) parts.push(`${precip}% rain \u2014 cover materials`)

  return {
    temperature: temp,
    temperatureLow: tempLow,
    conditions: weather.conditions,
    windSpeed: wind,
    precipitationChance: precip,
    pourDay,
    craneHold,
    freezeRisk,
    rainRisk,
    heatRisk,
    constructionSummary: parts.join(' \u00B7 '),
  }
}

/**
 * Get a weather condition icon for construction context.
 */
export function getWeatherIcon(conditions: string): string {
  const map: Record<string, string> = {
    Clear: '\u2600\uFE0F',
    Cloudy: '\u2601\uFE0F',
    'Partly Cloudy': '\u26C5',
    Rain: '\uD83C\uDF27\uFE0F',
    'Light Rain': '\uD83C\uDF26\uFE0F',
    'Heavy Rain': '\uD83C\uDF27\uFE0F',
    Thunderstorm: '\u26C8\uFE0F',
    Snow: '\u2744\uFE0F',
    'Heavy Snow': '\u2744\uFE0F',
    Fog: '\uD83C\uDF2B\uFE0F',
    Haze: '\uD83C\uDF2B\uFE0F',
  }
  return map[conditions] || '\u2600\uFE0F'
}
