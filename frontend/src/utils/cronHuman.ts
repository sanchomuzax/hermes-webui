/**
 * Convert a cron expression to a human-readable string.
 * Covers common patterns — not a full parser, but handles typical schedules.
 * Inspired by crontab.guru's descriptions.
 */
export function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) return expr

  const [minute, hour, dom, month, dow] = parts

  // Special presets
  if (minute === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every minute'
  }

  const isEveryDay = dom === '*' && month === '*' && dow === '*'
  const isEveryDayOfMonth = dom === '*' && month === '*'

  // "At HH:MM" base
  const timeStr = formatTime(minute, hour)

  // Every N minutes: */5 * * * *
  if (minute.startsWith('*/') && hour === '*' && isEveryDay) {
    return `Every ${minute.slice(2)} minutes`
  }

  // Every hour at :MM
  if (hour === '*' && isEveryDay) {
    return `Every hour at minute ${minute}`
  }

  // Specific day of week
  if (isEveryDayOfMonth && dow !== '*') {
    const days = parseDow(dow)
    if (days) return `${timeStr}, ${days}`
  }

  // Specific day of month
  if (dom !== '*' && month === '*' && dow === '*') {
    return `${timeStr}, on day ${dom} of every month`
  }

  // Every day at HH:MM
  if (isEveryDay && hour !== '*' && minute !== '*') {
    return `${timeStr}, every day`
  }

  return `${timeStr}`
}

function formatTime(minute: string, hour: string): string {
  if (hour === '*') return `At every hour :${minute.padStart(2, '0')}`
  const h = hour.padStart(2, '0')
  const m = minute.padStart(2, '0')
  return `At ${h}:${m}`
}

const DOW_NAMES: Record<string, string> = {
  '0': 'Sunday', '7': 'Sunday',
  '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
  '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
  'SUN': 'Sunday', 'MON': 'Monday', 'TUE': 'Tuesday',
  'WED': 'Wednesday', 'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday',
}

function parseDow(dow: string): string | null {
  // Handle ranges like 1-5 (Mon-Fri)
  if (dow === '1-5' || dow.toUpperCase() === 'MON-FRI') return 'Monday through Friday'
  if (dow === '0,6' || dow === '6,0') return 'weekends'

  // Handle comma-separated
  const parts = dow.split(',')
  const names = parts.map((p) => DOW_NAMES[p.trim().toUpperCase()] || DOW_NAMES[p.trim()])
  if (names.every(Boolean)) {
    if (names.length === 1) return `only on ${names[0]}`
    return `on ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }
  return null
}

/**
 * Convert an interval schedule display to human-readable.
 */
export function intervalToHuman(display: string): string {
  const match = display.match(/every\s+(\d+)m/)
  if (!match) return display

  const minutes = parseInt(match[1], 10)
  if (minutes < 60) return `Every ${minutes} minutes`
  if (minutes === 60) return 'Every hour'
  if (minutes % 60 === 0) return `Every ${minutes / 60} hours`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `Every ${h}h ${m}m`
}
