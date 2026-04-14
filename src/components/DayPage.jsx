import { useJournalDay } from '../hooks/useJournalDay.js'
import { fromDateStr, isToday, format } from '../lib/dates.js'
import { QuoteSection } from './QuoteSection.jsx'
import { WeatherCard } from './WeatherCard.jsx'
import { NewsSection } from './NewsSection.jsx'
import { HourlyTimeline } from './HourlyTimeline.jsx'

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-3">
      <span className="font-journal text-xs tracking-widest uppercase text-stone-400 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-stone-200" />
    </div>
  )
}

export function DayPage({ date, user, calendarConnected, onBack }) {
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
    selectHeadline,
    saveQuote,
    refreshCalendar,
  } = useJournalDay(date)

  const dateObj = fromDateStr(date)
  const todayFlag = isToday(dateObj)
  const locationSet =
    weatherError !== 'no_location' && (weather !== null || weatherLoading)

  return (
    <div>
      {/* Journal page body */}
      <div
        className="max-w-2xl mx-auto px-6 pb-20"
        style={{ backgroundColor: '#fdf8f0', minHeight: 'calc(100vh - 57px)' }}
      >
        {/* Date header */}
        <div className="text-center pt-8 pb-4 border-b border-stone-200 mb-2">
          <p className="font-cursive text-stone-400 text-lg tracking-wide">
            {format(dateObj, 'EEEE')}
          </p>
          <h1 className="font-cursive font-bold text-stone-800" style={{ fontSize: '3rem', lineHeight: 1.1 }}>
            {format(dateObj, 'MMMM d, yyyy')}
          </h1>
          {todayFlag && (
            <span className="mt-1 inline-block text-xs tracking-widest text-indigo-400 uppercase font-medium">Today</span>
          )}
        </div>

        {/* Weather — prominent, right under the date */}
        <WeatherCard weather={weather} loading={weatherLoading} locationSet={locationSet} />

        {/* Quote */}
        <QuoteSection quote={quote} loading={loading} onSave={saveQuote} />

        {/* Calendar + Notes (hourly timeline) */}
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
          onRefresh={refreshCalendar}
        />

        {/* Headlines */}
        <SectionDivider label="Headlines" />
        <NewsSection
          headlines={headlines}
          selectedHeadlineId={selectedHeadlineId}
          loading={headlinesLoading}
          onSelect={selectHeadline}
          date={date}
        />
      </div>
    </div>
  )
}
