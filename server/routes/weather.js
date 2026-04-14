import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { fetchWeather } from '../lib/weather.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

// GET /api/weather?date=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Missing or invalid date parameter' })
    }

    // Check cache
    const { data: cached, error: cacheError } = await supabase
      .from('weather_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (cacheError) return next(new Error(cacheError.message))

    if (cached) {
      return res.json({ weather: cached })
    }

    // Fetch from Open-Meteo
    const weather = await fetchWeather(userId, date)

    if (!weather) {
      return res.json({ weather: null, error: 'no_location' })
    }

    // Insert into weather_snapshots
    const { data: inserted, error: insertError } = await supabase
      .from('weather_snapshots')
      .insert({
        user_id: userId,
        date: weather.date,
        location_name: weather.locationName,
        temperature_max: weather.temperatureMax,
        temperature_min: weather.temperatureMin,
        temperature_unit: weather.temperatureUnit,
        condition: weather.condition,
        precipitation: weather.precipitation,
        wind_speed: weather.windSpeed,
        uv_index: weather.uvIndex,
        weather_code: weather.weatherCode,
      })
      .select('*')
      .single()

    if (insertError) return next(new Error(`weather_snapshots insert failed: ${insertError.message}`))

    return res.json({ weather: inserted })
  } catch (err) {
    next(err)
  }
})

export default router
