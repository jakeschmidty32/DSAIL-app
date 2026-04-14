import {
  format,
  parseISO,
  isToday,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isSameDay,
} from 'date-fns'

export function toDateStr(date) {
  return format(date, 'yyyy-MM-dd')
}

export function fromDateStr(str) {
  return parseISO(str)
}

export function formatDisplay(date) {
  return format(date, 'EEEE, MMMM d, yyyy')
}

export function formatShort(date) {
  return format(date, 'MMM d')
}

export function formatTime(dateStr) {
  return format(parseISO(dateStr), 'h:mm a')
}

export function formatMonthYear(date) {
  return format(date, 'MMMM yyyy')
}

export {
  isToday,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isSameDay,
  parseISO,
  format,
}
