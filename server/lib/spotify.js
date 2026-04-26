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

function getDateInTz(isoStr, tz) {
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

export async function getDailySummary(userId, date, timezone) {
  // Cache check
  const { data: cached } = await supabase
    .from('spotify_daily_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (cached) {
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
  allItems.slice(0, 5).forEach(item =>
    console.log(`  played_at=${item.played_at} → in tz=${getDateInTz(item.played_at, timezone)} | track="${item.track.name}"`)
  )

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
