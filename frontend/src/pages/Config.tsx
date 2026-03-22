import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function Config() {
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['config'],
    queryFn: api.config,
  })

  const { data: envData } = useQuery({
    queryKey: ['env-variables'],
    queryFn: api.envVariables,
  })

  if (isLoading) return <div className="p-6">Loading config...</div>
  if (error) return <div className="p-6" style={{ color: 'var(--color-error)' }}>Failed to load config</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Configuration</h2>
        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>
          Read-only
        </span>
      </div>

      {/* Config Sections */}
      {config?.config && Object.entries(config.config).map(([section, values]) => (
        <ConfigSection
          key={section}
          title={section}
          values={values as Record<string, unknown>}
        />
      ))}

      {/* Environment Variables */}
      {envData?.variables && envData.variables.length > 0 && (
        <div className="rounded-lg border p-4"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Environment Variables (.env)
          </h3>
          <div className="space-y-1">
            {envData.variables.map((v) => (
              <div key={v.key} className="flex items-center gap-2 text-xs font-mono p-1.5 rounded"
                style={{ backgroundColor: 'var(--color-bg)' }}>
                <span className="font-medium min-w-[200px]">{v.key}</span>
                <span style={{ color: v.is_sensitive ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                  {v.value || '(empty)'}
                </span>
                {v.is_sensitive && (
                  <span className="ml-auto text-xs" style={{ color: 'var(--color-warning)' }}>sensitive</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigSection({
  title,
  values,
}: {
  title: string
  values: Record<string, unknown>
}) {
  if (typeof values !== 'object' || values === null) {
    return null
  }

  return (
    <div className="rounded-lg border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <h3 className="text-sm font-medium mb-3 capitalize" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </h3>
      <div className="space-y-1">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 text-sm p-1.5 rounded"
            style={{ backgroundColor: 'var(--color-bg)' }}>
            <span className="font-mono text-xs min-w-[160px]" style={{ color: 'var(--color-text-muted)' }}>
              {key}
            </span>
            <span className="flex-1 text-xs font-mono truncate">
              {formatValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
