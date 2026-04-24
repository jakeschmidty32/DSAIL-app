import { Router } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const APP_URL = process.env.APP_URL
const SPOTIFY_APP_URL = process.env.SPOTIFY_APP_URL || APP_URL

const REDIRECT_URI = `${SPOTIFY_APP_URL}/api/spotify/callback`
const SCOPES = 'user-read-recently-played user-read-playback-state'

async function getValidSpotifyToken(userId) {
  const { data: account } = await supabase
    .from('spotify_accounts')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!account) return null

  const expiresAt = new Date(account.token_expires_at)
  const now = new Date()
  const bufferMs = 5 * 60 * 1000

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return account.access_token
  }

  // Refresh the token
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!resp.ok) return null

  const { access_token, expires_in } = await resp.json()
  const newExpiry = new Date(Date.now() + expires_in * 1000).toISOString()

  await supabase
    .from('spotify_accounts')
    .update({ access_token, token_expires_at: newExpiry })
    .eq('user_id', userId)

  return access_token
}

// GET /api/spotify/connect — start Spotify OAuth
router.get('/connect', requireAuth, (req, res) => {
  if (!CLIENT_ID) return res.status(500).json({ error: 'Spotify not configured — add SPOTIFY_CLIENT_ID to .env' })
  const nonce = crypto.randomBytes(16).toString('hex')
  // Encode userId + nonce in state so callback works even across hostname change
  const state = Buffer.from(`${req.session.userId}:${nonce}`).toString('base64url')

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  })
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`)
})

// GET /api/spotify/callback — Spotify OAuth callback
router.get('/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query

    if (oauthError) return res.status(400).send(`Spotify OAuth error: ${oauthError}`)
    if (!state) return res.status(400).send('Missing state')

    // Decode userId from state (avoids session cookie cross-hostname issue)
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

    // Get Spotify user profile
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

// GET /api/spotify/tracks?date=YYYY-MM-DD
router.get('/tracks', requireAuth, async (req, res, next) => {
  try {
    const { date } = req.query
    const userId = req.session.userId
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    // Return from cache if available
    const { data: cached } = await supabase
      .from('spotify_tracks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('played_at', { ascending: false })

    if (cached && cached.length > 0) {
      return res.json({ tracks: cached.map(normalizeTrack), cached: true })
    }

    // Fetch from Spotify
    const accessToken = await getValidSpotifyToken(userId)
    if (!accessToken) {
      return res.json({ tracks: [], error: 'no_spotify' })
    }

    // Fetch recently played with a wide window around the target date
    const dateObj = new Date(date + 'T00:00:00Z')
    const after = dateObj.getTime()
    const before = new Date(date + 'T23:59:59Z').getTime()

    const url = `https://api.spotify.com/v1/me/player/recently-played?limit=50&after=${after}`
    const spotResp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!spotResp.ok) {
      return res.json({ tracks: [], error: 'spotify_api_error' })
    }

    const spotData = await spotResp.json()
    const items = spotData.items ?? []

    // Filter to tracks played on the requested date (by UTC date)
    const dayTracks = items.filter((item) => {
      const playedAt = new Date(item.played_at)
      return playedAt.getTime() >= after && playedAt.getTime() <= before
    })

    if (dayTracks.length === 0) {
      return res.json({ tracks: [], cached: false })
    }

    // Deduplicate by track_id (keep first play)
    const seen = new Set()
    const uniqueTracks = dayTracks.filter((item) => {
      if (seen.has(item.track.id)) return false
      seen.add(item.track.id)
      return true
    })

    // Insert into cache
    const rows = uniqueTracks.map((item, i) => ({
      user_id: userId,
      date,
      track_id: item.track.id,
      track_name: item.track.name,
      artist_name: item.track.artists.map((a) => a.name).join(', '),
      album_name: item.track.album?.name || null,
      album_image_url: item.track.album?.images?.[0]?.url || null,
      played_at: item.played_at,
      duration_ms: item.track.duration_ms || null,
      preview_url: item.track.preview_url || null,
      track_url: item.track.external_urls?.spotify || null,
      position: i,
    }))

    await supabase.from('spotify_tracks').upsert(rows, { onConflict: 'user_id,date,track_id' })

    return res.json({ tracks: uniqueTracks.map((item, i) => normalizeTrack(rows[i])), cached: false })
  } catch (err) {
    next(err)
  }
})

function normalizeTrack(row) {
  return {
    id: row.id,
    trackId: row.track_id,
    trackName: row.track_name,
    artistName: row.artist_name,
    albumName: row.album_name,
    albumImageUrl: row.album_image_url,
    playedAt: row.played_at,
    durationMs: row.duration_ms,
    previewUrl: row.preview_url,
    trackUrl: row.track_url,
  }
}

export default router
