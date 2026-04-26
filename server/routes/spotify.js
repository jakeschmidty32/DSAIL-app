import { Router } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'
import requireAuth from '../middleware/requireAuth.js'
import {
  getValidToken,
  getDailySummary,
  fetchRecentlyPlayedPaged,
  buildDailySummariesFromItems,
  getDateInTz,
} from '../lib/spotify.js'

const router = Router()

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const APP_URL = process.env.APP_URL
const SPOTIFY_APP_URL = process.env.SPOTIFY_APP_URL || APP_URL

const REDIRECT_URI = `${SPOTIFY_APP_URL}/api/spotify/callback`
const SCOPES = 'user-read-recently-played'

// GET /api/spotify/connect — start Spotify OAuth
router.get('/connect', requireAuth, (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'Spotify not configured — add SPOTIFY_CLIENT_ID to .env' })
  }

  const state = Buffer.from(
    `${req.session.userId}:${crypto.randomBytes(16).toString('hex')}`
  ).toString('base64url')

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  })

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`)
})

// GET /api/spotify/callback — Spotify OAuth callback (no requireAuth — cross-hostname cookie issue)
router.get('/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query

    if (oauthError) return res.status(400).send(`Spotify OAuth error: ${oauthError}`)
    if (!state) return res.status(400).send('Missing state')

    let userId
    try {
      const decoded = Buffer.from(state, 'base64url').toString()
      userId = decoded.split(':')[0]
      if (!userId) throw new Error('bad state')
    } catch {
      return res.status(400).send('Invalid state')
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })

    const tokenResp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!tokenResp.ok) {
      const err = await tokenResp.text()
      return res.status(400).send(`Token exchange failed: ${err}`)
    }

    const { access_token, refresh_token, expires_in } = await tokenResp.json()

    const profileResp = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const profile = profileResp.ok ? await profileResp.json() : {}

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    const { error: upsertError } = await supabase
      .from('spotify_accounts')
      .upsert(
        {
          user_id: userId,
          access_token,
          refresh_token,
          token_expires_at: expiresAt,
          spotify_user_id: profile.id || null,
          display_name: profile.display_name || null,
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Spotify upsert failed:', upsertError.message)
      return res.status(500).send(`Failed to save Spotify connection: ${upsertError.message}`)
    }

    res.redirect(`${APP_URL}/?spotify=connected`)
  } catch (err) {
    next(err)
  }
})

// POST /api/spotify/disconnect
router.post('/disconnect', requireAuth, async (req, res, next) => {
  try {
    await supabase.from('spotify_accounts').delete().eq('user_id', req.session.userId)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/spotify/day?date=YYYY-MM-DD&tz=America/New_York
router.get('/day', requireAuth, async (req, res, next) => {
  try {
    const { date, tz } = req.query
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    const userId = req.session.userId

    // Prefer browser-supplied timezone (tz param), fall back to DB, then UTC
    let timezone = 'UTC'
    if (tz) {
      try { Intl.DateTimeFormat(undefined, { timeZone: tz }); timezone = tz } catch {}
    } else {
      const { data: user } = await supabase
        .from('users').select('timezone').eq('id', userId).maybeSingle()
      timezone = user?.timezone || 'UTC'
    }

    const result = await getDailySummary(userId, date, timezone)

    if (result.error === 'no_token') {
      return res.status(200).json({ summary: null, notConnected: true })
    }

    res.json({ summary: result.summary, cached: result.cached })
  } catch (err) {
    next(err)
  }
})

// GET /api/spotify/month?start=YYYY-MM-DD&end=YYYY-MM-DD&tz=America/New_York
// Returns a map of date → top song album art URL.
// For any dates not yet cached, proactively fetches from Spotify and populates the cache.
router.get('/month', requireAuth, async (req, res, next) => {
  try {
    const { start, end, tz } = req.query
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!start || !end || !dateRe.test(start) || !dateRe.test(end)) {
      return res.status(400).json({ error: 'Invalid start/end date' })
    }

    const userId = req.session.userId

    // Resolve timezone
    let timezone = 'UTC'
    if (tz) {
      try { Intl.DateTimeFormat(undefined, { timeZone: tz }); timezone = tz } catch {}
    } else {
      const { data: user } = await supabase
        .from('users').select('timezone').eq('id', userId).maybeSingle()
      timezone = user?.timezone || 'UTC'
    }

    // ── 1. Check cache ─────────────────────────────────────────────────────────
    const { data: cachedRows, error: cacheErr } = await supabase
      .from('spotify_daily_summary')
      .select('date, top_song_album_art_url, total_listening_time_ms')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)

    if (cacheErr) return next(new Error(cacheErr.message))

    const dates = {}
    const cachedDateSet = new Set()

    for (const row of cachedRows || []) {
      // A row is considered "fully synced" if total_listening_time_ms is not null
      // (both empty-day rows [ms=0] and data rows [ms>0] are fully synced).
      if (row.total_listening_time_ms !== null) {
        cachedDateSet.add(row.date)
        if (row.top_song_album_art_url) {
          dates[row.date] = { albumArtUrl: row.top_song_album_art_url }
        }
      }
    }

    // ── 2. Find uncached dates ─────────────────────────────────────────────────
    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)

    const uncachedDates = []
    const cursor = new Date(Date.UTC(sy, sm - 1, sd))
    const endUTC = new Date(Date.UTC(ey, em - 1, ed))
    while (cursor <= endUTC) {
      const ds = cursor.toISOString().slice(0, 10)
      if (!cachedDateSet.has(ds)) uncachedDates.push(ds)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    // ── 3. Fetch from Spotify for uncached dates ───────────────────────────────
    if (uncachedDates.length > 0) {
      const accessToken = await getValidToken(userId)
      if (accessToken) {
        // Paginate backwards from 2 days past end, stopping 1 day before start
        const beforeMs = Date.UTC(ey, em - 1, ed + 2)
        const oldestAllowedMs = Date.UTC(sy, sm - 1, sd - 1)

        const allItems = await fetchRecentlyPlayedPaged(accessToken, beforeMs, oldestAllowedMs)
        console.log(`[Spotify/month] fetched ${allItems.length} tracks for range ${start}→${end}`)

        // Build per-day summary rows for the uncached dates that have tracks
        const summaryRows = buildDailySummariesFromItems(allItems, userId, timezone, start, end)

        // Mark which uncached dates now have data
        const syncedDates = new Set(summaryRows.map(r => r.date))

        // For uncached dates with NO tracks, write empty rows so we don't re-fetch next time
        const emptyRows = uncachedDates
          .filter(d => !syncedDates.has(d))
          .map(d => ({
            user_id: userId,
            date: d,
            total_listening_time_ms: 0,
            top_song_name: null,
            top_song_artist: null,
            top_song_album_art_url: null,
            top_artist_name: null,
            top_artist_image_url: null,
          }))

        const allUpserts = [...summaryRows, ...emptyRows]
        if (allUpserts.length > 0) {
          await supabase
            .from('spotify_daily_summary')
            .upsert(allUpserts, { onConflict: 'user_id,date' })
        }

        // Merge newly fetched art into the response
        for (const row of summaryRows) {
          if (row.top_song_album_art_url) {
            dates[row.date] = { albumArtUrl: row.top_song_album_art_url }
          }
        }
      }
    }

    res.json({ dates })
  } catch (err) {
    next(err)
  }
})

export default router
