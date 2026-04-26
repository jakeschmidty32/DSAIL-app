import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { toDateStr, startOfMonth, endOfMonth } from '../lib/dates.js'

export function useCalendarDays(month) {
  const [days, setDays] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!month) return
    setLoading(true)
    const start = toDateStr(startOfMonth(month))
    const end = toDateStr(endOfMonth(month))

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

    Promise.all([
      api.journal.list(start, end).catch(() => ({ days: [] })),
      api.spotify.month(start, end, tz).catch((err) => {
        console.error('[useCalendarDays] spotify/month failed:', err)
        return { dates: {} }
      }),
    ]).then(([journalData, spotifyData]) => {
      console.debug('[useCalendarDays] spotify dates received:', Object.keys(spotifyData.dates || {}))
      const map = {}

      // Seed from journal list
      ;(journalData.days || []).forEach((d) => {
        map[d.date] = { ...d }
      })

      // Merge Spotify album art — works for all dates, even those without journal entries
      const spotifyDates = spotifyData.dates || {}
      Object.entries(spotifyDates).forEach(([date, info]) => {
        if (!map[date]) map[date] = { date }
        map[date].albumArtUrl = info.albumArtUrl
      })

      setDays(map)
    }).finally(() => setLoading(false))
  }, [month?.getFullYear(), month?.getMonth()])

  return { days, loading }
}
