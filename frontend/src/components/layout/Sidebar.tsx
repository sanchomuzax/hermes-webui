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
        <div className="p-3 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Sancho Muzax v{health?.version || '...'}
          </p>
        </div>
      </aside>
    </>
  )
}
