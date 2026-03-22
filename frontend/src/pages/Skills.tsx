import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { SkillInfo } from '../api/types'

export function Skills() {
  const [inspecting, setInspecting] = useState<{ source: string; dirName: string } | null>(null)

  const { data: builtinData } = useQuery({
    queryKey: ['builtin-skills'],
    queryFn: api.builtinSkills,
  })

  const { data: customData } = useQuery({
    queryKey: ['custom-skills'],
    queryFn: api.customSkills,
  })

  if (inspecting) {
    return (
      <SkillInspector
        source={inspecting.source}
        dirName={inspecting.dirName}
        onBack={() => setInspecting(null)}
      />
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Skills</h2>

      {/* Custom Skills */}
      {customData && customData.skills.length > 0 && (
        <section>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Custom Skills ({customData.skills.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customData.skills.map((skill) => (
              <SkillCard
                key={skill.dir_name}
                skill={skill}
                source="custom"
                onInspect={() => setInspecting({ source: 'custom', dirName: skill.dir_name })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Built-in Skills */}
      {builtinData && (
        <section>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Built-in Skills ({builtinData.skills.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {builtinData.skills.map((skill) => (
              <SkillCard
                key={skill.dir_name}
                skill={skill}
                source="builtin"
                onInspect={() => setInspecting({ source: 'builtin', dirName: skill.dir_name })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SkillCard({
  skill,
  source,
  onInspect,
}: {
  skill: SkillInfo
  source: string
  onInspect: () => void
}) {
  return (
    <div
      className="rounded-lg border p-3 cursor-pointer transition-colors"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      onClick={onInspect}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{skill.name}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: source === 'custom' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.1)',
            color: source === 'custom' ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}
        >
          {source}
        </span>
      </div>
      {skill.description && (
        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
          {skill.description}
        </p>
      )}
      {!skill.description && (
        <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
          No description
        </p>
      )}
      {skill.tools.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {skill.tools.slice(0, 4).map((tool) => (
            <span
              key={tool}
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
            >
              {tool}
            </span>
          ))}
          {skill.tools.length > 4 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              +{skill.tools.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function SkillInspector({
  source,
  dirName,
  onBack,
}: {
  source: string
  dirName: string
  onBack: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['skill-detail', source, dirName],
    queryFn: () => api.skillDetail(source, dirName),
  })

  const [activeTab, setActiveTab] = useState<'docs' | 'code'>('docs')

  if (isLoading) return <div className="p-6">Loading skill...</div>
  if (!data) return <div className="p-6">Skill not found</div>

  const docEntries = Object.entries(data.docs)
  const codeEntries = Object.entries(data.py_files)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="text-xs mb-2 inline-block"
          style={{ color: 'var(--color-primary)' }}
        >
          &larr; Back to Skills
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{data.name}</h2>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: source === 'custom' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.1)',
              color: source === 'custom' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            {source}
          </span>
        </div>
        {data.description && (
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {data.description}
          </p>
        )}
      </div>

      {/* Tab switch */}
      <div className="flex gap-1">
        <button
          onClick={() => setActiveTab('docs')}
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{
            backgroundColor: activeTab === 'docs' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === 'docs' ? 'white' : 'var(--color-text-muted)',
          }}
        >
          Docs ({docEntries.length})
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{
            backgroundColor: activeTab === 'code' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === 'code' ? 'white' : 'var(--color-text-muted)',
          }}
        >
          Code ({codeEntries.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'docs' && (
        <div className="space-y-3">
          {docEntries.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No documentation files</p>
          )}
          {docEntries.map(([name, content]) => (
            <FileViewer key={name} name={name} content={content} defaultOpen={docEntries.length <= 2} />
          ))}
        </div>
      )}

      {activeTab === 'code' && (
        <div className="space-y-3">
          {codeEntries.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No Python files</p>
          )}
          {codeEntries.map(([name, content]) => (
            <FileViewer key={name} name={name} content={content} mono />
          ))}
        </div>
      )}
    </div>
  )
}

function FileViewer({
  name,
  content,
  mono,
  defaultOpen,
}: {
  name: string
  content: string
  mono?: boolean
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--color-border)' }}>
      <summary
        className="px-3 py-2 cursor-pointer text-sm font-medium"
        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
      >
        {name}
        <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {content.split('\n').length} lines
        </span>
      </summary>
      <pre
        className={`text-xs p-3 overflow-x-auto whitespace-pre-wrap ${mono ? 'font-mono' : 'font-sans'}`}
        style={{ backgroundColor: 'var(--color-bg)', maxHeight: '500px', overflowY: 'auto' }}
      >
        {content}
      </pre>
    </details>
  )
}
