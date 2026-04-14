import { Skeleton } from './ui/Skeleton.jsx'
import { EmptyState } from './ui/EmptyState.jsx'
import { formatTime } from '../lib/dates.js'

function AllDayBadge({ event }) {
  return (
    <span
      key={event.id}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
    >
      {event.title}
    </span>
  )
}

function TimedEvent({ event }) {
  const start = event.startTime ? formatTime(event.startTime) : ''
  const end = event.endTime ? formatTime(event.endTime) : ''
  const timeLabel = start && end ? `${start} – ${end}` : start

  return (
    <div className="flex gap-3 items-start">
      {/* Time column */}
      <div className="w-20 shrink-0 text-right pt-1">
        <span className="text-xs text-gray-400 leading-none">{start}</span>
      </div>

      {/* Vertical line + dot */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 shrink-0" />
        <div className="w-px flex-1 bg-gray-100 mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 mb-3 rounded-xl border border-gray-100 bg-white shadow-sm border-l-2 border-l-sky-300 pl-3 pr-3 py-2.5">
        <p className="font-semibold text-gray-900 text-sm leading-snug">
          {event.title}
        </p>
        {timeLabel && (
          <p className="text-xs text-gray-400 mt-0.5">{timeLabel}</p>
        )}
        {event.location && (
          <p className="text-xs text-gray-500 mt-1">
            📍 {event.location}
          </p>
        )}
        {event.isOnlineMeeting && event.meetingUrl && (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors duration-150"
          >
            Join meeting →
          </a>
        )}
        {event.notes && <EventNotes notes={event.notes} />}
      </div>
    </div>
  )
}

function EventNotes({ notes }) {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150"
      >
        {expanded ? 'Hide notes ▲' : 'Show notes ▼'}
      </button>
      {expanded && (
        <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{notes}</p>
      )}
    </div>
  )
}

import React from 'react'

export function EventTimeline({ events, loading, calendarConnected, onRefresh }) {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={i === 1 ? 'w-3/4' : 'w-full'} />
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
      <EmptyState
        icon="🗓️"
        title="No events on this day"
        description="Your calendar is clear."
        action={
          onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors duration-150"
            >
              Refresh
            </button>
          )
        }
      />
    )
  }

  return (
    <div>
      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl mb-3">
          {allDay.map((e) => (
            <AllDayBadge key={e.id} event={e} />
          ))}
        </div>
      )}

      {/* Timed events */}
      {timed.length > 0 && (
        <div className="px-1 pt-1">
          {timed.map((e) => (
            <TimedEvent key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
