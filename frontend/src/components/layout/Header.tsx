interface HeaderProps {
  connected: boolean
  onThemeToggle: () => void
  theme: string
  onMenuToggle: () => void
}

export function Header({ connected, onThemeToggle, theme, onMenuToggle }: HeaderProps) {
  return (
    <header
      className="h-12 border-b flex items-center justify-between px-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden text-lg p-1"
          style={{ color: 'var(--color-text-muted)' }}
          onClick={onMenuToggle}
        >
          ☰
        </button>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: connected ? 'var(--color-success)' : 'var(--color-error)' }}
        />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <button
        onClick={onThemeToggle}
        className="text-sm px-2 py-1 rounded"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </header>
  )
}
