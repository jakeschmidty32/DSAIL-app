import { useState, useRef } from 'react'
import { Skeleton } from './ui/Skeleton.jsx'
import { EmptyState } from './ui/EmptyState.jsx'
import { useVoice } from '../hooks/useVoice.js'
import { formatTime } from '../lib/dates.js'

function NoteCard({ note, onUpdate, onDelete, onPin }) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (!editContent.trim()) return
    await onUpdate(note.id, { content: editContent.trim() })
    setEditing(false)
  }

  function handleCancelEdit() {
    setEditContent(note.content)
    setEditing(false)
  }

  return (
    <div
      className={[
        'rounded-xl border bg-white shadow-sm p-4 transition-colors duration-150',
        note.isPinned ? 'border-indigo-100 bg-indigo-50/40' : 'border-gray-100',
      ].join(' ')}
    >
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors duration-150"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50 transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
            {note.content}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-gray-400 flex-1">
              {note.createdAt ? formatTime(note.createdAt) : ''}
            </span>
            {note.isVoice && (
              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                🎤 Voice
              </span>
            )}
            {note.isPinned && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                📌 Pinned
              </span>
            )}
            <button
              onClick={() => onPin(note.id, !note.isPinned)}
              title={note.isPinned ? 'Unpin' : 'Pin'}
              className="text-gray-400 hover:text-indigo-600 transition-colors duration-150 text-sm"
            >
              📌
            </button>
            <button
              onClick={() => setEditing(true)}
              title="Edit"
              className="text-gray-400 hover:text-gray-700 transition-colors duration-150 text-sm"
            >
              ✏️
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <span className="text-xs text-red-600">Delete?</span>
                <button
                  onClick={() => onDelete(note.id)}
                  className="text-xs text-red-600 font-medium hover:underline"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="text-gray-400 hover:text-red-500 transition-colors duration-150 text-sm"
              >
                🗑️
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function AddNoteArea({ onAdd }) {
  const [content, setContent] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef(null)

  const { listening, transcript, startListening, stopListening, supported } =
    useVoice((result) => {
      setContent((prev) => (prev ? `${prev} ${result}` : result))
    })

  async function submit() {
    const text = content.trim()
    if (!text) return
    await onAdd(text, false)
    setContent('')
    setFocused(false)
  }

  async function submitVoice() {
    const text = transcript.trim() || content.trim()
    if (!text) return
    await onAdd(text, true)
    setContent('')
    setFocused(false)
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      className={[
        'rounded-xl border bg-white shadow-sm transition-all duration-150',
        focused ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100',
      ].join(' ')}
    >
      <textarea
        ref={textareaRef}
        value={listening ? transcript || content : content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Add a note…"
        rows={focused ? 4 : 2}
        className="w-full p-4 text-sm text-gray-900 placeholder-gray-400 bg-transparent resize-none focus:outline-none"
      />
      {(focused || content) && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              submit()
            }}
            disabled={!content.trim() && !transcript.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Add
          </button>

          {supported && (
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                if (listening) {
                  stopListening()
                  if (transcript) submitVoice()
                } else {
                  startListening()
                }
              }}
              className={[
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                listening
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {listening ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Recording… tap to stop
                </>
              ) : (
                <>🎤 Voice</>
              )}
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400 hidden sm:block">
            ⌘↵ to add
          </span>
        </div>
      )}
    </div>
  )
}

export function NotesSection({ notes, loading, onAdd, onUpdate, onDelete, onPin }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-2"
          >
            <Skeleton className="w-full" />
            <Skeleton className="w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  return (
    <div className="space-y-3">
      <AddNoteArea onAdd={onAdd} />

      {sorted.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No notes yet"
          description="Add your first note for this day."
        />
      ) : (
        sorted.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onPin={onPin}
          />
        ))
      )}
    </div>
  )
}
