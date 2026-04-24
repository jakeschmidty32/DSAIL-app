import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

export function useAuth() {
  const [state, setState] = useState({
    user: null,
    calendarConnected: false,
    spotifyConnected: false,
    loading: true,
  })

  async function refetch() {
    try {
      const data = await api.auth.me()
      setState({
        user: data.user,
        calendarConnected: data.calendarConnected,
        spotifyConnected: data.spotifyConnected ?? false,
        loading: false,
      })
    } catch {
      setState({ user: null, calendarConnected: false, spotifyConnected: false, loading: false })
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  return { ...state, refetch }
}
