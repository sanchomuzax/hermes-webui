/**
 * Standardized source/platform colors used across the entire UI.
 * Each source has a fixed, recognizable color — slightly muted for the dark theme.
 */
export const SOURCE_COLORS: Record<string, string> = {
  telegram: '#2AABEE',   // Telegram brand blue
  cli: '#8b8bf5',        // Soft indigo
  cron: '#a78bfa',       // Soft purple
  api_server: '#e5a54b', // Warm amber
  discord: '#5865F2',    // Discord blurple
  slack: '#6b3a6d',      // Slack aubergine (brightened for dark bg)
  whatsapp: '#25D366',   // WhatsApp green
  email: '#EA4335',      // Gmail red
}

export function sourceColor(source: string): string {
  return SOURCE_COLORS[source] || '#6b6b76'
}

/**
 * Source filter tabs shown on the Sessions page.
 * Order matters — most common sources first.
 */
export const SOURCE_FILTERS = [
  'cli',
  'cron',
  'telegram',
  'discord',
  'slack',
  'whatsapp',
  'email',
] as const
