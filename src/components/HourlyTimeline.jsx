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

function EventChip({ event, onDelete }) {
  const [confirm, setConfirm] = useState(false)
  const start = event.startTime ? formatTime(event.startTime) : ''
  const end = event.endTime ? formatTime(event.endTime) : ''
  return (
    <div className="mb-1.5 pl-2 border-l-2 border-indigo-400 group relative">
      <p className="font-journal text-sm leading-snug" style={{ color: 'rgba(220,220,240,0.9)' }}>{event.title}</p>
      {(start || end) && (
        <p className="text-xs" style={{ color: 'rgba(150,150,180,0.7)' }}>{start}{end ? ` – ${end}` : ''}</p>
      )}
      {event.location && <p className="text-xs italic" style={{ color: 'rgba(150,150,180,0.7)' }}>📍 {event.location}</p>}
      {event.isOnlineMeeting && event.meetingUrl && (
        <a href={event.meetingUrl} target="_blank" rel="noopener noreferrer"
           className="text-xs text-indigo-400 hover:underline">Join meeting →</a>
      )}
      {/* Delete button */}
      {onDelete && (
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {confirm ? (
            <>
              <button onClick={() => onDelete(event.id)} className="text-xs text-red-400">Remove</button>
              <button onClick={() => setConfirm(false)} className="text-xs" style={{ color: 'rgba(150,150,180,0.7)' }}>Keep</button>
            </>
          ) : (
            <button onClick={() => setConfirm(true)} className="text-xs" style={{ color: 'rgba(150,150,180,0.4)' }} title="Remove from journal">✕</button>
          )}
        </div>
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
    <div className={`mb-1.5 pl-2 border-l-2 group ${note.isPinned ? 'border-amber-400' : 'border-white/20'}`}>
      {editing ? (
        <div className="space-y-1">
          <textarea value={val} onChange={e => setVal(e.target.value)} rows={2}
            className="w-full text-xs rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(220,220,240,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
            autoFocus />
          <div className="flex gap-2">
            <button onClick={save} className="text-xs text-indigo-400 hover:underline">Save</button>
            <button onClick={() => { setVal(note.content); setEditing(false) }} className="text-xs" style={{ color: 'rgba(150,150,180,0.6)' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <p className="font-journal text-sm leading-snug flex-1 whitespace-pre-wrap" style={{ color: 'rgba(210,210,235,0.85)' }}>{note.content}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onPin(note.id, !note.isPinned)} className="text-xs text-amber-400/50 hover:text-amber-400" title="Pin">📌</button>
            <button onClick={() => setEditing(true)} className="text-xs hover:text-indigo-400" style={{ color: 'rgba(150,150,180,0.5)' }} title="Edit">✏️</button>
            {confirm
              ? <><button onClick={() => onDelete(note.id)} className="text-xs text-red-400">Yes</button><button onClick={() => setConfirm(false)} className="text-xs" style={{ color: 'rgba(150,150,180,0.5)' }}>No</button></>
              : <button onClick={() => setConfirm(true)} className="text-xs hover:text-red-400" style={{ color: 'rgba(150,150,180,0.4)' }} title="Delete">🗑️</button>
            }
          </div>
        </div>
      )}
      {note.isVoice && <span className="text-xs text-purple-400">🎤</span>}
    </div>
  )
}

function AddNoteInline({ onAdd, targetHour }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { listening, transcript, startListening, stopListening, supported } = useVoice(result => setText(result))

  async function submit(isVoice = false) {
    const content = (isVoice ? transcript : text).trim()
    if (!content) return
    await onAdd(content, isVoice, targetHour)
    setText('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs transition-colors leading-none mt-0.5"
        style={{ color: 'rgba(120,120,160,0.5)' }}
        onMouseEnter={e => e.target.style.color = 'rgba(129,140,248,0.8)'}
        onMouseLeave={e => e.target.style.color = 'rgba(120,120,160,0.5)'}>
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
        className="w-full text-xs rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(220,220,240,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() } }}
      />
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => submit(false)} disabled={!text.trim()}
          className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded hover:bg-indigo-700 disabled:opacity-40">Add</button>
        {supported && (
          <button onClick={listening ? () => { stopListening(); if (transcript) submit(true) } : startListening}
            className={`text-xs px-2.5 py-1 rounded border ${listening ? 'border-red-500/50 text-red-400' : 'text-slate-400 border-white/15 hover:border-white/25'}`}>
            {listening ? <><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" />Stop</> : '🎤'}
          </button>
        )}
        <button onClick={() => { setOpen(false); setText('') }}
          className="text-xs" style={{ color: 'rgba(150,150,180,0.5)' }}>Cancel</button>
      </div>
    </div>
  )
}

export function HourlyTimeline({ events, notes, eventsLoading, notesLoading, calendarConnected,
                                  onAdd, onUpdate, onDelete, onPin, onDeleteEvent, onRefresh }) {
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
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-journal"
              style={{ background: 'rgba(99,102,241,0.15)', color: 'rgba(165,170,255,0.9)', border: '1px solid rgba(99,102,241,0.25)' }}>
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
            <div key={i} className="h-8 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {HOURS.map(h => {
            const hourEvents = eventsByHour[h] || []
            const hourNotes = notesByHour[h] || []
            const isEmpty = hourEvents.length === 0 && hourNotes.length === 0
            return (
              <div key={h} className={`flex gap-3 py-2 min-h-[2.5rem] transition-opacity ${isEmpty ? 'opacity-40 hover:opacity-100' : ''}`}>
                {/* Time label */}
                <div className="w-16 shrink-0 text-right pt-0.5">
                  <span className="font-journal text-xs" style={{ color: 'rgba(120,120,160,0.6)' }}>{hourLabel(h)}</span>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {hourEvents.map(e => <EventChip key={e.id || e.msEventId} event={e} onDelete={onDeleteEvent} />)}
                  {hourNotes.map(n => (
                    <NoteChip key={n.id} note={n} onUpdate={onUpdate} onDelete={onDelete} onPin={onPin} />
                  ))}
                  <AddNoteInline onAdd={(content, isVoice, hour) => onAdd(content, isVoice, hour)} targetHour={h} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Refresh calendar button */}
      {calendarConnected && onRefresh && (
        <button onClick={onRefresh}
          className="mt-3 text-xs transition-colors"
          style={{ color: 'rgba(120,120,160,0.5)' }}>
          ↻ Refresh calendar
        </button>
      )}
    </div>
  )
}
