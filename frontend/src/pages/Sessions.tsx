import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { CostBadge } from '../components/shared/CostBadge'
import { SearchBar } from '../components/shared/SearchBar'
import { sourceColor, SOURCE_FILTERS } from '../utils/sourceColors'
import type { SearchResult } from '../api/types'

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function Sessions() {
  const [source, setSource] = useState<string>('')
  const [page, setPage] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [newestFirst, setNewestFirst] = useState(() => {
    return localStorage.getItem('hermes_sessions_order') !== 'oldest'
  })
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', source, page],
    queryFn: () => api.sessions({ source: source || undefined, limit, offset: page * limit }),
    refetchInterval: 15000,
  })

  const handleSearch = async (query: string) => {
    try {
      const results = await api.searchMessages(query, { source: source || undefined, limit: 20 })
      setSearchResults(results)
    } catch {
      setSearchResults([])
    }
  }

  const clearSearch = () => setSearchResults(null)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sessions</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setNewestFirst((prev) => {
                const next = !prev
                localStorage.setItem('hermes_sessions_order', next ? 'newest' : 'oldest')
                return next
              })
            }}
            className="text-xs px-2 py-1 rounded flex items-center gap-1"
            style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}
            title={newestFirst ? 'Newest first' : 'Oldest first'}
          >
            <span style={{ display: 'inline-block', transform: newestFirst ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}>↓</span>
            {newestFirst ? 'Newest' : 'Oldest'}
          </button>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {data ? `${data.total} total` : '...'}
          </span>
        </div>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <SearchBar onSearch={handleSearch} placeholder="Search messages (FTS5)..." />
        </div>
        {searchResults && (
          <button onClick={clearSearch} className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--color-primary)' }}>
            Clear search
          </button>
        )}
      </div>

      {/* Source filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <FilterTab
          label="All"
          active={!source}
          color="var(--color-primary)"
          onClick={() => { setSource(''); setPage(0) }}
        />
        {SOURCE_FILTERS.map((s) => (
          <FilterTab
            key={s}
            label={s}
            active={source === s}
            color={sourceColor(s)}
            onClick={() => { setSource(s); setPage(0) }}
          />
        ))}
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Search Results ({searchResults.length})
          </h3>
          {searchResults.map((r) => (
            <Link key={r.id} to={`/sessions/${r.session_id}`}
              className="block p-3 rounded-lg border no-underline"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}>
              <div className="flex justify-between items-start">
                <div>
                  <SourceBadge source={r.source} />
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                    {r.role}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(r.timestamp)}</span>
              </div>
              <div className="text-sm mt-1 font-mono" dangerouslySetInnerHTML={{
                __html: r.snippet.replace(/>>>/g, '<mark>').replace(/<<</g, '</mark>')
              }} />
            </Link>
          ))}
        </div>
      )}

      {/* Session List */}
      {!searchResults && (
        <>
          <div className="space-y-2">
            {isLoading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
            {[...(data?.sessions || [])].sort((a, b) => {
              const aActive = !a.ended_at ? 1 : 0
              const bActive = !b.ended_at ? 1 : 0
              if (aActive !== bActive) return bActive - aActive
              const aTime = a.last_active || a.started_at
              const bTime = b.last_active || b.started_at
              return newestFirst ? bTime - aTime : aTime - bTime
            }).map((s) => (
              <Link key={s.id} to={`/sessions/${s.id}`}
                className="block p-3 rounded-lg border no-underline transition-colors"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">
                      {s.title || s.preview || s.id.slice(0, 8)}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs items-center" style={{ color: 'var(--color-text-muted)' }}>
                      <SourceBadge source={s.source} />
                      <span>{s.model || 'unknown'}</span>
                      <span>{s.message_count} msgs</span>
                      <span>{s.tool_call_count} tools</span>
                      <span>{timeAgo(s.started_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <CostBadge cost={s.estimated_cost_usd ?? s.actual_cost_usd} />
                    <SessionStatusBadge endedAt={s.ended_at} lastActive={s.last_active} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data && data.total > limit && (
            <div className="flex justify-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded text-sm disabled:opacity-30"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Page {page + 1} of {Math.ceil(data.total / limit)}
              </span>
              <button
                disabled={(page + 1) * limit >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded text-sm disabled:opacity-30"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Colored source badge with the platform's brand color */
function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{
        backgroundColor: sourceColor(source),
        color: '#fff',
      }}
    >
      {source}
    </span>
  )
}

/** Colored filter tab — active uses the source color, inactive is neutral */
function FilterTab({ label, active, color, onClick }: {
  label: string
  active: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1 rounded-full capitalize transition-colors"
      style={{
        backgroundColor: active ? color : 'var(--color-surface)',
        color: active ? '#fff' : 'var(--color-text-muted)',
        border: active ? 'none' : '1px solid var(--color-border)',
      }}
    >
      {label}
    </button>
  )
}

function SessionStatusBadge({ endedAt, lastActive }: { endedAt: number | null; lastActive: number | null }) {
  if (endedAt) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: 'rgba(148,163,184,0.15)', color: 'var(--color-text-muted)' }}>
        ended
      </span>
    )
  }

  const now = Date.now() / 1000
  const lastActivityAge = lastActive ? now - lastActive : Infinity
  const FIVE_MINUTES = 300

  if (lastActivityAge < FIVE_MINUTES) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--color-success)' }}>
        active
      </span>
    )
  }

  return null
}
