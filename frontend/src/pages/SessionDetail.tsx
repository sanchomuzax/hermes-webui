import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { CostBadge } from '../components/shared/CostBadge'

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function getSortPref(): 'asc' | 'desc' {
  return (localStorage.getItem('hermes_msg_sort') as 'asc' | 'desc') || 'asc'
}

function setSortPref(pref: 'asc' | 'desc') {
  localStorage.setItem('hermes_msg_sort', pref)
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(getSortPref)

  const toggleSort = () => {
    const next = sortOrder === 'asc' ? 'desc' : 'asc'
    setSortOrder(next)
    setSortPref(next)
  }

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => api.session(id!),
    enabled: !!id,
  })

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['session-messages', id],
    queryFn: () => api.sessionMessages(id!),
    enabled: !!id,
  })

  if (sessionLoading) return <div className="p-6">Loading...</div>
  if (!session) return <div className="p-6">Session not found</div>

  const s = session as Record<string, unknown>
  const inputTokens = (s.input_tokens as number) || 0
  const outputTokens = (s.output_tokens as number) || 0
  const cacheRead = (s.cache_read_tokens as number) || 0
  const cacheWrite = (s.cache_write_tokens as number) || 0
  const reasoning = (s.reasoning_tokens as number) || 0
  const totalTokens = inputTokens + outputTokens + cacheRead + cacheWrite + reasoning

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/sessions" className="text-xs mb-2 inline-block no-underline"
            style={{ color: 'var(--color-primary)' }}>
            &larr; Sessions
          </Link>
          <h2 className="text-xl font-semibold">
            {(s.title as string) || (s.id as string).slice(0, 12)}
          </h2>
          <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>{s.source as string}</span>
            <span>{(s.model as string) || 'unknown'}</span>
            <span>{s.message_count as number} msgs</span>
            <span>{s.tool_call_count as number} tools</span>
          </div>
        </div>
        <CostBadge cost={(s.estimated_cost_usd ?? s.actual_cost_usd) as number | null} />
      </div>

      {/* Token Usage */}
      {totalTokens > 0 && (
        <div className="rounded-lg border p-4"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>Token Usage</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <TokenStat label="Input" value={inputTokens} total={totalTokens} color="var(--color-info)" />
            <TokenStat label="Output" value={outputTokens} total={totalTokens} color="var(--color-success)" />
            <TokenStat label="Cache Read" value={cacheRead} total={totalTokens} color="var(--color-warning)" />
            <TokenStat label="Cache Write" value={cacheWrite} total={totalTokens} color="var(--color-primary)" />
            <TokenStat label="Reasoning" value={reasoning} total={totalTokens} color="#c084fc" />
          </div>
          {/* Token bar */}
          <div className="h-2 rounded-full mt-3 flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
            {inputTokens > 0 && <div style={{ width: `${(inputTokens / totalTokens) * 100}%`, backgroundColor: 'var(--color-info)' }} />}
            {outputTokens > 0 && <div style={{ width: `${(outputTokens / totalTokens) * 100}%`, backgroundColor: 'var(--color-success)' }} />}
            {cacheRead > 0 && <div style={{ width: `${(cacheRead / totalTokens) * 100}%`, backgroundColor: 'var(--color-warning)' }} />}
            {cacheWrite > 0 && <div style={{ width: `${(cacheWrite / totalTokens) * 100}%`, backgroundColor: 'var(--color-primary)' }} />}
            {reasoning > 0 && <div style={{ width: `${(reasoning / totalTokens) * 100}%`, backgroundColor: '#c084fc' }} />}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Messages {messages ? `(${messages.length})` : ''}
          </h3>
          <button
            onClick={toggleSort}
            className="text-xs px-2 py-1 rounded flex items-center gap-1"
            style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}
            title={sortOrder === 'asc' ? 'Oldest first (click for newest)' : 'Newest first (click for oldest)'}
          >
            {sortOrder === 'asc' ? '↑ Oldest first' : '↓ Newest first'}
          </button>
        </div>
        {messagesLoading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading messages...</p>}
        {(sortOrder === 'desc' ? [...(messages || [])].reverse() : messages)?.map((m) => (
          <div key={m.id} className="rounded-lg border p-3"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center gap-2 mb-1">
              <RoleBadge role={m.role} />
              {m.tool_name && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-warning)' }}>
                  {m.tool_name}
                </span>
              )}
              <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(m.timestamp * 1000).toLocaleTimeString()}
              </span>
            </div>
            {m.content && <MessageContent content={m.content} role={m.role} />}
            {!!m.tool_calls && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                  Tool calls ({Array.isArray(m.tool_calls) ? (m.tool_calls as unknown[]).length : 1})
                </summary>
                <pre className="text-xs mt-1 p-2 rounded overflow-x-auto font-mono"
                  style={{ backgroundColor: 'var(--color-bg)' }}>
                  {JSON.stringify(m.tool_calls, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MessageContent({ content, role }: { content: string; role: string }) {
  const isToolResponse = role === 'tool'
  const isLong = content.length > 500

  // Try to detect and format JSON content
  if (isToolResponse) {
    const formatted = tryFormatJson(content)
    if (formatted) {
      if (isLong) {
        return (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
              Tool response ({content.length.toLocaleString()} chars)
            </summary>
            <pre className="text-xs mt-1 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap"
              style={{ backgroundColor: 'var(--color-bg)', maxHeight: '400px', overflowY: 'auto' }}>
              {formatted}
            </pre>
          </details>
        )
      }
      return (
        <pre className="text-xs mt-1 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap"
          style={{ backgroundColor: 'var(--color-bg)' }}>
          {formatted}
        </pre>
      )
    }

    // Non-JSON tool response — still collapsible if long
    if (isLong) {
      return (
        <details className="mt-1">
          <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
            Tool response ({content.length.toLocaleString()} chars)
          </summary>
          <pre className="text-sm mt-1 p-2 rounded whitespace-pre-wrap break-words font-mono"
            style={{ backgroundColor: 'var(--color-bg)', maxHeight: '400px', overflowY: 'auto' }}>
            {content}
          </pre>
        </details>
      )
    }
    return (
      <pre className="text-xs mt-1 p-2 rounded whitespace-pre-wrap break-words font-mono"
        style={{ backgroundColor: 'var(--color-bg)' }}>
        {content}
      </pre>
    )
  }

  // Non-tool messages (user, assistant, system)
  if (isLong && content.length > 2000) {
    return (
      <details className="mt-1" open>
        <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
          {content.length.toLocaleString()} chars
        </summary>
        <pre className="text-sm whitespace-pre-wrap break-words mt-1 font-sans leading-relaxed"
          style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {content}
        </pre>
      </details>
    )
  }

  return (
    <pre className="text-sm whitespace-pre-wrap break-words mt-1 font-sans leading-relaxed">
      {content}
    </pre>
  )
}

function tryFormatJson(text: string): string | null {
  const trimmed = text.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null
  try {
    const parsed = JSON.parse(trimmed)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return null
  }
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    user: 'var(--color-info)',
    assistant: 'var(--color-success)',
    system: 'var(--color-warning)',
    tool: 'var(--color-primary)',
  }
  const color = colors[role] || 'var(--color-text-muted)'

  return (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded"
      style={{ backgroundColor: `${color}22`, color }}>
      {role}
    </span>
  )
}

function TokenStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  if (value === 0) return null
  return (
    <div className="text-center">
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color }}>{formatTokens(value)}</div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{((value / total) * 100).toFixed(0)}%</div>
    </div>
  )
}
