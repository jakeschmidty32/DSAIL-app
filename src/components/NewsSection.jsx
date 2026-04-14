const SOURCE_COLORS = [
  'text-indigo-600', 'text-sky-600', 'text-emerald-600', 'text-rose-600', 'text-amber-600',
]
function sourceColor(source = '') {
  let h = 0
  for (let i = 0; i < source.length; i++) h = source.charCodeAt(i) + h * 31
  return SOURCE_COLORS[Math.abs(h) % SOURCE_COLORS.length]
}

function HeadlineCard({ h, isSelected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(isSelected ? null : h.id)}
      className={[
        'relative rounded-xl border bg-white p-4 cursor-pointer transition-all duration-150 flex flex-col gap-2',
        isSelected
          ? 'ring-2 ring-indigo-500 border-indigo-200 shadow-md'
          : 'border-stone-200 hover:border-stone-300 hover:shadow-sm',
      ].join(' ')}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs leading-none">✓</span>
        </div>
      )}
      <p className={`text-xs font-semibold uppercase tracking-wide ${sourceColor(h.source)}`}>
        {h.source}
      </p>
      {/* Full title — no line-clamp so it's always fully visible */}
      <p className="text-sm font-semibold text-stone-800 leading-snug flex-1">{h.title}</p>
      <div className="flex items-center justify-between pt-1">
        {isSelected && (
          <span className="text-xs text-indigo-600 font-medium">Saved to journal</span>
        )}
        {h.url && (
          <a
            href={h.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs text-stone-400 hover:text-indigo-600 transition-colors"
          >
            Read →
          </a>
        )}
      </div>
    </div>
  )
}

export function NewsSection({ headlines, selectedHeadlineId, loading, onSelect }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-stone-100 bg-white p-4 space-y-2">
            <div className="h-3 bg-stone-100 animate-pulse rounded w-1/4" />
            <div className="h-4 bg-stone-100 animate-pulse rounded w-full" />
            <div className="h-4 bg-stone-100 animate-pulse rounded w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  if (!headlines || headlines.length === 0) {
    return (
      <p className="font-journal text-stone-400 italic text-sm py-2">
        No headlines available for this date.
      </p>
    )
  }

  const selected = headlines.find((h) => h.id === selectedHeadlineId)

  // ── After selection: show only the chosen headline, centered ─────────────
  if (selected) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <p className={`text-xs font-semibold uppercase tracking-widest ${sourceColor(selected.source)}`}>
          {selected.source}
        </p>
        <p className="font-journal text-base text-stone-800 leading-snug max-w-sm">
          {selected.title}
        </p>
        {selected.url && (
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-500 hover:underline"
          >
            Read full article →
          </a>
        )}
        <button
          onClick={() => onSelect(null)}
          className="text-xs text-stone-300 hover:text-stone-500 transition-colors mt-1"
        >
          Change headline
        </button>
      </div>
    )
  }

  // ── Before selection: show all three ─────────────────────────────────────
  return (
    <div className="space-y-3">
      <p className="font-journal text-xs text-stone-400 italic">
        Choose one headline to save to this day's journal:
      </p>
      {headlines.map((h) => (
        <HeadlineCard key={h.id} h={h} isSelected={false} onSelect={onSelect} />
      ))}
    </div>
  )
}
