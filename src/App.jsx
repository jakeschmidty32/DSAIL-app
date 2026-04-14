import { useState, useCallback } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { toDateStr } from './lib/dates.js'
import { CalendarView } from './components/CalendarView.jsx'
import { DayPage } from './components/DayPage.jsx'
import { SearchBar } from './components/SearchBar.jsx'
import { Settings } from './components/Settings.jsx'

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">📔</div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Each Day</h1>
        <p className="text-indigo-500 font-medium mb-6 tracking-wide text-sm uppercase">— Remembered</p>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          Your personal daily journal — capturing events, weather, news, and memories
          in one place.
        </p>
        <a
          href="/api/auth/connect"
          className="inline-flex items-center gap-3 bg-white border border-gray-200 text-gray-700 px-5 py-3 rounded-xl font-medium hover:bg-gray-50 shadow-sm transition-colors"
        >
          {/* Google "G" logo */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>
        <p className="text-xs text-gray-400 mt-4">
          Connects to your Google Calendar. Only reads events — never writes.
        </p>
      </div>
    </div>
  )
}

// ── Main app shell ─────────────────────────────────────────────────────────────
export default function App() {
  const { user, calendarConnected, loading, refetch } = useAuth()

  // Navigation state
  const [view, setView] = useState('calendar') // 'calendar' | 'day'
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Check if we returned from OAuth callback
  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.get('connected') === 'true' && !loading) {
    window.history.replaceState({}, '', '/')
  }

  const openDay = useCallback((dateStr) => {
    setSelectedDate(dateStr)
    setView('day')
  }, [])

  const goToCalendar = useCallback(() => {
    setView('calendar')
  }, [])

  const handleSearchResult = useCallback((dateStr) => {
    setShowSearch(false)
    openDay(dateStr)
  }, [openDay])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        {view === 'day' ? (
          <button
            onClick={goToCalendar}
            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-medium"
          >
            ← Calendar
          </button>
        ) : (
          <span className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span>📔</span> Each Day
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setShowSearch(true)}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {view === 'calendar' ? (
          <CalendarView
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            onSelectDate={openDay}
            selectedDate={selectedDate}
          />
        ) : (
          <DayPage
            date={selectedDate}
            user={user}
            calendarConnected={calendarConnected}
            onBack={goToCalendar}
          />
        )}
      </main>

      {/* ── Overlays ── */}
      {showSearch && (
        <SearchBar
          onResult={handleSearchResult}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showSettings && (
        <Settings
          user={user}
          calendarConnected={calendarConnected}
          onClose={() => setShowSettings(false)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
