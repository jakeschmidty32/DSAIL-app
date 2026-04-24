import { useJournalDay } from '../hooks/useJournalDay.js'
import { fromDateStr, isToday, format } from '../lib/dates.js'
import { QuoteSection } from './QuoteSection.jsx'
import { WeatherCard } from './WeatherCard.jsx'
import { MarketCard } from './MarketCard.jsx'
import { NewsSection } from './NewsSection.jsx'
import { HourlyTimeline } from './HourlyTimeline.jsx'
import { SpotifySection } from './SpotifySection.jsx'

// ── Colour palette (shared) ────────────────────────────────────────────────────
const C = {
  bg: '#0f0f17',
  divider: 'rgba(255,255,255,0.07)',
  textPrimary: 'rgba(225,225,245,0.92)',
  textMuted: 'rgba(130,130,170,0.7)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-4 mt-10 mb-4">
      <span
        className="font-optima font-bold text-lg tracking-widest uppercase shrink-0"
        style={{ color: 'rgba(210,215,245,0.88)' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: C.divider }} />
    </div>
  )
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function DayPage({ date, user, calendarConnected, spotifyConnected, onBack, onNavigate }) {
  const {
    loading,
    events,
    eventsLoading,
    weather,
    weatherLoading,
    weatherError,
    headlines,
    headlinesLoading,
    selectedHeadlineId,
    notes,
    notesLoading,
    quote,
    addNote,
    updateNote,
    deleteNote,
    pinNote,
    deleteEvent,
    selectHeadline,
    saveQuote,
    refreshCalendar,
  } = useJournalDay(date)

  const dateObj = fromDateStr(date)
  const todayFlag = isToday(dateObj)
  const locationSet = weatherError !== 'no_location' && (weather !== null || weatherLoading)

  const prevDate = addDays(date, -1)
  const nextDate = addDays(date, 1)

  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 57px)' }}>
      <div className="max-w-7xl mx-auto px-8 pb-24">

        {/* ── Day navigation ── */}
        <div className="flex items-center justify-between pt-5 pb-3">
          <button
            onClick={() => onNavigate?.(prevDate)}
            className="flex items-center gap-1 text-sm transition-colors px-2 py-1 rounded-lg"
            style={{ color: C.textMuted }}
          >
            ‹ <span className="hidden sm:inline font-optima">{format(new Date(prevDate + 'T12:00:00Z'), 'MMM d')}</span>
          </button>

          {/* Date header */}
          <div className="text-center flex-1 px-2">
            <p
              className="font-optima text-sm tracking-widest uppercase"
              style={{ color: C.textMuted, letterSpacing: '0.12em' }}
            >
              {format(dateObj, 'EEEE')}
            </p>
            <h1
              className="font-optima font-bold"
              style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: C.textPrimary, lineHeight: 1.15, letterSpacing: '0.01em' }}
            >
              {format(dateObj, 'MMMM d, yyyy')}
            </h1>
            {todayFlag && (
              <span
                className="mt-1 inline-block text-xs tracking-widest uppercase font-medium"
                style={{ color: 'rgba(129,140,248,0.7)' }}
              >
                Today
              </span>
            )}
          </div>

          <button
            onClick={() => onNavigate?.(nextDate)}
            className="flex items-center gap-1 text-sm transition-colors px-2 py-1 rounded-lg"
            style={{ color: C.textMuted }}
          >
            <span className="hidden sm:inline font-optima">{format(new Date(nextDate + 'T12:00:00Z'), 'MMM d')}</span> ›
          </button>
        </div>

        {/* ── Weather + Market side by side ── */}
        <div
          className="grid grid-cols-2 gap-4 rounded-xl p-4 mb-2"
          style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}
        >
          <div style={{ borderRight: `1px solid ${C.divider}`, paddingRight: '1rem' }}>
            <WeatherCard weather={weather} loading={weatherLoading} locationSet={locationSet} dark />
          </div>
          <div>
            <MarketCard date={date} />
          </div>
        </div>

        {/* ── Calendar + Notes (hourly timeline) ── */}
        <SectionDivider label="Calendar" />
        <HourlyTimeline
          events={events}
          notes={notes}
          eventsLoading={eventsLoading}
          notesLoading={notesLoading}
          calendarConnected={calendarConnected}
          onAdd={addNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onPin={pinNote}
          onDeleteEvent={deleteEvent}
          onRefresh={refreshCalendar}
        />

        {/* ── Top Headline ── */}
        <SectionDivider label="Top Headline" />
        <NewsSection
          headlines={headlines}
          selectedHeadlineId={selectedHeadlineId}
          loading={headlinesLoading}
          onSelect={selectHeadline}
          date={date}
        />

        {/* ── Spotify ── */}
        <SectionDivider label="Listening" />
        <SpotifySection date={date} spotifyConnected={spotifyConnected} />

        {/* ── Quote — at the very bottom ── */}
        <SectionDivider label="Quote" />
        <QuoteSection quote={quote} loading={loading} onSave={saveQuote} />

      </div>
    </div>
  )
}
