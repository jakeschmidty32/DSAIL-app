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
    api.journal
      .list(start, end)
      .then((data) => {
        const map = {}
        data.days.forEach((d) => {
          map[d.date] = d
        })
        setDays(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month?.getFullYear(), month?.getMonth()])

  return { days, loading }
}
