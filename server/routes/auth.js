import { Router } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const APP_URL = process.env.APP_URL

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

// GET /api/auth/connect — start Google OAuth flow
router.get('/connect', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex')
  req.session.oauthState = state

  const redirectUri = `${APP_URL}/api/auth/callback`

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'offline',  // required to receive a refresh token
    prompt: 'consent',        // ensures refresh token is always returned
  })

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

// GET /api/auth/callback — OAuth callback from Google
router.get('/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query

    if (oauthError) {
      return res.status(400).send(`OAuth error: ${oauthError}`)
    }

    if (!state || state !== req.session.oauthState) {
      return res.status(400).send('State mismatch — possible CSRF attack')
    }

    delete req.session.oauthState

    const redirectUri = `${APP_URL}/api/auth/callback`

    // Exchange authorization code for tokens
    const tokenParams = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text()
      return res.status(400).send(`Token exchange failed: ${errBody}`)
    }

    const { access_token, refresh_token, expires_in } = await tokenResponse.json()

    // Fetch Google user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!profileResponse.ok) {
      const errBody = await profileResponse.text()
      return res.status(400).send(`Profile fetch failed: ${errBody}`)
    }

    const { id: googleId, email, name: displayName } = await profileResponse.json()

    // Upsert user record
    const { data: user, error: upsertUserError } = await supabase
      .from('users')
      .upsert(
        { google_id: googleId, email, display_name: displayName },
        { onConflict: 'google_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (upsertUserError) {
      return next(new Error(`User upsert failed: ${upsertUserError.message}`))
    }

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Upsert calendar account with tokens
    const { error: upsertCalError } = await supabase
      .from('calendar_accounts')
      .upsert(
        {
          user_id: user.id,
          provider: 'google',
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
        },
        { onConflict: 'user_id,provider' }
      )

    if (upsertCalError) {
      return next(new Error(`Calendar account upsert failed: ${upsertCalError.message}`))
    }

    req.session.userId = user.id
    res.redirect(`${APP_URL}/?connected=true`)
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me — current user info
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.json({ user: null, calendarConnected: false })
    }

    const userId = req.session.userId

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, display_name, location_name, timezone, temperature_unit')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return res.json({ user: null, calendarConnected: false })
    }

    const { data: calAccount } = await supabase
      .from('calendar_accounts')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        locationName: user.location_name,
        timezone: user.timezone,
        temperatureUnit: user.temperature_unit,
      },
      calendarConnected: !!calAccount,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/logout — destroy session
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err)
    res.clearCookie('connect.sid')
    res.json({ ok: true })
  })
})

// POST /api/auth/disconnect — remove Google calendar connection
router.post('/disconnect', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('calendar_accounts')
      .delete()
      .eq('user_id', req.session.userId)

    if (error) return next(new Error(`Disconnect failed: ${error.message}`))
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
