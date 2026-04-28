const C = {
  textPrimary: 'rgba(220,220,245,0.9)',
  textMuted: 'rgba(130,130,170,0.7)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  cardHoverBg: 'rgba(255,255,255,0.07)',
  selectedBg: 'rgba(99,102,241,0.12)',
  selectedBorder: 'rgba(99,102,241,0.4)',
}

const SOURCE_COLORS = ['#818cf8', '#38bdf8', '#34d399', '#fb923c', '#e879f9']
function sourceColor(source = '') {
  let h = 0
  for (let i = 0; i < source.length; i++) h = source.charCodeAt(i) + h * 31
  return SOURCE_COLORS[Math.abs(h) % SOURCE_COLORS.length]
}

function HeadlineCard({ h, isSelected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(isSelected ? null : h.id)}
      className="relative rounded-xl p-4 cursor-pointer transition-all duration-150 flex flex-col gap-2"
      style={{
        background: isSelected ? C.selectedBg : C.cardBg,
        border: `1px solid ${isSelected ? C.selectedBorder : C.cardBorder}`,
      }}
    >
      {isSelected && (
        <div
          className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: '#4f46e5' }}
        >
          <span className="text-white text-xs leading-none">✓</span>
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: sourceColor(h.source) }}>
        {h.source}
      </p>
      <p className="text-sm font-semibold leading-snug flex-1" style={{ color: C.textPrimary }}>
        {h.title}
      </p>
      <div className="flex items-center justify-between pt-1">
        {isSelected && (
          <span className="text-xs font-medium" style={{ color: 'rgba(129,140,248,0.8)' }}>Saved to journal</span>
        )}
        {h.url && (
          <a
            href={h.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs transition-colors hover:underline"
            style={{ color: C.textMuted }}
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
          <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
            <div className="h-3 rounded w-1/4 animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="h-4 rounded w-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-4 rounded w-5/6 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (!headlines || headlines.length === 0) {
    return (
      <p className="font-journal text-sm italic py-2" style={{ color: C.textMuted }}>
        No headlines available for this date.
      </p>
    )
  }

  // Always show all headlines; selected one is highlighted
  return (
    <div className="space-y-3">
      {headlines.map((h) => (
        <HeadlineCard
          key={h.id}
          h={h}
          isSelected={h.id === selectedHeadlineId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
