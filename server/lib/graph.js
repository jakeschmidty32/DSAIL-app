import { supabase } from './supabase.js'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * Get a valid Google access token for the user, refreshing if necessary.
 */
export async function getValidAccessToken(userId) {
  const { data: account, error } = await supabase
    .from('calendar_accounts')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single()

  if (error || !account) throw new Error('No calendar account found for user')

  const { access_token, refresh_token, token_expires_at } = account

  // Return current token if still valid (5-minute buffer)
  if (new Date(token_expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return access_token
  }

  // Refresh the token
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Google token refresh failed: ${errBody}`)
  }

  const tokens = await response.json()
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase
    .from('calendar_accounts')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq('user_id', userId)

  return tokens.access_token
}

/**
 * Fetch events for a date from ALL calendars the user has access to.
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 */
export async function getCalendarEvents(userId, dateStr) {
  const accessToken = await getValidAccessToken(userId)

  const { data: user } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()

  const timezone = user?.timezone || 'America/New_York'
  const startUtc = localToUtcIso(`${dateStr}T00:00:00`, timezone)
  const endUtc   = localToUtcIso(`${dateStr}T23:59:59`, timezone)

  // ── 1. Get the user's full calendar list ─────────────────────────────────
  let calendarIds = ['primary']
  try {
    const listRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (listRes.ok) {
      const listData = await listRes.json()
      const ids = (listData.items || [])
        .filter((c) => c.selected !== false && c.accessRole !== 'none')
        .map((c) => c.id)
      if (ids.length > 0) calendarIds = ids
    }
  } catch {
    // fall back to primary only
  }

  // ── 2. Fetch from every calendar in parallel ──────────────────────────────
  const results = await Promise.allSettled(
    calendarIds.map((id) => fetchFromCalendar(accessToken, id, startUtc, endUtc))
  )

  const rawItems = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)

  // ── 3. Deduplicate by event ID ────────────────────────────────────────────
  const seen = new Set()
  const unique = rawItems.filter((item) => {
    if (!item.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  // ── 4. Normalize, filter cancelled, sort ─────────────────────────────────
  return unique
    .filter((e) => e.status !== 'cancelled')
    .map(normalizeGoogleEvent)
    .sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1
      if (!a.isAllDay && b.isAllDay) return 1
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
}

/**
 * Fetch events from a single calendar for the given UTC time window.
 */
async function fetchFromCalendar(accessToken, calendarId, startUtc, endUtc) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  )
  url.searchParams.set('timeMin', startUtc)
  url.searchParams.set('timeMax', endUtc)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '50')
  url.searchParams.set(
    'fields',
    'items(id,summary,start,end,location,description,hangoutLink,conferenceData,status)'
  )

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

/**
 * Normalize a raw Google Calendar event object to the app's camelCase shape.
 */
function normalizeGoogleEvent(event) {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)
  const strippedNotes = (event.description || '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 500)

  const meetingUrl =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ||
    null

  return {
    msEventId: event.id,
    title: event.summary || '(No title)',
    startTime: event.start?.dateTime || event.start?.date || null,
    endTime: event.end?.dateTime || event.end?.date || null,
    isAllDay,
    location: event.location || null,
    notes: strippedNotes || null,
    isOnlineMeeting: !!(event.hangoutLink || event.conferenceData),
    meetingUrl,
  }
}

/**
 * Convert a "YYYY-MM-DDTHH:MM:SS" local string to UTC ISO 8601
 * by looking up the timezone offset via Intl.
 */
function localToUtcIso(localDt, timezone) {
  try {
    const naiveDate = new Date(localDt + 'Z')
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(naiveDate)
    const offsetStr = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+0'
    const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!match) return naiveDate.toISOString()

    const sign = match[1] === '+' ? 1 : -1
    const offsetMs = sign * (parseInt(match[2], 10) * 60 + parseInt(match[3] || '0', 10)) * 60000
    return new Date(new Date(localDt).getTime() - offsetMs).toISOString()
  } catch {
    return new Date(localDt).toISOString()
  }
}
