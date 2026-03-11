/**
 * pages/portal/PortalLogin.jsx
 *
 * Client portal login page.
 * Clients log in with their agency-assigned slug + password.
 * Route: /portal/login
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortalAuth } from '../../context/PortalAuthContext'

export default function PortalLogin() {
  const { login, loading } = usePortalAuth()
  const navigate = useNavigate()

  const [slug,     setSlug]     = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const result = await login(slug.trim().toLowerCase(), password)
    if (result.ok) {
      navigate('/portal', { replace: true })
    } else {
      setError(result.error || 'Invalid credentials.')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0d1117' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-6 h-6">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Client Portal</h1>
            <p className="text-sm mt-1" style={{ color: '#8b949e' }}>Sign in to view your dashboard</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>
                Client ID
              </label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="e.g. smilecare"
                required
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150"
                style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  color: '#e6edf3',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#30363d' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150"
                style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  color: '#e6edf3',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#30363d' }}
              />
            </div>

            {error && (
              <div
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !slug || !password}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity duration-150"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff',
                opacity: loading || !slug || !password ? 0.6 : 1,
                cursor: loading || !slug || !password ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#6e7681' }}>
          Don&apos;t have access? Contact your AI Agency representative.
        </p>

      </div>
    </div>
  )
}
