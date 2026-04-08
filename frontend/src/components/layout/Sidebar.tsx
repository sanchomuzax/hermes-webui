import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { api } from '../../api/client'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '◉' },
  { path: '/sessions', label: 'Sessions', icon: '◧' },
  { path: '/config', label: 'Config', icon: '⚙' },
  { path: '/cron', label: 'Cron', icon: '⏱' },
  { path: '/skills', label: 'Skills', icon: '✦' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    staleTime: 60000,
  })

  return (
    <>
      {/* Overlay — mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-[220px] flex flex-col
          transform transition-transform duration-200
          md:relative md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        {/* Brand */}
        <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%)',
                color: '#fff',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              H
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
                Hermes
              </div>
              <div className="text-[10px] leading-tight" style={{ color: 'var(--color-text-faint)' }}>
                Agent Monitor
              </div>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            className="md:hidden text-sm p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] mb-0.5 transition-all ${
                  isActive ? 'font-medium' : ''
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(94, 106, 210, 0.1)' : 'none',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget
                if (!el.classList.contains('active')) {
                  el.style.backgroundColor = 'var(--color-surface-hover)'
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                // Reset only if not active — NavLink re-renders will fix active state
                const isActive = el.getAttribute('aria-current') === 'page'
                if (!isActive) {
                  el.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span className="text-sm opacity-60" style={{ width: '16px', textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-faint)' }}>
              v{health?.version || '...'}
            </span>
            <a
              href="https://github.com/sanchomuzax/hermes-webui"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-40 hover:opacity-70 transition-opacity"
              title="GitHub"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="var(--color-text-muted)">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
          </div>
        </div>
      </aside>
    </>
  )
}
