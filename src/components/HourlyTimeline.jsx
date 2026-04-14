import { useState } from 'react'
import { useVoice } from '../hooks/useVoice.js'
import { formatTime } from '../lib/dates.js'

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6 AM through 10 PM

function hourLabel(h) {
  if (h === 0) return '12:00 AM'
  if (h === 12) return '12:00 PM'
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`
}

function getEventHour(startTime) {
  if (!startTime) return null
  const d = new Date(startTime)
  return isNaN(d.getTime()) ? null : d.getHours()
}

function getNoteHour(createdAt) {
  if (!createdAt) return null
  const d = new Date(createdAt)
  return isNaN(d.getTime()) ? null : d.getHours()
}

function EventChip({ event }) {
  const start = event.startTime ? formatTime(event.startTime) : ''
  const end = event.endTime ? formatTime(event.endTime) : ''
  return (
    <div className="mb-1.5 pl-2 border-l-2 border-indigo-300">
      <p className="font-journal text-sm text-stone-800 leading-snug">{event.title}</p>
      {(start || end) && (
        <p className="text-xs text-stone-400">{start}{end ? ` – ${end}` : ''}</p>
      )}
      {event.location && <p className="text-xs text-stone-400 italic">📍 {event.location}</p>}
      {event.isOnlineMeeting && event.meetingUrl && (
        <a href={event.meetingUrl} target="_blank" rel="noopener noreferrer"
           className="text-xs text-indigo-500 hover:underline">Join meeting →</a>
      )}
    </div>
  )
}

function NoteChip({ note, onUpdate, onDelete, onPin }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note.content)
  const [confirm, setConfirm] = useState(false)

  async function save() {
    if (val.trim()) { await onUpdate(note.id, { content: val.trim() }); setEditing(false) }
  }

  return (
    <div className={`mb-1.5 pl-2 border-l-2 ${note.isPinned ? 'border-amber-400' : 'border-stone-200'} group`}>
      {editing ? (
        <div className="space-y-1">
          <textarea value={val} onChange={e => setVal(e.target.value)} rows={2}
            className="w-full text-xs border border-stone-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400" autoFocus />
          <div className="flex gap-2">
            <button onClick={save} className="text-xs text-indigo-600 hover:underline">Save</button>
            <button onClick={() => { setVal(note.content); setEditing(false) }} className="text-xs text-stone-400 hover:underline">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <p className="font-journal text-sm text-stone-700 leading-snug flex-1 whitespace-pre-wrap">{note.content}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onPin(note.id, !note.isPinned)} className="text-xs text-stone-300 hover:text-amber-500" title="Pin">📌</button>
            <button onClick={() => setEditing(true)} className="text-xs text-stone-300 hover:text-stone-600" title="Edit">✏️</button>
            {confirm
              ? <><button onClick={() => onDelete(note.id)} className="text-xs text-red-500">Yes</button><button onClick={() => setConfirm(false)} className="text-xs text-stone-400">No</button></>
              : <button onClick={() => setConfirm(true)} className="text-xs text-stone-300 hover:text-red-400" title="Delete">🗑️</button>
            }
          </div>
        </div>
      )}
      {note.isVoice && <span className="text-xs text-purple-400">🎤</span>}
    </div>
  )
}

function AddNoteInline({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { listening, transcript, startListening, stopListening, supported } = useVoice(result => setText(result))

  async function submit(isVoice = false) {
    const content = (isVoice ? transcript : text).trim()
    if (!content) return
    await onAdd(content, isVoice)
    setText('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-stone-300 hover:text-indigo-400 transition-colors leading-none mt-0.5">
        + note
      </button>
    )
  }

  return (
    <div className="mt-1 space-y-1">
      <textarea
        value={listening ? (transcript || text) : text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder="Write a note…"
        autoFocus
        className="w-full text-xs border border-stone-200 rounded p-1.5 resize-none bg-white/80 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() } }}
      />
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => submit(false)} disabled={!text.trim()}
          className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded hover:bg-indigo-700 disabled:opacity-40">Add</button>
        {supported && (
          <button onClick={listening ? () => { stopListening(); if (transcript) submit(true) } : startListening}
            className={`text-xs px-2.5 py-1 rounded border ${listening ? 'bg-red-50 text-red-600 border-red-200' : 'text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
            {listening ? <><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" />Stop</> : '🎤'}
          </button>
        )}
        <button onClick={() => { setOpen(false); setText('') }}
          className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
        <span className="text-xs text-stone-300 self-center hidden sm:inline">⌘↵ to add</span>
      </div>
    </div>
  )
}

export function HourlyTimeline({ events, notes, eventsLoading, notesLoading, calendarConnected,
                                  onAdd, onUpdate, onDelete, onPin, onRefresh }) {
  // Group timed events by their start hour
  const eventsByHour = {}
  const allDayEvents = []
  events.forEach(e => {
    if (e.isAllDay) { allDayEvents.push(e); return }
    const h = getEventHour(e.startTime)
    if (h !== null) {
      if (!eventsByHour[h]) eventsByHour[h] = []
      eventsByHour[h].push(e)
    }
  })

  // Group notes by their creation hour
  const notesByHour = {}
  notes.forEach(n => {
    const h = getNoteHour(n.createdAt)
    if (h !== null) {
      if (!notesByHour[h]) notesByHour[h] = []
      notesByHour[h].push(n)
    }
  })

  const loading = eventsLoading || notesLoading

  return (
    <div>
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allDayEvents.map(e => (
            <span key={e.id || e.msEventId}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200 font-journal">
              {e.title}
            </span>
          ))}
        </div>
      )}

      {!calendarConnected && (
        <p className="font-journal text-xs text-stone-400 italic mb-4">
          <a href="/api/auth/connect" className="text-indigo-500 hover:underline">Connect Google Calendar</a> to see events here.
        </p>
      )}

      {/* Hour rows */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-stone-100 animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {HOURS.map(h => {
            const hourEvents = eventsByHour[h] || []
            const hourNotes = notesByHour[h] || []
            const isEmpty = hourEvents.length === 0 && hourNotes.length === 0
            return (
              <div key={h} className={`flex gap-3 py-2 min-h-[2.5rem] ${isEmpty ? 'opacity-60 hover:opacity-100' : ''} transition-opacity`}>
                {/* Time label */}
                <div className="w-16 shrink-0 text-right pt-0.5">
                  <span className="font-journal text-xs text-stone-400">{hourLabel(h)}</span>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {hourEvents.map(e => <EventChip key={e.id || e.msEventId} event={e} />)}
                  {hourNotes.map(n => (
                    <NoteChip key={n.id} note={n} onUpdate={onUpdate} onDelete={onDelete} onPin={onPin} />
                  ))}
                  <AddNoteInline onAdd={(content, isVoice) => onAdd(content, isVoice)} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Refresh calendar button */}
      {calendarConnected && onRefresh && (
        <button onClick={onRefresh}
          className="mt-3 text-xs text-stone-400 hover:text-indigo-500 transition-colors">
          ↻ Refresh calendar
        </button>
      )}
    </div>
  )
}
