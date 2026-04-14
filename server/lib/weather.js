import { supabase } from './supabase.js'

const WMO_CODE_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Rain showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
}

function wmoToCondition(code) {
  return WMO_CODE_MAP[code] ?? 'Unknown'
}

/**
 * Fetch weather data for a user on a specific date.
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<object|null>}
 */
export async function fetchWeather(userId, dateStr) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('location_lat, location_lng, location_name, timezone, temperature_unit')
    .eq('id', userId)
    .single()

  if (userError) {
    throw new Error(`Failed to fetch user location: ${userError.message}`)
  }

  if (!user?.location_lat || !user?.location_lng) {
    return null
  }

  const { location_lat, location_lng, location_name, timezone, temperature_unit } = user

  const today = new Date().toISOString().split('T')[0]
  const isPastOrToday = dateStr <= today

  const temperatureUnit =
    temperature_unit === 'celsius' ? 'celsius' : 'fahrenheit'

  const commonParams = new URLSearchParams({
    latitude: location_lat,
    longitude: location_lng,
    start_date: dateStr,
    end_date: dateStr,
    daily: 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max,uv_index_max',
    temperature_unit: temperatureUnit,
    windspeed_unit: 'mph',
    timezone: timezone || 'auto',
  })

  let data = null

  if (isPastOrToday) {
    // Try forecast first (works for today and near future)
    try {
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?${commonParams.toString()}`
      const forecastRes = await fetch(forecastUrl)
      if (forecastRes.ok) {
        const forecastData = await forecastRes.json()
        if (forecastData.daily?.time?.includes(dateStr)) {
          data = forecastData
        }
      }
    } catch {
      // fall through to archive
    }

    // Fall back to archive for past dates
    if (!data && dateStr < today) {
      const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?${commonParams.toString()}`
      const archiveRes = await fetch(archiveUrl)
      if (!archiveRes.ok) {
        const errBody = await archiveRes.text()
        throw new Error(`Weather archive fetch failed: ${errBody}`)
      }
      data = await archiveRes.json()
    }
  } else {
    // Future date — use forecast
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?${commonParams.toString()}`
    const forecastRes = await fetch(forecastUrl)
    if (!forecastRes.ok) {
      const errBody = await forecastRes.text()
      throw new Error(`Weather forecast fetch failed: ${errBody}`)
    }
    data = await forecastRes.json()
  }

  if (!data?.daily) {
    return null
  }

  const daily = data.daily
  const idx = daily.time.indexOf(dateStr)
  if (idx === -1) {
    return null
  }

  const weatherCode = daily.weathercode[idx]

  return {
    date: dateStr,
    locationName: location_name || null,
    temperatureMax: daily.temperature_2m_max[idx],
    temperatureMin: daily.temperature_2m_min[idx],
    temperatureUnit: temperatureUnit,
    condition: wmoToCondition(weatherCode),
    precipitation: daily.precipitation_sum[idx],
    windSpeed: daily.windspeed_10m_max[idx],
    uvIndex: daily.uv_index_max[idx],
    weatherCode,
  }
}
