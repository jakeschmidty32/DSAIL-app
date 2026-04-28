// In production the frontend (Cloudflare Pages) and backend (Railway) are on
// different origins. VITE_API_URL lets the build point all /api calls at the
// Railway URL. In dev it's empty so the Vite proxy handles /api/* as usual.
const API_BASE = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status })
  }
  return res.json()
}

export const api = {
  auth: {
    me: () => apiFetch('/api/auth/me'),
    logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    register: (body) => apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  },
  calendar: {
    events: (date) => apiFetch(`/api/calendar/events?date=${date}`),
    refresh: (date) =>
      apiFetch(`/api/calendar/events/refresh?date=${date}`, { method: 'POST' }),
    deleteEvent: (id) => apiFetch(`/api/calendar/events/${id}`, { method: 'DELETE' }),
  },
  weather: {
    get: (date) => apiFetch(`/api/weather?date=${date}`),
  },
  news: {
    get: (date) => apiFetch(`/api/news?date=${date}`),
  },
  journal: {
    day: (date) => apiFetch(`/api/journal/${date}`),
    notes: (date) => apiFetch(`/api/journal/${date}/notes`),
    addNote: (date, body) =>
      apiFetch(`/api/journal/${date}/notes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateNote: (date, id, body) =>
      apiFetch(`/api/journal/${date}/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    deleteNote: (date, id) =>
      apiFetch(`/api/journal/${date}/notes/${id}`, { method: 'DELETE' }),
    selectHeadline: (date, headlineId) =>
      apiFetch(`/api/journal/${date}/headline`, {
        method: 'PUT',
        body: JSON.stringify({ headlineId }),
      }),
    saveQuote: (date, body) =>
      apiFetch(`/api/journal/${date}/quote`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    list: (start, end) =>
      apiFetch(`/api/journal/list?start=${start}&end=${end}`),
    search: (params) =>
      apiFetch(`/api/journal/search?${new URLSearchParams(params)}`),
  },
  market: {
    get: (date, tickers = '') => {
      const params = new URLSearchParams({ date })
      if (tickers) params.set('tickers', tickers)
      return apiFetch(`/api/market?${params.toString()}`)
    },
  },
  watchlist: {
    add: (ticker) => apiFetch('/api/watchlist', { method: 'POST', body: JSON.stringify({ ticker }) }),
  },
  spotify: {
    day: (date, tz) => apiFetch(`/api/spotify/day?date=${date}${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`),
    month: (start, end, tz) => apiFetch(`/api/spotify/month?start=${start}&end=${end}${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`),
    disconnect: () => apiFetch('/api/spotify/disconnect', { method: 'POST' }),
  },
  settings: {
    get: () => apiFetch('/api/settings'),
    update: (body) =>
      apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
    geocode: (city) =>
      apiFetch('/api/settings/geocode', {
        method: 'POST',
        body: JSON.stringify({ city }),
      }),
    saveLocation: (body) =>
      apiFetch('/api/settings/location', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
}
