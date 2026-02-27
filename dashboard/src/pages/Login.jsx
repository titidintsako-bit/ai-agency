import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, token, loading } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [showPw,   setShowPw]   = useState(false)

  // Already logged in — bounce away
  useEffect(() => {
    if (token) navigate(from, { replace: true })
  }, [token, navigate, from])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const result = await login(email.trim(), password)
    if (result.ok) {
      navigate(from, { replace: true })
    } else {
      setError(result.error || 'Invalid email or password.')
      setPassword('')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#0d1117' }}
    >
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-6 h-6">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M8 12h8M12 8v8" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>AI Agency</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>Admin Dashboard</p>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#161b22', border: '1px solid #21262d' }}
      >
        <h2 className="text-lg font-semibold mb-6" style={{ color: '#e6edf3' }}>Sign in</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@youragency.com"
              className="mt-1.5 block w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: '#0d1117',
                border: '1px solid #30363d',
                color: '#e6edf3',
              }}
              onFocus={e  => { e.currentTarget.style.borderColor = '#6366f1' }}
              onBlur={e   => { e.currentTarget.style.borderColor = '#30363d' }}
            />
          </label>

          {/* Password */}
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>
              Password
            </span>
            <div className="relative mt-1.5">
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors"
                style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  color: '#e6edf3',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#30363d' }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#6e7681' }}
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </label>

          {/* Error */}
          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.2)' }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity duration-150"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#fff',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs" style={{ color: '#6e7681' }}>
        Session expires after 24 hours
      </p>
    </div>
  )
}
