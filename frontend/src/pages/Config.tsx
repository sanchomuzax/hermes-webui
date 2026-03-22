import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'

export function Config() {
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.config,
  })

  const { data: envData } = useQuery({
    queryKey: ['env-variables'],
    queryFn: api.envVariables,
  })

  const patchMutation = useMutation({
    mutationFn: ({ path, value }: { path: string; value: unknown }) => api.patchConfig(path, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config'] }),
  })

  if (isLoading) return <div className="p-6">Loading config...</div>

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Configuration</h2>

      {/* Config Sections */}
      {config?.config && Object.entries(config.config).map(([section, values]) => (
        <ConfigSection
          key={section}
          title={section}
          values={values as Record<string, unknown>}
          onSave={(path, value) => patchMutation.mutate({ path: `${section}.${path}`, value })}
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
  onSave,
}: {
  title: string
  values: Record<string, unknown>
  onSave: (path: string, value: unknown) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleEdit = (key: string, currentValue: unknown) => {
    setEditing(key)
    setEditValue(typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue))
  }

  const handleSave = (key: string) => {
    let parsedValue: unknown = editValue
    try {
      parsedValue = JSON.parse(editValue)
    } catch {
      // keep as string
    }
    onSave(key, parsedValue)
    setEditing(null)
  }

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
            {editing === key ? (
              <div className="flex-1 flex gap-1">
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-0.5 rounded text-xs font-mono border outline-none"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave(key)}
                />
                <button onClick={() => handleSave(key)} className="text-xs px-2 rounded"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>Save</button>
                <button onClick={() => setEditing(null)} className="text-xs px-2"
                  style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs font-mono truncate">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                </span>
                <button onClick={() => handleEdit(key, value)} className="text-xs px-2 py-0.5 rounded opacity-50 hover:opacity-100"
                  style={{ color: 'var(--color-primary)' }}>
                  Edit
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
