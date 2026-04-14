import { useState } from 'react'
import { Skeleton } from './ui/Skeleton.jsx'

export function QuoteSection({ quote, loading, onSave }) {
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [saving, setSaving] = useState(false)

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
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-2">
        <Skeleton className="w-3/4 h-5" />
        <Skeleton className="w-1/3 h-3" />
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="rounded-xl border border-indigo-100 bg-white shadow-sm p-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter quote text…"
          rows={3}
          className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author (optional)"
          className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Save
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors duration-150"
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
          className="text-sm text-gray-400 hover:text-indigo-600 border border-dashed border-gray-200 hover:border-indigo-300 rounded-xl px-6 py-3 transition-colors duration-150"
        >
          + Add a quote for today
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 relative group">
      <blockquote className="text-base italic text-gray-700 leading-relaxed">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      {quote.author && (
        <p className="mt-2 text-sm text-gray-500 font-medium">— {quote.author}</p>
      )}
      <button
        onClick={openEdit}
        className="absolute top-3 right-3 text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all duration-150 text-sm"
        title="Edit quote"
      >
        ✏️
      </button>
    </div>
  )
}
