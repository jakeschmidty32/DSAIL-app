import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// GET /api/settings — return user location/preference settings
router.get('/', async (req, res, next) => {
  try {
    const userId = req.session.userId

    const { data: user, error } = await supabase
      .from('users')
      .select('timezone, temperature_unit, location_name, location_lat, location_lng')
      .eq('id', userId)
      .single()

    if (error) return next(new Error(error.message))

    return res.json({ settings: user })
  } catch (err) {
    next(err)
  }
})

// PUT /api/settings — update timezone and temperature_unit
router.put('/', async (req, res, next) => {
  try {
    const userId = req.session.userId
    const { timezone, temperature_unit } = req.body

    const updates = {}

    if (timezone !== undefined) {
      if (typeof timezone !== 'string' || timezone.trim().length === 0) {
        return res.status(400).json({ error: 'timezone must be a non-empty string' })
      }
      updates.timezone = timezone.trim()
    }

    if (temperature_unit !== undefined) {
      if (!['fahrenheit', 'celsius'].includes(temperature_unit)) {
        return res.status(400).json({ error: 'temperature_unit must be "fahrenheit" or "celsius"' })
      }
      updates.temperature_unit = temperature_unit
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('timezone, temperature_unit, location_name, location_lat, location_lng')
      .single()

    if (error) return next(new Error(`Failed to update settings: ${error.message}`))

    return res.json({ settings: user })
  } catch (err) {
    next(err)
  }
})

// POST /api/settings/geocode — geocode a city name
router.post('/geocode', async (req, res, next) => {
  try {
    const { city } = req.body

    if (!city || typeof city !== 'string' || city.trim().length === 0) {
      return res.status(400).json({ error: 'city is required' })
    }

    const params = new URLSearchParams({
      name: city.trim(),
      count: '5',
      language: 'en',
      format: 'json',
    })

    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`
    )

    if (!response.ok) {
      const errBody = await response.text()
      return next(new Error(`Geocoding failed: ${errBody}`))
    }

    const data = await response.json()

    const results = (data.results || []).map((r) => ({
      name: r.name,
      lat: r.latitude,
      lng: r.longitude,
      country: r.country,
      admin1: r.admin1,
      timezone: r.timezone,
    }))

    return res.json({ results })
  } catch (err) {
    next(err)
  }
})

// POST /api/settings/location — save chosen location
router.post('/location', async (req, res, next) => {
  try {
    const userId = req.session.userId
    const { name, lat, lng, timezone } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' })
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat and lng must be numbers' })
    }
    if (!timezone || typeof timezone !== 'string' || timezone.trim().length === 0) {
      return res.status(400).json({ error: 'timezone is required' })
    }

    const { error } = await supabase
      .from('users')
      .update({
        location_name: name.trim(),
        location_lat: lat,
        location_lng: lng,
        timezone: timezone.trim(),
      })
      .eq('id', userId)

    if (error) return next(new Error(`Failed to save location: ${error.message}`))

    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
