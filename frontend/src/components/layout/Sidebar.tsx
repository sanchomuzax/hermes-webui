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
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56 border-r flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              Hermes WebUI
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Agent Monitor
            </p>
          </div>
          {/* Close button — mobile only */}
          <button
            className="md:hidden text-lg p-1"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                  isActive ? 'font-medium' : ''
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-surface-hover)' : 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
              })}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Sancho Muzax
            </span>
            <a
              href="https://github.com/sanchomuzax/hermes-webui"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80"
              title="GitHub"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-text-muted)">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
            v{health?.version || '...'}
          </div>
        </div>
      </aside>
    </>
  )
}
