import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  authenticateCron,
  requireUuid,
} from '../shared/auth.ts'

interface WeatherSyncRequest {
  project_id: string
}

interface WeatherSyncResponse {
  cached: boolean
  forecast_days: number
}

serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const supabase = authenticateCron(req)
    const body = await parseJsonBody<WeatherSyncRequest>(req)

    const projectId = requireUuid(body.project_id, 'project_id')

    const { data: projectData } = await supabase
      .from('projects')
      .select('location, coordinates')
      .eq('id', projectId)
      .single()

    if (!projectData) {
      throw new HttpError(404, 'Project not found')
    }

    let latitude: number, longitude: number

    if (projectData.coordinates?.lat && projectData.coordinates?.lng) {
      latitude = projectData.coordinates.lat
      longitude = projectData.coordinates.lng
    } else {
      throw new HttpError(400, 'Project location coordinates not configured')
    }

    const openWeatherApiKey = Deno.env.get('OPENWEATHER_API_KEY')
    if (!openWeatherApiKey) {
      throw new HttpError(500, 'OPENWEATHER_API_KEY not configured')
    }

    const weatherUrl = new URL('https://api.openweathermap.org/data/2.5/forecast')
    weatherUrl.searchParams.set('lat', latitude.toString())
    weatherUrl.searchParams.set('lon', longitude.toString())
    weatherUrl.searchParams.set('appid', openWeatherApiKey)
    weatherUrl.searchParams.set('units', 'metric')

    const weatherResponse = await fetch(weatherUrl.toString())

    if (!weatherResponse.ok) {
      const error = await weatherResponse.text()
      console.error('OpenWeather API error:', error)
      throw new HttpError(502, 'Failed to fetch weather data')
    }

    const weatherData = await weatherResponse.json()

    if (!weatherData.list || weatherData.list.length === 0) {
      throw new HttpError(500, 'Invalid weather response structure')
    }

    const forecastDays = new Set(
      weatherData.list.map((item: {dt: number}) => {
        const date = new Date(item.dt * 1000)
        return date.toISOString().split('T')[0]
      }),
    ).size

    const processedForecast = {
      location: weatherData.city?.name || projectData.location,
      coord: {
        lat: weatherData.city?.coord?.lat,
        lon: weatherData.city?.coord?.lon,
      },
      list: weatherData.list.slice(0, 40).map((item: {
        dt: number
        main: {temp: number; feels_like: number; temp_min: number; temp_max: number; humidity: number}
        weather: Array<{main: string; description: string}>
        wind: {speed: number; deg: number}
        clouds: {all: number}
        pop?: number
        rain?: {[key: string]: number}
      }) => ({
        dt: item.dt,
        temp: item.main.temp,
        feels_like: item.main.feels_like,
        humidity: item.main.humidity,
        weather: item.weather[0]?.main || 'Unknown',
        description: item.weather[0]?.description || '',
        wind_speed: item.wind?.speed || 0,
        wind_deg: item.wind?.deg || 0,
        clouds: item.clouds?.all || 0,
        precipitation_probability: item.pop || 0,
        rain_volume: item.rain?.['3h'] || 0,
      })),
      queried_at: new Date().toISOString(),
    }

    const { data: existingCache } = await supabase
      .from('weather_cache')
      .select('id')
      .eq('project_id', projectId)
      .single()

    if (existingCache) {
      await supabase
        .from('weather_cache')
        .update({
          forecast_data: processedForecast,
          cached_at: new Date().toISOString(),
        })
        .eq('project_id', projectId)
    } else {
      await supabase.from('weather_cache').insert({
        project_id: projectId,
        forecast_data: processedForecast,
        cached_at: new Date().toISOString(),
      })
    }

    const response: WeatherSyncResponse = {
      cached: true,
      forecast_days: forecastDays,
    }

    return new Response(JSON.stringify(response), {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    return errorResponse(error, getCorsHeaders(req))
  }
})
