import { supabase } from './supabase.js'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * Get a valid Google access token for the user, refreshing if necessary.
 * @param {string} userId
 * @returns {Promise<string>} access token
 */
export async function getValidAccessToken(userId) {
  const { data: account, error } = await supabase
    .from('calendar_accounts')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single()

  if (error || !account) {
    throw new Error('No calendar account found for user')
  }

  const { access_token, refresh_token, token_expires_at } = account

  // Return current token if still valid (with 5-minute buffer)
  const expiresAt = new Date(token_expires_at).getTime()
  const bufferMs = 5 * 60 * 1000
  if (expiresAt - Date.now() > bufferMs) {
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

  const { error: updateError } = await supabase
    .from('calendar_accounts')
    .update({
      access_token: tokens.access_token,
      // Google only returns a new refresh_token if the old one is revoked
      refresh_token: tokens.refresh_token ?? refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq('user_id', userId)

  if (updateError) {
    throw new Error(`Failed to update tokens: ${updateError.message}`)
  }

  return tokens.access_token
}

/**
 * Fetch calendar events for a specific date from Google Calendar API.
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function getCalendarEvents(userId, dateStr) {
  const accessToken = await getValidAccessToken(userId)

  // Fetch user timezone to build correct time bounds
  const { data: user } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()

  const timezone = user?.timezone || 'America/Chicago'

  // Build start/end of day as full ISO 8601 strings with timezone
  // Google Calendar API requires RFC 3339 format (e.g. 2025-04-14T00:00:00-05:00)
  // Using the date boundaries in the user's local timezone
  const startOfDay = `${dateStr}T00:00:00`
  const endOfDay = `${dateStr}T23:59:59`

  // Convert to UTC using Intl to get the correct offset
  const startUtc = localToUtcIso(startOfDay, timezone)
  const endUtc = localToUtcIso(endOfDay, timezone)

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', startUtc)
  url.searchParams.set('timeMax', endUtc)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '50')
  url.searchParams.set(
    'fields',
    'items(id,summary,start,end,location,description,hangoutLink,conferenceData,status)'
  )

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Google Calendar fetch failed: ${errBody}`)
  }

  const data = await response.json()
  const items = data.items || []

  return items
    .filter((event) => event.status !== 'cancelled')
    .map((event) => {
      const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)
      const rawNotes = event.description || ''
      const strippedNotes = rawNotes.replace(/<[^>]*>/g, '').trim().slice(0, 500)

      const meetingUrl =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ||
        null

      return {
        msEventId: event.id, // stored in ms_event_id column (provider-agnostic ID)
        title: event.summary || '(No title)',
        startTime: event.start?.dateTime || event.start?.date || null,
        endTime: event.end?.dateTime || event.end?.date || null,
        isAllDay,
        location: event.location || null,
        notes: strippedNotes || null,
        isOnlineMeeting: !!(event.hangoutLink || event.conferenceData),
        meetingUrl,
      }
    })
}

/**
 * Convert a local datetime string to a UTC ISO 8601 string.
 * Uses Intl.DateTimeFormat to find the UTC offset for the given timezone.
 * @param {string} localDt - "YYYY-MM-DDTHH:MM:SS"
 * @param {string} timezone - IANA timezone name
 * @returns {string} UTC ISO 8601 string
 */
function localToUtcIso(localDt, timezone) {
  try {
    // Parse the local datetime as if it were UTC, then adjust by offset
    const naiveDate = new Date(localDt + 'Z')

    // Get the UTC offset for this timezone at this moment
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(naiveDate)
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'UTC+0'

    // Parse offset like "GMT-5" or "GMT+5:30"
    const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!match) return naiveDate.toISOString()

    const sign = match[1] === '+' ? 1 : -1
    const hours = parseInt(match[2], 10)
    const minutes = parseInt(match[3] || '0', 10)
    const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000

    const utcDate = new Date(new Date(localDt).getTime() - offsetMs)
    return utcDate.toISOString()
  } catch {
    // Fallback: treat as UTC
    return new Date(localDt).toISOString()
  }
}
