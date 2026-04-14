import { useCalendarDays } from '../hooks/useCalendarDays.js'
import {
  toDateStr,
  formatMonthYear,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  format,
} from '../lib/dates.js'

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function addMonths(date, delta) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + delta)
  return d
}

export function CalendarView({
  calendarMonth,
  setCalendarMonth,
  onSelectDate,
  selectedDate,
}) {
  const { days } = useCalendarDays(calendarMonth)

  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)

  // leading days from previous month
  const leadingCount = getDay(monthStart) // 0=Sun
  const leadingDays =
    leadingCount > 0
      ? eachDayOfInterval({
          start: new Date(
            monthStart.getFullYear(),
            monthStart.getMonth(),
            monthStart.getDate() - leadingCount,
          ),
          end: new Date(
            monthStart.getFullYear(),
            monthStart.getMonth(),
            monthStart.getDate() - 1,
          ),
        })
      : []

  const currentDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // trailing days to complete 6 rows (42 cells)
  const totalCells = 42
  const trailingCount = totalCells - leadingDays.length - currentDays.length
  const lastDay = monthEnd
  const trailingDays =
    trailingCount > 0
      ? eachDayOfInterval({
          start: new Date(
            lastDay.getFullYear(),
            lastDay.getMonth(),
            lastDay.getDate() + 1,
          ),
          end: new Date(
            lastDay.getFullYear(),
            lastDay.getMonth(),
            lastDay.getDate() + trailingCount,
          ),
        })
      : []

  const allCells = [
    ...leadingDays.map((d) => ({ date: d, inMonth: false })),
    ...currentDays.map((d) => ({ date: d, inMonth: true })),
    ...trailingDays.map((d) => ({ date: d, inMonth: false })),
  ]

  const selectedParsed = selectedDate ? parseISO(selectedDate) : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
          className="p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors duration-150 text-sm font-medium"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-gray-900">
          {formatMonthYear(calendarMonth)}
        </span>
        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          className="p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors duration-150 text-sm font-medium"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="text-center text-xs font-medium text-gray-400 py-1"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {allCells.map(({ date, inMonth }) => {
          const dateStr = toDateStr(date)
          const meta = days[dateStr]
          const todayFlag = isToday(date)
          const selectedFlag =
            selectedParsed && isSameDay(date, selectedParsed)

          const dots = []
          if (meta?.hasNotes) dots.push('bg-indigo-500')
          if (meta?.hasEvents) dots.push('bg-sky-500')
          if (meta?.hasWeather) dots.push('bg-amber-400')
          if (meta?.hasNews) dots.push('bg-green-500')

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={[
                'relative flex flex-col items-center justify-start pt-1 pb-1.5 h-10 md:h-12 rounded-lg transition-colors duration-150',
                inMonth ? 'text-gray-900' : 'text-gray-300',
                todayFlag && !selectedFlag
                  ? 'bg-indigo-50 font-semibold'
                  : '',
                selectedFlag
                  ? 'ring-2 ring-indigo-600 ring-inset bg-indigo-50 font-semibold'
                  : 'hover:bg-gray-50',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="text-xs leading-none">{format(date, 'd')}</span>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.slice(0, 3).map((cls, i) => (
                    <span
                      key={i}
                      className={`w-1 h-1 rounded-full ${cls}`}
                    />
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
