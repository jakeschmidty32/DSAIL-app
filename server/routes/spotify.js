import { Router } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'
import requireAuth from '../middleware/requireAuth.js'
import { getValidToken, getDailySummary } from '../lib/spotify.js'

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

export default router
