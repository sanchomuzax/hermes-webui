interface HeaderProps {
  connected: boolean
  onThemeToggle: () => void
  theme: string
  onMenuToggle: () => void
}

export function Header({ connected, onThemeToggle, theme, onMenuToggle }: HeaderProps) {
  return (
    <header
      className="h-11 flex items-center justify-between px-4"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden text-sm p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          onClick={onMenuToggle}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect y="2" width="16" height="1.5" rx="0.75" />
            <rect y="7" width="16" height="1.5" rx="0.75" />
            <rect y="12" width="16" height="1.5" rx="0.75" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`w-[6px] h-[6px] rounded-full ${connected ? 'animate-pulse-subtle' : ''}`}
            style={{
              backgroundColor: connected ? 'var(--color-success)' : 'var(--color-error)',
              boxShadow: connected ? '0 0 6px rgba(63, 185, 80, 0.4)' : 'none',
            }}
          />
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      <button
        onClick={onThemeToggle}
        className="text-[13px] w-7 h-7 flex items-center justify-center rounded-md transition-all"
        style={{
          color: 'var(--color-text-muted)',
          backgroundColor: 'transparent',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </header>
  )
}
