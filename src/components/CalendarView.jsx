import { useCalendarDays } from '../hooks/useCalendarDays.js'
import {
  toDateStr, formatMonthYear, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isToday, parseISO, format,
} from '../lib/dates.js'

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function addMonths(date, delta) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + delta)
  return d
}

export function CalendarView({ calendarMonth, setCalendarMonth, onSelectDate, selectedDate }) {
  const { days } = useCalendarDays(calendarMonth)

  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const leadingCount = getDay(monthStart)
  const leadingDays = leadingCount > 0
    ? eachDayOfInterval({
        start: new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - leadingCount),
        end: new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - 1),
      })
    : []

  const currentDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const totalCells = Math.ceil((leadingDays.length + currentDays.length) / 7) * 7
  const trailingCount = totalCells - leadingDays.length - currentDays.length
  const trailingDays = trailingCount > 0
    ? eachDayOfInterval({
        start: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + 1),
        end: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + trailingCount),
      })
    : []

  const allCells = [
    ...leadingDays.map(d => ({ date: d, inMonth: false })),
    ...currentDays.map(d => ({ date: d, inMonth: true })),
    ...trailingDays.map(d => ({ date: d, inMonth: false })),
  ]

  const nRows = Math.ceil(allCells.length / 7)
  const selectedParsed = selectedDate ? parseISO(selectedDate) : null

  // Dark theme palette
  const BG = '#0f0f17'
  const HEADER_BG = '#13131e'
  const CELL_FUTURE = '#16161f'
  const CELL_PAST = '#111119'
  const CELL_BORDER = 'rgba(255,255,255,0.055)'
  const TEXT_PRIMARY = 'rgba(225,225,245,0.9)'
  const TEXT_MUTED = 'rgba(110,110,150,0.7)'
  const TEXT_GHOST = 'rgba(70,70,100,0.4)'

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        overflow: 'hidden',
      }}
    >
      {/* Month navigation header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ background: HEADER_BG, borderBottom: `1px solid ${CELL_BORDER}` }}
      >
        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
          className="transition-colors text-2xl leading-none px-2 py-1 rounded-lg"
          style={{ color: TEXT_MUTED }}
          aria-label="Previous month"
        >‹</button>

        <div className="text-center">
          <h2
            className="font-optima font-bold leading-none"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', color: TEXT_PRIMARY, letterSpacing: '0.02em' }}
          >
            {format(calendarMonth, 'MMMM')}
          </h2>
          <p className="font-optima mt-1 tracking-widest text-sm" style={{ color: TEXT_MUTED }}>
            {format(calendarMonth, 'yyyy')}
          </p>
        </div>

        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          className="transition-colors text-2xl leading-none px-2 py-1 rounded-lg"
          style={{ color: TEXT_MUTED }}
          aria-label="Next month"
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div
        className="grid grid-cols-7 shrink-0"
        style={{ borderBottom: `1px solid ${CELL_BORDER}` }}
      >
        {DAY_HEADERS.map(h => (
          <div key={h} className="text-center py-3">
            <span
              className="font-optima font-bold uppercase tracking-widest"
              style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)', color: 'rgba(200,200,230,0.85)' }}
            >
              {h}
            </span>
          </div>
        ))}
      </div>

      {/* Day grid — fills remaining height equally across all rows */}
      <div
        className="flex-1 min-h-0 grid grid-cols-7"
        style={{ gridTemplateRows: `repeat(${nRows}, 1fr)` }}
      >
        {allCells.map(({ date, inMonth }) => {
          const dateStr = toDateStr(date)
          const meta = days[dateStr]
          const todayFlag = isToday(date)
          const isPast = inMonth && date < today && !todayFlag
          const isSelected = selectedParsed && isSameDay(date, selectedParsed)

          // Cell background
          let cellBg = CELL_FUTURE
          if (!inMonth) cellBg = 'transparent'
          else if (isPast) cellBg = CELL_PAST

          const dots = []
          if (meta?.hasNotes) dots.push('#818cf8')   // indigo
          if (meta?.hasEvents) dots.push('#38bdf8')  // sky
          if (meta?.hasWeather) dots.push('#fbbf24') // amber
          if (meta?.hasNews) dots.push('#34d399')    // emerald

          return (
            <button
              key={dateStr}
              onClick={() => inMonth && onSelectDate(dateStr)}
              className="relative flex flex-col items-start p-2 transition-colors duration-100"
              style={{
                background: cellBg,
                border: `1px solid ${CELL_BORDER}`,
                cursor: inMonth ? 'pointer' : 'default',
              }}
            >
              {/* Date number */}
              {todayFlag ? (
                <span
                  className="w-9 h-9 flex items-center justify-center rounded-full font-optima font-bold leading-none"
                  style={{ fontSize: 'clamp(1rem, 1.8vw, 1.4rem)', background: '#4f46e5', color: '#fff' }}
                >
                  {format(date, 'd')}
                </span>
              ) : (
                <span
                  className="font-optima font-bold leading-none"
                  style={{
                    fontSize: 'clamp(1rem, 1.8vw, 1.4rem)',
                    color: !inMonth ? TEXT_GHOST : isPast ? 'rgba(140,140,175,0.5)' : 'rgba(230,230,255,0.95)',
                  }}
                >
                  {format(date, 'd')}
                </span>
              )}

              {/* Entry dots */}
              {dots.length > 0 && (
                <div className="flex gap-1 mt-auto pb-0.5">
                  {dots.map((color, i) => (
                    <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  ))}
                </div>
              )}

              {/* Selected ring */}
              {isSelected && !todayFlag && inMonth && (
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 0 2px rgba(99,102,241,0.5)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
