import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api.js'
import { formatDisplay, fromDateStr } from '../lib/dates.js'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function SearchBar({ onResult, onClose }) {
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const inputRef = useRef(null)
  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keyboard close
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!debouncedQuery.trim() && !from && !to) {
      setResults([])
      return
    }
    const params = {}
    if (debouncedQuery.trim()) params.q = debouncedQuery.trim()
    if (from) params.from = from
    if (to) params.to = to

    setSearching(true)
    setError(null)
    api.journal
      .search(params)
      .then((data) => {
        setResults(data.results)
      })
      .catch((err) => {
        setError(err.message)
        setResults([])
      })
      .finally(() => setSearching(false))
  }, [debouncedQuery, from, to])

  function handleResultClick(dateStr) {
    onResult(dateStr)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3 bg-white shadow-sm">
        <span className="text-xl text-gray-400">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="flex-1 text-base text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
        />
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 transition-colors duration-150 text-xl font-light leading-none"
          aria-label="Close search"
        >
          ✕
        </button>
      </div>

      {/* Date filters */}
      <div className="flex gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {(from || to) && (
          <button
            onClick={() => { setFrom(''); setTo('') }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors duration-150"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {searching && (
          <p className="text-sm text-gray-400 text-center py-8">Searching…</p>
        )}
        {error && (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        )}
        {!searching && results.length === 0 && (query || from || to) && (
          <p className="text-sm text-gray-400 text-center py-8">No results found.</p>
        )}
        {!searching && results.length === 0 && !query && !from && !to && (
          <p className="text-sm text-gray-400 text-center py-8">
            Type to search your journal notes.
          </p>
        )}
        {results.map((r) => (
          <button
            key={`${r.date}-${r.noteId}`}
            onClick={() => handleResultClick(r.date)}
            className="w-full text-left rounded-xl border border-gray-100 bg-white shadow-sm p-4 hover:bg-indigo-50 hover:border-indigo-100 transition-colors duration-150"
          >
            <p className="text-xs font-semibold text-indigo-600 mb-1">
              {formatDisplay(fromDateStr(r.date))}
            </p>
            <p className="text-sm text-gray-700 line-clamp-2">{r.snippet}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
