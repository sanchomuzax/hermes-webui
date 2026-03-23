/**
 * Standardized source/platform colors used across the entire UI.
 * Each source has a fixed, recognizable color.
 */
export const SOURCE_COLORS: Record<string, string> = {
  telegram: '#2AABEE',   // Telegram brand blue
  cli: '#6366f1',        // Indigo
  cron: '#8b5cf6',       // Purple
  api_server: '#f59e0b', // Amber
  discord: '#5865F2',    // Discord blurple
  slack: '#4A154B',      // Slack aubergine
  whatsapp: '#25D366',   // WhatsApp green
  email: '#EA4335',      // Gmail red
}

export function sourceColor(source: string): string {
  return SOURCE_COLORS[source] || '#64748b'
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
