import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

function formatTime(ms) {
  if (!ms) return '0m'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const LABEL_COLOR = 'rgba(160,160,200,0.6)'
const SECONDARY_COLOR = 'rgba(120,120,160,0.5)'
const PRIMARY_COLOR = 'rgba(225,225,245,0.92)'

export function SpotifyDailySummary({ date, spotifyConnected }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!spotifyConnected) return
    setLoading(true)
    setError(null)
    setSummary(null)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    api.spotify
      .day(date, tz)
      .then((data) => setSummary(data.summary ?? null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [date, spotifyConnected])

  if (!spotifyConnected) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {/* Spotify logo SVG */}
        <svg width="48" height="48" viewBox="0 0 168 168" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="84" cy="84" r="84" fill="#1DB954"/>
          <path d="M120.8 116.4c-1.6 2.6-4.9 3.4-7.5 1.8-20.5-12.5-46.3-15.4-76.7-8.4-2.9.7-5.8-1.1-6.5-4-.7-2.9 1.1-5.8 4-6.5 33.3-7.6 61.9-4.3 85.1 9.7 2.6 1.6 3.4 4.8 1.6 7.4zm10.2-22.7c-2 3.3-6.3 4.3-9.6 2.3-23.5-14.4-59.3-18.6-87-10.2-3.6 1.1-7.4-1-8.5-4.5-1.1-3.6 1-7.4 4.5-8.5 31.7-9.6 71.2-5 98.4 11.5 3.2 2 4.2 6.1 2.2 9.4zm.9-23.6C104.2 53.3 61 51.8 36 59.1c-4.3 1.3-8.8-1.1-10.1-5.3-1.3-4.3 1.1-8.8 5.3-10.1C59.3 35.2 106.5 37 134.3 55c3.8 2.3 5 7.3 2.7 11.1-2.2 3.8-7.2 5.1-11.1 2.8l-.8-.8z" fill="white"/>
        </svg>
        <p className="font-optima text-base" style={{ color: LABEL_COLOR }}>
          Connect Spotify to see what you listened to
        </p>
        <a
          href="/api/spotify/connect"
          className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ background: '#1db954', color: '#000' }}
        >
          Connect Spotify
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse h-5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', width: i === 0 ? '60%' : i === 1 ? '45%' : '35%' }}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm py-2" style={{ color: SECONDARY_COLOR }}>
        Could not load Spotify data.
      </p>
    )
  }

  if (!summary || (!summary.topSongName && !(summary.topSongs && summary.topSongs.length))) {
    return (
      <p className="text-sm py-2" style={{ color: SECONDARY_COLOR }}>
        🎵 No listening activity recorded for this day.
      </p>
    )
  }

  const {
    topSongName,
    topSongArtist,
    topSongAlbumArtUrl,
    topArtistName,
    topArtistImageUrl,
    totalListeningTimeMs,
  } = summary

  // Use topSongs array if present; fall back to single-song fields
  const topSongs = (summary.topSongs && summary.topSongs.length)
    ? summary.topSongs.slice(0, 3)
    : (topSongName
        ? [{ name: topSongName, artist: topSongArtist, albumArtUrl: topSongAlbumArtUrl }]
        : [])

  return (
    <div className="flex gap-6 items-start">
      {/* ── 3 song cards ── */}
      <div className="grid grid-cols-3 gap-5 flex-1 min-w-0">
        {topSongs.map((song, i) => (
          <div key={i} className="flex flex-col items-center gap-2 text-center min-w-0">
            {/* Album art */}
            {(song.albumArtUrl || song.topSongAlbumArtUrl) ? (
              <img
                src={song.albumArtUrl || song.topSongAlbumArtUrl}
                alt={song.name || song.topSongName}
                className="rounded-lg object-cover shrink-0"
                style={{ width: 96, height: 96 }}
              />
            ) : (
              <div
                className="rounded-lg shrink-0 flex items-center justify-center"
                style={{ width: 96, height: 96, background: 'rgba(255,255,255,0.06)' }}
              >
                <span style={{ fontSize: 36 }}>🎵</span>
              </div>
            )}
            {/* Song name */}
            <p
              className="font-optima font-semibold w-full truncate"
              style={{ color: PRIMARY_COLOR, fontSize: '0.95rem' }}
            >
              {song.name || song.topSongName}
            </p>
            {/* Artist name */}
            <p className="text-xs w-full truncate" style={{ color: SECONDARY_COLOR }}>
              {song.artist || song.topSongArtist}
            </p>
          </div>
        ))}
      </div>

      {/* ── Vertical divider ── */}
      <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.07)' }} />

      {/* ── Top artist + total time ── */}
      <div className="flex flex-col items-center gap-4 shrink-0" style={{ minWidth: '7rem' }}>
        {/* Artist image */}
        {topArtistName && (
          <>
            {topArtistImageUrl ? (
              <img
                src={topArtistImageUrl}
                alt={topArtistName}
                className="rounded-full object-cover shrink-0"
                style={{ width: 72, height: 72 }}
              />
            ) : (
              <div
                className="rounded-full shrink-0 flex items-center justify-center"
                style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.06)' }}
              >
                <span style={{ fontSize: 28 }}>🎤</span>
              </div>
            )}
            <p
              className="font-optima font-medium text-sm text-center"
              style={{ color: PRIMARY_COLOR }}
            >
              {topArtistName}
            </p>
          </>
        )}

        {/* Total listening time */}
        {totalListeningTimeMs != null && (
          <div className="flex flex-col items-center gap-0.5">
            <span
              className="font-optima font-bold"
              style={{ color: PRIMARY_COLOR, fontSize: '1.4rem', lineHeight: 1.1 }}
            >
              {formatTime(totalListeningTimeMs)}
            </span>
            <span className="text-xs" style={{ color: LABEL_COLOR }}>listened</span>
          </div>
        )}
      </div>
    </div>
  )
}
