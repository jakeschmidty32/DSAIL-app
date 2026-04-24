import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function TrackRow({ track }) {
  const mins = track.durationMs ? Math.floor(track.durationMs / 60000) : null
  const secs = track.durationMs ? String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, '0') : null

  return (
    <div className="flex items-center gap-3 py-2 group">
      {track.albumImageUrl ? (
        <img
          src={track.albumImageUrl}
          alt={track.albumName}
          className="w-10 h-10 rounded-md flex-shrink-0 object-cover"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        />
      ) : (
        <div className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className="text-lg">🎵</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-optima font-semibold text-sm truncate" style={{ color: 'rgba(225,225,245,0.92)' }}>
          {track.trackName}
        </p>
        <p className="text-xs truncate" style={{ color: 'rgba(140,140,180,0.7)' }}>
          {track.artistName}
          {track.albumName && ` · ${track.albumName}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {mins !== null && (
          <span className="text-xs" style={{ color: 'rgba(100,100,140,0.6)' }}>
            {mins}:{secs}
          </span>
        )}
        {track.trackUrl && (
          <a
            href={track.trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: '#1db954' }}
          >
            ↗
          </a>
        )}
      </div>
    </div>
  )
}

export function SpotifySection({ date, spotifyConnected }) {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!spotifyConnected) return
    setLoading(true)
    setError(null)
    api.spotify.tracks(date)
      .then((d) => {
        setTracks(d.tracks || [])
        if (d.error === 'no_spotify') setError('no_spotify')
      })
      .catch(() => setError('fetch_failed'))
      .finally(() => setLoading(false))
  }, [date, spotifyConnected])

  if (!spotifyConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-3">
        <p className="text-sm" style={{ color: 'rgba(140,140,180,0.6)' }}>
          Connect Spotify to see what you listened to
        </p>
        <a
          href="/api/spotify/connect"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: '#1db954', color: '#000' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Connect Spotify
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-10 h-10 rounded-md animate-pulse flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 rounded animate-pulse w-3/4" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <div className="h-3 rounded animate-pulse w-1/2" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <p className="text-sm italic py-3 text-center" style={{ color: 'rgba(140,140,180,0.5)' }}>
        No Spotify listening history found for this date.
      </p>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      {tracks.map((track) => (
        <TrackRow key={track.trackId || track.id} track={track} />
      ))}
    </div>
  )
}
