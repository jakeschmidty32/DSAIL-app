import { useState } from 'react'
import { useVoice } from '../hooks/useVoice.js'

const C = {
  textPrimary: 'rgba(220,220,245,0.88)',
  textMuted: 'rgba(130,130,170,0.7)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.1)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
}

export function QuoteSection({ quote, loading, onSave }) {
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [saving, setSaving] = useState(false)

  const { listening, transcript, startListening, stopListening, supported } = useVoice((result) => {
    setText(result)
  })

  function openEdit() {
    setText(quote?.text ?? '')
    setAuthor(quote?.author ?? '')
    setShowForm(true)
  }

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    try {
      await onSave(text.trim(), author.trim() || undefined)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 py-3">
        <div className="h-4 rounded w-3/4 animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="h-3 rounded w-1/3 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    )
  }

  if (showForm) {
    return (
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}
      >
        <textarea
          value={listening ? (transcript || text) : text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter quote text…"
          rows={3}
          className="w-full text-sm rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
          style={{ background: C.inputBg, color: C.textPrimary, border: `1px solid ${C.inputBorder}` }}
          autoFocus
        />
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author (optional)"
          className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          style={{ background: C.inputBg, color: C.textPrimary, border: `1px solid ${C.inputBorder}` }}
        />
        {supported && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={
              listening
                ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
                : { background: 'transparent', color: C.textMuted, border: `1px solid ${C.inputBorder}` }
            }
          >
            {listening ? (
              <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" /> Recording… tap to stop</>
            ) : (
              <>🎤 Dictate quote</>
            )}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: C.textMuted, border: `1px solid ${C.inputBorder}` }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex items-center justify-center py-6">
        <button
          onClick={() => setShowForm(true)}
          className="text-sm rounded-xl px-6 py-3 transition-colors"
          style={{ color: C.textMuted, border: `1px dashed rgba(255,255,255,0.15)` }}
        >
          + Add a quote for today
        </button>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5 relative group"
      style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}
    >
      <blockquote className="text-base italic leading-relaxed" style={{ color: C.textPrimary }}>
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      {quote.author && (
        <p className="mt-2 text-sm font-medium" style={{ color: C.textMuted }}>— {quote.author}</p>
      )}
      <button
        onClick={openEdit}
        className="absolute top-3 right-3 text-sm opacity-0 group-hover:opacity-100 transition-all"
        style={{ color: C.textMuted }}
        title="Edit quote"
      >
        ✏️
      </button>
    </div>
  )
}
