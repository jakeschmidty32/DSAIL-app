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

  const selectedParsed = selectedDate ? parseISO(selectedDate) : null

  return (
    <div className="w-full bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-6">
        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
          className="text-3xl text-stone-300 hover:text-stone-600 transition-colors leading-none"
          aria-label="Previous month"
        >‹</button>

        <div className="text-center">
          <h2 className="font-cursive font-bold text-stone-800 leading-none"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)' }}>
            {format(calendarMonth, 'MMMM')}
          </h2>
          <p className="font-journal text-stone-400 text-base tracking-widest mt-1">
            {format(calendarMonth, 'yyyy')}
          </p>
        </div>

        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          className="text-3xl text-stone-300 hover:text-stone-600 transition-colors leading-none"
          aria-label="Next month"
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-t border-b border-stone-100">
        {DAY_HEADERS.map(h => (
          <div key={h} className="text-center py-2">
            <span className="font-journal text-xs uppercase tracking-widest text-stone-400">{h}</span>
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {allCells.map(({ date, inMonth }) => {
          const dateStr = toDateStr(date)
          const meta = days[dateStr]
          const todayFlag = isToday(date)
          const isPast = inMonth && date < today && !todayFlag
          const isSelected = selectedParsed && isSameDay(date, selectedParsed)

          const dots = []
          if (meta?.hasNotes) dots.push('bg-indigo-400')
          if (meta?.hasEvents) dots.push('bg-sky-400')
          if (meta?.hasWeather) dots.push('bg-amber-400')
          if (meta?.hasNews) dots.push('bg-emerald-400')

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={[
                'relative flex flex-col items-start p-2 border border-stone-100 transition-colors duration-100 min-h-[5rem] md:min-h-[7rem]',
                !inMonth ? 'bg-transparent cursor-default' : '',
                inMonth && isPast ? 'bg-stone-50' : '',
                inMonth && !isPast && !todayFlag ? 'hover:bg-indigo-50/40 cursor-pointer' : '',
                todayFlag ? 'hover:bg-indigo-50/60 cursor-pointer' : '',
                isSelected && !todayFlag ? 'ring-2 ring-indigo-400 ring-inset' : '',
              ].filter(Boolean).join(' ')}
            >
              {/* Date number */}
              {todayFlag ? (
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white font-cursive font-bold text-lg leading-none">
                  {format(date, 'd')}
                </span>
              ) : (
                <span className={[
                  'font-cursive font-bold leading-none',
                  !inMonth ? 'text-stone-200 text-lg' : '',
                  inMonth && isPast ? 'text-stone-300 text-xl' : '',
                  inMonth && !isPast ? 'text-stone-700 text-xl' : '',
                ].filter(Boolean).join(' ')}>
                  {format(date, 'd')}
                </span>
              )}

              {/* Entry dots */}
              {dots.length > 0 && (
                <div className="flex gap-1 mt-auto pb-0.5">
                  {dots.map((cls, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${cls}`} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
