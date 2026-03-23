import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api } from '../api/client'
import { cronToHuman, intervalToHuman } from '../utils/cronHuman'
import type { CronJob } from '../api/types'

function getScheduleExpr(schedule: CronJob['schedule']): string {
  if (typeof schedule === 'object' && schedule !== null) {
    const s = schedule as Record<string, string>
    return s.expr || s.display || JSON.stringify(schedule)
  }
  return String(schedule ?? '')
}

function getScheduleKind(job: CronJob): 'cron' | 'interval' | 'once' {
  if (typeof job.schedule === 'object' && job.schedule !== null) {
    const kind = (job.schedule as Record<string, string>).kind
    if (kind === 'interval') return 'interval'
    if (kind === 'once') return 'once'
  }
  return 'cron'
}

function getHumanSchedule(job: CronJob): string {
  const kind = getScheduleKind(job)
  const expr = getScheduleExpr(job.schedule)

  if (kind === 'once') return 'Run once'
  if (kind === 'interval') return intervalToHuman(expr)
  return cronToHuman(expr)
}

function parseNextRun(job: CronJob): number {
  const raw = job.next_run || job.next_run_at
  if (!raw) return Infinity
  const d = new Date(String(raw))
  return isNaN(d.getTime()) ? Infinity : d.getTime()
}

export function Cron() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: api.cronJobs,
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteCronJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cron-jobs'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateCronJob(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cron-jobs'] }),
  })

  // Sort: enabled first, then by next_run ascending (soonest first)
  const sortedJobs = useMemo(() => {
    if (!data?.jobs) return []
    return [...data.jobs].sort((a, b) => {
      // enabled before disabled
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      // within same enabled group, soonest next_run first
      return parseNextRun(a) - parseNextRun(b)
    })
  }, [data?.jobs])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cron Jobs</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {showForm ? 'Cancel' : '+ New Job'}
        </button>
      </div>

      {showForm && <CronJobForm onCreated={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['cron-jobs'] }) }} />}

      {isLoading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}

      <div className="space-y-2">
        {sortedJobs.map((job) => {
          const isExpanded = expandedId === job.id
          const kind = getScheduleKind(job)
          const scheduleExpr = getScheduleExpr(job.schedule)
          const humanSchedule = getHumanSchedule(job)

          return (
            <div key={job.id}
              className="rounded-lg border overflow-hidden"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                opacity: job.enabled ? 1 : 0.6,
              }}>
              {/* Header */}
              <div className="p-4 cursor-pointer" onClick={() => toggleExpand(job.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {isExpanded ? '▾' : '▸'}
                      </span>
                      {job.name}
                      {/* Enabled/Disabled badge */}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full`}
                        style={{
                          backgroundColor: job.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: job.enabled ? 'var(--color-success)' : 'var(--color-error)',
                        }}>
                        {job.enabled ? 'enabled' : 'disabled'}
                      </span>
                      {/* Schedule type badge */}
                      <ScheduleKindBadge kind={kind} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {/* Cron expression */}
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                        {scheduleExpr}
                      </span>
                      {/* Human-readable */}
                      <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
                        {humanSchedule}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {job.last_run && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          last: {job.last_run}
                        </span>
                      )}
                      {job.next_run && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          next: {job.next_run}
                        </span>
                      )}
                    </div>
                    {!isExpanded && (
                      <div className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {(job.prompt || '').slice(0, 120)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleMutation.mutate({ id: job.id, enabled: !job.enabled })}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {job.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this job?')) deleteMutation.mutate(job.id) }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--color-error)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Full Prompt
                  </div>
                  <pre className="text-sm whitespace-pre-wrap break-words p-3 rounded font-sans leading-relaxed"
                    style={{ backgroundColor: 'var(--color-bg)' }}>
                    {job.prompt || '(empty)'}
                  </pre>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>ID:</span>{' '}
                      <span className="font-mono">{job.id}</span>
                    </div>
                    <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Type:</span>{' '}
                      <span className="font-mono">{kind}</span>
                    </div>
                    <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Schedule:</span>{' '}
                      <span className="font-mono">{scheduleExpr}</span>
                    </div>
                    {job.created_at && (
                      <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Created:</span>{' '}
                        {job.created_at}
                      </div>
                    )}
                    {job.last_run && (
                      <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Last run:</span>{' '}
                        {job.last_run}
                      </div>
                    )}
                  </div>
                  <CronJobOutput jobId={job.id} />
                </div>
              )}
            </div>
          )
        })}
        {data?.jobs.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No cron jobs configured</p>
        )}
      </div>
    </div>
  )
}

const KIND_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  cron: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', label: 'recurring' },
  interval: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'interval' },
  once: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'one-time' },
}

function ScheduleKindBadge({ kind }: { kind: 'cron' | 'interval' | 'once' }) {
  const style = KIND_STYLES[kind] || KIND_STYLES.cron
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}>
      {style.label}
    </span>
  )
}

function CronJobOutput({ jobId }: { jobId: string }) {
  const { data } = useQuery({
    queryKey: ['cron-output', jobId],
    queryFn: () => api.cronJobOutput(jobId),
  })

  if (!data?.outputs.length) return null

  return (
    <div className="mt-3">
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
        Recent Executions ({data.outputs.length})
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {data.outputs.map((out, i) => (
          <details key={i} className="text-xs">
            <summary className="cursor-pointer p-1.5 rounded"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
              Run #{data.outputs.length - i}
              {!!(out as Record<string, unknown>).timestamp && ` — ${String((out as Record<string, unknown>).timestamp)}`}
            </summary>
            <pre className="text-xs p-2 mt-1 rounded overflow-x-auto font-mono whitespace-pre-wrap"
              style={{ backgroundColor: 'var(--color-bg)' }}>
              {JSON.stringify(out, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </div>
  )
}

function CronJobForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [prompt, setPrompt] = useState('')

  const createMutation = useMutation({
    mutationFn: api.createCronJob,
    onSuccess: () => onCreated(),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name && schedule && prompt) {
      createMutation.mutate({ name, schedule, prompt })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-surface)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Job name"
        className="w-full px-3 py-1.5 rounded border text-sm outline-none"
        style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
      <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Cron schedule (e.g. 0 * * * *)"
        className="w-full px-3 py-1.5 rounded border text-sm font-mono outline-none"
        style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt to execute"
        rows={3}
        className="w-full px-3 py-1.5 rounded border text-sm outline-none resize-none"
        style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
      <button type="submit" className="px-4 py-1.5 rounded text-sm font-medium text-white"
        style={{ backgroundColor: 'var(--color-primary)' }}>
        Create Job
      </button>
    </form>
  )
}
