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
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)

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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Subtle gradient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(94, 106, 210, 0.06) 0%, transparent 60%)',
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative rounded-xl p-8 w-[380px] space-y-5 animate-fade-in"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%)',
              color: '#fff',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            H
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
              Hermes WebUI
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Enter your auth token to continue
            </p>
          </div>
        </div>

        <div>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError('') }}
            placeholder="Auth token"
            className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none font-mono transition-all placeholder:opacity-30"
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            autoFocus
          />
          {error && (
            <p className="text-[11px] mt-1.5 font-medium" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #7c85e0 100%)',
            boxShadow: 'var(--shadow-glow)',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          {loading ? 'Authenticating...' : 'Login'}
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
    <div className="flex min-h-screen md:h-screen md:overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
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
