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
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 w-full text-center px-6">
        <h1
          className="font-optima font-bold text-white mb-10 whitespace-nowrap"
          style={{ fontSize: 'clamp(2.4rem, 7vw, 6rem)', letterSpacing: '0.02em', lineHeight: 1.1 }}
        >
          Each Day — Remembered
        </h1>
        <a
          href="/api/auth/connect"
          className="inline-flex items-center gap-3 bg-white border border-gray-200 text-gray-700 px-5 py-3 rounded-xl font-medium hover:bg-gray-50 shadow-sm transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>
      </div>
    </div>
  )
}

// ── Main app shell ─────────────────────────────────────────────────────────────
export default function App() {
  const { user, calendarConnected, loading, refetch } = useAuth()

  const [view, setView] = useState('calendar')
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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

  // Stay in day view but change the date (for prev/next navigation)
  const navigateDay = useCallback((dateStr) => {
    setSelectedDate(dateStr)
  }, [])

  const handleSearchResult = useCallback((dateStr) => {
    setShowSearch(false)
    openDay(dateStr)
  }, [openDay])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f17' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: 'rgba(180,180,210,0.5)' }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  // ── Shared icon buttons ──────────────────────────────────────────────────────
  const iconBtnCls = 'p-2 rounded-lg transition-colors'
  const iconBtnStyle = { color: 'rgba(160,160,200,0.6)' }

  // ── Calendar view — full-screen, no scroll ───────────────────────────────────
  if (view === 'calendar') {
    return (
      <div className="flex flex-col" style={{ height: '100vh', background: '#0f0f17', overflow: 'hidden' }}>
        {/* Header */}
        <header
          className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ background: '#13131e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="font-optima font-bold tracking-wide"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)', color: 'rgba(230,230,255,0.92)', letterSpacing: '0.03em' }}
          >
            Each Day — Remembered
          </span>

          <div className="flex-1" />

          <button
            onClick={() => setShowSearch(true)}
            className={iconBtnCls}
            style={iconBtnStyle}
            title="Search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className={iconBtnCls}
            style={iconBtnStyle}
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        {/* Calendar fills remaining height */}
        <div className="flex-1 min-h-0">
          <CalendarView
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            onSelectDate={openDay}
            selectedDate={selectedDate}
          />
        </div>

        {showSearch && <SearchBar onResult={handleSearchResult} onClose={() => setShowSearch(false)} />}
        {showSettings && <Settings user={user} calendarConnected={calendarConnected} onClose={() => setShowSettings(false)} onSaved={refetch} />}
      </div>
    )
  }

  // ── Day view ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f17' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3"
        style={{ background: '#13131e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={goToCalendar}
          className="flex items-center gap-1 text-sm font-medium transition-colors"
          style={{ color: 'rgba(129,140,248,0.9)' }}
        >
          ← Calendar
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setShowSearch(true)}
          className={iconBtnCls}
          style={iconBtnStyle}
          title="Search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className={iconBtnCls}
          style={iconBtnStyle}
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      <DayPage
        date={selectedDate}
        user={user}
        calendarConnected={calendarConnected}
        onBack={goToCalendar}
        onNavigate={navigateDay}
      />

      {showSearch && <SearchBar onResult={handleSearchResult} onClose={() => setShowSearch(false)} />}
      {showSettings && <Settings user={user} calendarConnected={calendarConnected} onClose={() => setShowSettings(false)} onSaved={refetch} />}
    </div>
  )
}
