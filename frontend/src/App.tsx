import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './pages/Dashboard'
import { Sessions } from './pages/Sessions'
import { SessionDetail } from './pages/SessionDetail'
import { Config } from './pages/Config'
import { Cron } from './pages/Cron'
import { Skills } from './pages/Skills'
import { useWebSocket } from './hooks/useWebSocket'
import { setToken } from './api/client'

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      const res = await fetch('/api/health', {
        headers: { 'X-Hermes-Token': input.trim() },
      })
      if (res.ok) {
        onLogin(input.trim())
      } else {
        setError('Invalid token')
      }
    } catch {
      setError('Cannot connect to server')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <form onSubmit={handleSubmit} className="rounded-xl border p-8 w-96 space-y-4"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <h1 className="text-xl font-bold text-center" style={{ color: 'var(--color-primary)' }}>
          Hermes WebUI
        </h1>
        <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
          Enter your auth token to continue
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError('') }}
          placeholder="Auth token"
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none font-mono"
          style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          autoFocus
        />
        {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
        <button type="submit" className="w-full py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          Login
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(
    () => sessionStorage.getItem('hermes_webui_token')
  )
  const [theme, setTheme] = useState<string>('dark')

  const { connected } = useWebSocket(token)

  const handleLogin = useCallback((t: string) => {
    setToken(t)
    setTokenState(t)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!token) {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          connected={connected}
          onThemeToggle={toggleTheme}
          theme={theme}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/config" element={<Config />} />
            <Route path="/cron" element={<Cron />} />
            <Route path="/skills" element={<Skills />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
