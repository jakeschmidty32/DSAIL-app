import { EmptyState } from './ui/EmptyState.jsx'
import { formatTime } from '../lib/dates.js'

function AllDayBadge({ event }) {
  return (
    <span
      key={event.id}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200"
    >
      {event.title}
    </span>
  )
}

function TimedEvent({ event }) {
  const start = event.startTime ? formatTime(event.startTime) : ''
  const end = event.endTime ? formatTime(event.endTime) : ''

  return (
    <div className="flex items-baseline gap-4 py-2 border-b border-stone-100 last:border-0">
      <span className="font-journal text-sm text-stone-400 w-20 shrink-0 text-right">
        {start}
      </span>
      <div className="flex-1">
        <span className="font-journal text-base text-stone-800">{event.title}</span>
        {event.location && (
          <span className="text-xs text-stone-400 ml-2">· {event.location}</span>
        )}
        {event.isOnlineMeeting && event.meetingUrl && (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-xs text-indigo-500 hover:underline"
          >
            Join →
          </a>
        )}
        {event.notes && (
          <p className="text-xs text-stone-400 mt-0.5 italic">
            {event.notes.slice(0, 120)}
          </p>
        )}
      </div>
      {end && <span className="text-xs text-stone-300 shrink-0">{end}</span>}
    </div>
  )
}

export function EventTimeline({ events, loading, calendarConnected, onRefresh }) {
  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-4 bg-stone-100 animate-pulse rounded ${i === 1 ? 'w-3/4' : 'w-full'}`}
          />
        ))}
      </div>
    )
  }

  if (!calendarConnected) {
    return (
      <EmptyState
        icon="📅"
        title="No calendar connected"
        description="Connect your Google Calendar to see events here."
        action={
          <a
            href="/api/auth/connect"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors duration-150"
          >
            Connect Google Calendar
          </a>
        }
      />
    )
  }

  const allDay = events.filter((e) => e.isAllDay)
  const timed = events.filter((e) => !e.isAllDay)

  if (events.length === 0) {
    return (
      <p className="font-journal text-stone-400 italic text-sm py-4">
        No events on this day.
      </p>
    )
  }

  return (
    <div>
      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {allDay.map((e) => (
            <AllDayBadge key={e.id} event={e} />
          ))}
        </div>
      )}

      {/* Timed events */}
      {timed.length > 0 && (
        <div>
          {timed.map((e) => (
            <TimedEvent key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
