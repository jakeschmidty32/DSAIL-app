export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-100 rounded h-4 w-full ${className}`} />
  )
}

const WIDTHS = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3']

export function SkeletonBlock({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={WIDTHS[i % WIDTHS.length]} />
      ))}
    </div>
  )
}
