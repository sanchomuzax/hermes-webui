import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { sourceColor } from '../utils/sourceColors'

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

  // Model distribution with percentages
  const modelEntries = stats?.sessions_by_model
    ? Object.entries(stats.sessions_by_model).sort(([, a], [, b]) => b - a)
    : []
  const totalModelSessions = modelEntries.reduce((s, [, c]) => s + c, 0)

  // Source distribution
  const sourceEntries = stats?.sessions_by_source
    ? Object.entries(stats.sessions_by_source).sort(([, a], [, b]) => b - a)
    : []

  const uptimeStr = gateway?.uptime_seconds ? formatUptime(gateway.uptime_seconds) : null

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 md:h-full">
      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard
          label="Sessions"
          value={stats?.total_sessions ?? '—'}
          icon="⬡"
          accent={false}
        />
        <StatCard
          label="Messages"
          value={stats?.total_messages ? formatNumber(stats.total_messages) : '—'}
          icon="◈"
          accent={false}
        />
        <StatCard
          label="Cost"
          value={stats ? `$${stats.total_estimated_cost_usd.toFixed(2)}` : '—'}
          icon="◇"
          accent={false}
        />
        <StatCard
          label="Gateway"
          value={gateway?.running ? 'Online' : 'Offline'}
          icon={gateway?.running ? '●' : '○'}
          accent={true}
          status={gateway?.running ? 'success' : 'error'}
          subtitle={uptimeStr ? `Up ${uptimeStr}` : undefined}
        />
      </div>

      {/* Platforms & Services */}
      <div
        className="rounded-xl p-4 flex-shrink-0"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Infrastructure
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {gatewayPlatforms.map((p) => (
            <PlatformBadge key={p.name} name={p.name} active={p.connected} />
          ))}
          {services.map((p) => (
            <PlatformBadge
              key={p.name}
              name={p.name}
              active={p.connected}
              description={(p.details as Record<string, string> | null)?.description}
              isService
            />
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:flex-1 md:min-h-0">
        {/* Activity Feed — 7/12 */}
        <div
          className="lg:col-span-7 rounded-xl p-4 flex flex-col md:min-h-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Activity Feed
              </span>
              {sortedSessions.some(s => !s.ended_at) && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse-subtle" style={{ backgroundColor: 'var(--color-success)' }} />
              )}
            </div>
            <Link
              to="/sessions"
              className="text-xs font-medium no-underline transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
              View all →
            </Link>
          </div>
          <div className="space-y-0.5 max-h-80 md:max-h-none md:flex-1 overflow-y-auto md:min-h-0">
            {sortedSessions.length === 0 && (
              <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No sessions yet
              </p>
            )}
            {sortedSessions.slice(0, 20).map((s, i) => {
              const isActive = !s.ended_at
              const label = sessionLabel(s)
              const timeAgo = formatTimeAgo(s.last_active || s.started_at)
              return (
                <Link
                  key={s.id}
                  to={`/sessions/${s.id}`}
                  className="group block no-underline animate-fade-in"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <div
                    className="flex items-center gap-3 text-[13px] px-3 py-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Status indicator */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'animate-pulse-subtle' : ''}`}
                      style={{
                        backgroundColor: isActive ? 'var(--color-success)' : 'var(--color-text-faint)',
                      }}
                    />
                    {/* Source badge */}
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                      style={{
                        backgroundColor: `${sourceColor(s.source)}18`,
                        color: sourceColor(s.source),
                        letterSpacing: '0.02em',
                      }}
                    >
                      {s.source}
                    </span>
                    {/* Title */}
                    <span
                      className="truncate"
                      style={{
                        color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      {label}
                    </span>
                    {/* Meta */}
                    <span className="ml-auto flex-shrink-0 flex items-center gap-3 text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{s.message_count} msgs</span>
                      <span style={{ color: 'var(--color-text-faint)' }}>{timeAgo}</span>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right Column — 5/12 */}
        <div className="lg:col-span-5 flex flex-col gap-4 md:min-h-0">
          {/* Model Distribution */}
          <div
            className="rounded-xl p-4 flex flex-col md:flex-1 md:min-h-0"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider mb-3 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              Models
            </span>
            <div className="space-y-2 max-h-48 md:max-h-none md:flex-1 overflow-y-auto md:min-h-0">
              {modelEntries.slice(0, 6).map(([model, count]) => {
                const pct = totalModelSessions > 0 ? (count / totalModelSessions) * 100 : 0
                const shortName = model.replace(/^(anthropic\/|openai\/|google\/)/, '').replace(/^(claude-|gpt-)/, (m) => m)
                return (
                  <div key={model} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {shortName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                          {count}
                        </span>
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-faint)' }}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border-subtle)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: 'var(--color-primary)',
                          opacity: 0.7,
                          transition: `width var(--duration-slow) var(--ease-out)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Source Breakdown */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider mb-3 block" style={{ color: 'var(--color-text-muted)' }}>
              Sources
            </span>
            <div className="flex flex-wrap gap-3">
              {sourceEntries.map(([source, count]) => (
                <div key={source} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: sourceColor(source) }}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {source}
                  </span>
                  <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Stat Card ─────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  accent,
  status,
  subtitle,
}: {
  label: string
  value: string | number
  icon: string
  accent: boolean
  status?: 'success' | 'error'
  subtitle?: string
}) {
  const statusColor = status === 'success' ? 'var(--color-success)' : status === 'error' ? 'var(--color-error)' : 'var(--color-text)'
  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: accent && status === 'success' ? '0 0 0 1px rgba(63, 185, 80, 0.15), var(--shadow-sm)' : 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text-faint)', opacity: 0.5 }}>
          {icon}
        </span>
      </div>
      <div
        className="text-xl font-semibold tracking-tight"
        style={{ color: accent ? statusColor : 'var(--color-text)' }}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

/* ── Platform Badge ────────────────────────────────────── */

function PlatformBadge({
  name,
  active,
  description,
  isService,
}: {
  name: string
  active: boolean
  description?: string
  isService?: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
      title={description || name}
      style={{
        backgroundColor: active ? 'var(--color-success-subtle)' : 'rgba(148,163,184,0.05)',
        color: active ? 'var(--color-success)' : 'var(--color-text-faint)',
        border: `1px solid ${active ? 'rgba(63, 185, 80, 0.1)' : 'var(--color-border-subtle)'}`,
      }}
    >
      <span
        className={`w-1 h-1 rounded-full ${active ? 'animate-pulse-subtle' : ''}`}
        style={{
          backgroundColor: active ? 'var(--color-success)' : 'var(--color-text-faint)',
        }}
      />
      {name}
      {isService && (
        <span style={{ color: 'var(--color-text-faint)', fontSize: '9px' }}>svc</span>
      )}
    </span>
  )
}

/* ── Helpers ───────────────────────────────────────────── */

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

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 1000) return n.toLocaleString()
  return String(n)
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
