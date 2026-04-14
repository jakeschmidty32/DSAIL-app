import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

export function useAuth() {
  const [state, setState] = useState({
    user: null,
    calendarConnected: false,
    loading: true,
  })

  async function refetch() {
    try {
      const data = await api.auth.me()
      setState({
        user: data.user,
        calendarConnected: data.calendarConnected,
        loading: false,
      })
    } catch {
      setState({ user: null, calendarConnected: false, loading: false })
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  return { ...state, refetch }
}
