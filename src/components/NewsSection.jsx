import { Skeleton } from './ui/Skeleton.jsx'
import { EmptyState } from './ui/EmptyState.jsx'

const SOURCE_COLORS = [
  'text-indigo-600',
  'text-sky-600',
  'text-emerald-600',
  'text-rose-600',
  'text-amber-600',
]

function sourceColor(source) {
  let hash = 0
  for (let i = 0; i < source.length; i++) hash = source.charCodeAt(i) + hash * 31
  return SOURCE_COLORS[Math.abs(hash) % SOURCE_COLORS.length]
}

export function NewsSection({ headlines, selectedHeadlineId, loading, onSelect }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-2"
          >
            <Skeleton className="w-1/3 h-3" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-5/6 h-4" />
          </div>
        ))}
      </div>
    )
  }

  if (!headlines || headlines.length === 0) {
    return (
      <EmptyState
        icon="📰"
        title="No headlines available"
        description="Headlines will appear here when available."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {headlines.map((h) => {
        const isSelected = h.id === selectedHeadlineId
        return (
          <div
            key={h.id}
            onClick={() => onSelect(h.id)}
            className={[
              'relative rounded-xl border bg-white shadow-sm p-4 cursor-pointer transition-colors duration-150 flex flex-col gap-2 hover:bg-gray-50',
              isSelected
                ? 'ring-2 ring-indigo-600 border-indigo-200'
                : 'border-gray-100',
            ].join(' ')}
          >
            {/* Selected check */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs leading-none">✓</span>
              </div>
            )}

            {/* Source */}
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${sourceColor(h.source)}`}
            >
              {h.source}
            </p>

            {/* Title */}
            <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 flex-1">
              {h.title}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-1">
              {isSelected && (
                <span className="text-xs text-indigo-600 font-medium">
                  Saved to journal
                </span>
              )}
              {h.url && (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto text-xs text-gray-400 hover:text-indigo-600 transition-colors duration-150"
                >
                  Read →
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
