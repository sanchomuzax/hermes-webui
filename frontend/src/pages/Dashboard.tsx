import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['session-stats'],
    queryFn: api.sessionStats,
    refetchInterval: 10000,
  })

  const { data: gateway } = useQuery({
    queryKey: ['gateway-status'],
    queryFn: api.gatewayStatus,
    refetchInterval: 5000,
  })

  const { data: sessionsData } = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => api.sessions({ limit: 30 }),
    refetchInterval: 5000,
  })

  // Sort: active sessions first, then by last_active/started_at desc
  const sortedSessions = [...(sessionsData?.sessions || [])].sort((a, b) => {
    const aActive = !a.ended_at ? 1 : 0
    const bActive = !b.ended_at ? 1 : 0
    if (aActive !== bActive) return bActive - aActive
    const aTime = a.last_active || a.started_at
    const bTime = b.last_active || b.started_at
    return bTime - aTime
  })

  // Separate gateway platforms from services
  const gatewayPlatforms = gateway?.platforms?.filter(
    (p) => !p.details || (p.details as Record<string, unknown>).type !== 'service'
  ) || []
  const services = gateway?.platforms?.filter(
    (p) => p.details && (p.details as Record<string, unknown>).type === 'service'
  ) || []

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={stats?.total_sessions ?? '...'} />
        <StatCard label="Total Messages" value={stats?.total_messages ?? '...'} />
        <StatCard
          label="Total Cost"
          value={stats ? `$${stats.total_estimated_cost_usd.toFixed(2)}` : '...'}
        />
        <StatCard
          label="Gateway"
          value={gateway?.running ? 'Running' : 'Stopped'}
          color={gateway?.running ? 'var(--color-success)' : 'var(--color-error)'}
        />
      </div>

      {/* Platforms & Services */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>Platforms & Services</h3>
        <div className="flex flex-wrap gap-2">
          {gatewayPlatforms.map((p) => (
            <ServiceBadge key={p.name} name={p.name} active={p.connected} />
          ))}
          {services.map((p) => (
            <ServiceBadge
              key={p.name}
              name={p.name}
              active={p.connected}
              description={(p.details as Record<string, string> | null)?.description}
            />
          ))}
        </div>
      </div>

      {/* Activity Feed + Model Distribution side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Feed — 2/3 width */}
        <div className="lg:col-span-2 rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Activity Feed</h3>
            <Link to="/sessions" className="text-xs no-underline" style={{ color: 'var(--color-primary)' }}>
              See all
            </Link>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {sortedSessions.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No sessions yet.
              </p>
            )}
            {sortedSessions.slice(0, 15).map((s) => {
              const isActive = !s.ended_at
              const dotColor = isActive ? 'var(--color-success)' : 'var(--color-text-muted)'
              const label = sessionLabel(s)
              const timeAgo = formatTimeAgo(s.last_active || s.started_at)
              return (
                <Link key={s.id} to={`/sessions/${s.id}`} className="block no-underline">
                  <div className="flex items-center gap-2 text-xs p-1.5 rounded hover:brightness-110 transition-all"
                    style={{ backgroundColor: 'var(--color-bg)' }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }} />
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                      style={{
                        backgroundColor: sourceColor(s.source),
                        color: '#fff',
                      }}
                    >
                      {s.source}
                    </span>
                    <span className="truncate font-medium" style={{ color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {label}
                    </span>
                    <span className="ml-auto flex-shrink-0 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{s.message_count} msgs</span>
                      <span>{timeAgo}</span>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Model Distribution — 1/3 width */}
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>Sessions by Model</h3>
          <div className="space-y-2">
            {stats?.sessions_by_model && Object.entries(stats.sessions_by_model)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([model, count]) => (
                <div key={model} className="p-2 rounded text-center"
                  style={{ backgroundColor: 'var(--color-bg)' }}>
                  <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{model}</div>
                  <div className="text-lg font-semibold">{count}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
      <div className="text-2xl font-semibold" style={{ color: color || 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  )
}

const SOURCE_COLORS: Record<string, string> = {
  telegram: '#2AABEE',
  cli: '#6366f1',
  cron: '#8b5cf6',
  api_server: '#f59e0b',
  discord: '#5865F2',
  slack: '#4A154B',
  whatsapp: '#25D366',
  email: '#EA4335',
}

function sourceColor(source: string): string {
  return SOURCE_COLORS[source] || '#64748b'
}

function sessionLabel(s: { title: string | null; preview: string; source: string }): string {
  if (s.title && s.title !== '---' && !s.title.startsWith('[SYSTEM:')) return s.title
  const preview = (s.preview || '').replace(/^\[SYSTEM[:\]].*?\]\s*/i, '').trim()
  if (preview && preview.length > 3) return preview.slice(0, 80)
  return `${s.source} session`
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function ServiceBadge({ name, active, description }: { name: string; active: boolean; description?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
      title={description || name}
      style={{
        backgroundColor: active ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.1)',
        color: active ? 'var(--color-success)' : 'var(--color-text-muted)',
        opacity: active ? 1 : 0.6,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: active ? 'var(--color-success)' : 'var(--color-text-muted)' }}
      />
      {name}
    </span>
  )
}
