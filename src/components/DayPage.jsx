import { useJournalDay } from '../hooks/useJournalDay.js'
import { formatDisplay, fromDateStr, isToday, toDateStr } from '../lib/dates.js'
import { QuoteSection } from './QuoteSection.jsx'
import { WeatherCard } from './WeatherCard.jsx'
import { EventTimeline } from './EventTimeline.jsx'
import { NewsSection } from './NewsSection.jsx'
import { NotesSection } from './NotesSection.jsx'

function SectionCard({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function DayPage({ date, user, calendarConnected, onBack }) {
  const {
    loading,
    error,
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
    refresh,
    addNote,
    updateNote,
    deleteNote,
    pinNote,
    selectHeadline,
    saveQuote,
    refreshCalendar,
  } = useJournalDay(date)

  const dateObj = fromDateStr(date)
  const todayFlag = isToday(dateObj)
  const locationSet =
    weatherError !== 'no_location' && (weather !== null || weatherLoading)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors duration-150 text-sm font-medium shrink-0"
            aria-label="Go back"
          >
            ← Back
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {formatDisplay(dateObj)}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {todayFlag && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                Today
              </span>
            )}
            <button
              onClick={refresh}
              title="Refresh all data"
              className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors duration-150 text-sm"
              aria-label="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Quote */}
        <SectionCard title="Quote">
          <QuoteSection
            quote={quote}
            loading={loading}
            onSave={saveQuote}
          />
        </SectionCard>

        {/* Weather + Events — side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Weather">
            <WeatherCard
              weather={weather}
              loading={weatherLoading}
              locationSet={locationSet}
            />
          </SectionCard>

          <SectionCard title="Events">
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <EventTimeline
                events={events}
                loading={eventsLoading}
                calendarConnected={calendarConnected}
                onRefresh={refreshCalendar}
              />
            </div>
          </SectionCard>
        </div>

        {/* News */}
        <SectionCard title="Headlines">
          <NewsSection
            headlines={headlines}
            selectedHeadlineId={selectedHeadlineId}
            loading={headlinesLoading}
            onSelect={selectHeadline}
            date={date}
          />
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Notes">
          <NotesSection
            notes={notes}
            loading={notesLoading}
            date={date}
            onAdd={addNote}
            onUpdate={updateNote}
            onDelete={deleteNote}
            onPin={pinNote}
          />
        </SectionCard>
      </main>
    </div>
  )
}
