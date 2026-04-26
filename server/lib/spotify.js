import { supabase } from './supabase.js'

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

export function normalizeSummary(row) {
  return {
    topSongName: row.top_song_name,
    topSongArtist: row.top_song_artist,
    topSongAlbumArtUrl: row.top_song_album_art_url,
    topArtistName: row.top_artist_name,
    topArtistImageUrl: row.top_artist_image_url,
    totalListeningTimeMs: row.total_listening_time_ms,
    topSongs: Array.isArray(row.top_songs) ? row.top_songs : [],
  }
}

export async function getValidToken(userId) {
  const { data: account } = await supabase
    .from('spotify_accounts')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!account) return null

  const expiresAt = new Date(account.token_expires_at)
  const bufferMs = 5 * 60 * 1000

  if (expiresAt.getTime() - Date.now() > bufferMs) {
    return account.access_token
  }

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

export function getDateInTz(isoStr, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoStr))
  } catch {
    return new Date(isoStr).toISOString().slice(0, 10)
  }
}

/**
 * Paginate backwards through recently-played tracks until we pass oldestAllowedMs.
 * Returns all items collected (may include some slightly before the range — filter after).
 */
export async function fetchRecentlyPlayedPaged(accessToken, beforeMs, oldestAllowedMs) {
  const allItems = []
  let cursor = beforeMs

  for (let page = 0; page < 15; page++) {
    const url = `https://api.spotify.com/v1/me/player/recently-played?limit=50&before=${cursor}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok) break

    const data = await resp.json()
    const items = data.items || []
    if (items.length === 0) break

    allItems.push(...items)

    const oldestInBatch = new Date(items[items.length - 1].played_at).getTime()
    if (oldestInBatch <= oldestAllowedMs) break

    cursor = oldestInBatch
  }

  return allItems
}

/**
 * Given a list of Spotify recently-played items, group by date in the user's timezone
 * and compute the per-day summary rows ready for upsert.
 */
export function buildDailySummariesFromItems(items, userId, timezone, start, end) {
  const tracksByDate = {}

  for (const item of items) {
    const d = getDateInTz(item.played_at, timezone)
    if (d < start || d > end) continue
    if (!tracksByDate[d]) tracksByDate[d] = []
    tracksByDate[d].push(item)
  }

  const rows = []

  for (const [date, dayItems] of Object.entries(tracksByDate)) {
    const trackPlays = new Map()
    const artistPlays = new Map()
    let totalMs = 0

    for (const item of dayItems) {
      const trackId = item.track.id
      const artistId = item.track.artists[0]?.id
      trackPlays.set(trackId, {
        count: (trackPlays.get(trackId)?.count ?? 0) + 1,
        track: item.track,
      })
      if (artistId) {
        artistPlays.set(artistId, {
          count: (artistPlays.get(artistId)?.count ?? 0) + 1,
          artist: item.track.artists[0],
        })
      }
      totalMs += item.track.duration_ms ?? 0
    }

    const topTrackEntry = [...trackPlays.values()].reduce((a, b) =>
      b.count > a.count ? b : a
    )
    const topArtistEntry = [...artistPlays.values()].reduce((a, b) =>
      b.count > a.count ? b : a,
      { count: 0, artist: { name: null } }
    )

    const topTrack = topTrackEntry.track
    const topArtist = topArtistEntry.artist

    const topSongs = [...trackPlays.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ track }) => ({
        name: track.name,
        artist: track.artists?.[0]?.name ?? null,
        albumArtUrl: track.album?.images?.[0]?.url ?? null,
      }))

    rows.push({
      user_id: userId,
      date,
      total_listening_time_ms: totalMs,
      top_song_name: topTrack.name ?? null,
      top_song_artist: topTrack.artists?.[0]?.name ?? null,
      top_song_album_art_url: topTrack.album?.images?.[0]?.url ?? null,
      top_artist_name: topArtist?.name ?? null,
      top_artist_image_url: null, // fetched on first day-page visit
      top_songs: topSongs,
    })
  }

  return rows
}

export async function getDailySummary(userId, date, timezone) {
  // Cache check
  const { data: cached } = await supabase
    .from('spotify_daily_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (cached) {
    // If we have a cached row but the artist image is missing and we have an artist name,
    // try to fetch the image now and upgrade the cache.
    if (cached.top_artist_name && !cached.top_artist_image_url) {
      const accessToken = await getValidToken(userId)
      if (accessToken) {
        try {
          // Search for the artist to get their ID, then fetch image
          const searchResp = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(cached.top_artist_name)}&type=artist&limit=1`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (searchResp.ok) {
            const searchData = await searchResp.json()
            const artist = searchData.artists?.items?.[0]
            if (artist?.images?.[0]?.url) {
              cached.top_artist_image_url = artist.images[0].url
              await supabase
                .from('spotify_daily_summary')
                .update({ top_artist_image_url: artist.images[0].url })
                .eq('user_id', userId)
                .eq('date', date)
            }
          }
        } catch {
          // best-effort
        }
      }
    }
    return { summary: normalizeSummary(cached), cached: true }
  }

  const accessToken = await getValidToken(userId)
  if (!accessToken) {
    return { error: 'no_token' }
  }

  // Fetch recently played — use a wide window (2 days past target) to capture full day in any tz
  const [y, m, d] = date.split('-').map(Number)
  const beforeMs = Date.UTC(y, m - 1, d + 2)

  const url = `https://api.spotify.com/v1/me/player/recently-played?limit=50&before=${beforeMs}`
  const spotResp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!spotResp.ok) {
    const errText = await spotResp.text()
    console.error('[Spotify] recently-played API error:', spotResp.status, errText)
    return { error: 'spotify_api_error' }
  }

  const spotData = await spotResp.json()
  const allItems = spotData.items ?? []
  console.log(`[Spotify] recently-played returned ${allItems.length} tracks for user ${userId}`)

  const items = allItems.filter(
    (item) => getDateInTz(item.played_at, timezone) === date
  )
  console.log(`[Spotify] ${items.length} tracks match date=${date} in timezone=${timezone}`)

  const emptyRow = {
    user_id: userId,
    date,
    total_listening_time_ms: 0,
    top_song_name: null,
    top_song_artist: null,
    top_song_album_art_url: null,
    top_artist_name: null,
    top_artist_image_url: null,
  }

  if (items.length === 0) {
    await supabase
      .from('spotify_daily_summary')
      .upsert(emptyRow, { onConflict: 'user_id,date' })
    return { summary: null, cached: false }
  }

  // Count plays per track and per artist
  const trackPlays = new Map()
  const artistPlays = new Map()
  let totalMs = 0

  for (const item of items) {
    const trackId = item.track.id
    const artistId = item.track.artists[0]?.id

    trackPlays.set(trackId, { count: (trackPlays.get(trackId)?.count ?? 0) + 1, track: item.track })
    if (artistId) {
      artistPlays.set(artistId, {
        count: (artistPlays.get(artistId)?.count ?? 0) + 1,
        artist: item.track.artists[0],
      })
    }
    totalMs += item.track.duration_ms ?? 0
  }

  const topTrackEntry = [...trackPlays.values()].reduce((a, b) => (b.count > a.count ? b : a))
  const topArtistEntry = [...artistPlays.values()].reduce((a, b) => (b.count > a.count ? b : a))

  const topTrack = topTrackEntry.track
  const topArtist = topArtistEntry.artist

  const topTracks = [...trackPlays.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ track }) => ({
      name: track.name,
      artist: track.artists?.[0]?.name ?? null,
      albumArtUrl: track.album?.images?.[0]?.url ?? null,
    }))

  // Fetch artist image
  let topArtistImageUrl = null
  try {
    const artistResp = await fetch(`https://api.spotify.com/v1/artists/${topArtist.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (artistResp.ok) {
      const artistData = await artistResp.json()
      topArtistImageUrl = artistData.images?.[0]?.url ?? null
    }
  } catch {
    // best-effort
  }

  const row = {
    user_id: userId,
    date,
    top_song_name: topTrack.name ?? null,
    top_song_artist: topTrack.artists?.[0]?.name ?? null,
    top_song_album_art_url: topTrack.album?.images?.[0]?.url ?? null,
    top_artist_name: topArtist.name ?? null,
    top_artist_image_url: topArtistImageUrl,
    total_listening_time_ms: totalMs,
    top_songs: topTracks,
  }

  await supabase
    .from('spotify_daily_summary')
    .upsert(row, { onConflict: 'user_id,date' })

  return { summary: normalizeSummary(row), cached: false }
}
