export type CalendarDayFilterBounds = {
  nextDay: string
  start: string
}

export function resolveCalendarDayFilterBounds(value: string): CalendarDayFilterBounds | null {
  const start = new Date(value)
  if (Number.isNaN(start.getTime())) return null

  const nextDay = new Date(start)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)

  return {
    nextDay: nextDay.toISOString(),
    start: start.toISOString(),
  }
}
