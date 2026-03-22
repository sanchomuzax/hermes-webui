interface ConnectionBadgeProps {
  connected: boolean
  label?: string
}

export function ConnectionBadge({ connected, label }: ConnectionBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: connected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: connected ? 'var(--color-success)' : 'var(--color-error)',
      }}>
      <span className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: connected ? 'var(--color-success)' : 'var(--color-error)' }} />
      {label || (connected ? 'Online' : 'Offline')}
    </span>
  )
}
