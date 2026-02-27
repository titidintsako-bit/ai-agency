import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

const NAV = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    to: '/conversations',
    label: 'Conversations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    to: '/escalations',
    label: 'Escalations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
  },
  {
    to: '/config',
    label: 'Agent Config',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const [health,  setHealth]  = useState(null)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    client.get('/health')
      .then(data => setHealth(data.status ?? 'ok'))
      .catch(() => setHealth('error'))
  }, [])

  useEffect(() => {
    if (!user) return
    client.get('/dashboard/escalations', { params: { status: 'pending' } })
      .then(data => setPending((data.escalations || []).length))
      .catch(() => {})
  }, [location.pathname, user])

  const healthColor = { ok: '#3fb950', degraded: '#f0883e', error: '#f85149' }[health] ?? '#6e7681'
  const healthLabel = { ok: 'Connected', degraded: 'Degraded', error: 'Offline' }[health] ?? 'Checking…'

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-screen"
      style={{ background: '#0d1526', borderRight: '1px solid #1e2d45' }}
    >
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #1e2d45' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none" style={{ color: '#e6edf3' }}>AI Agency</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#8b949e' }}>Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon }) => {
          const active = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150"
              style={active ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8' } : { color: '#8b949e' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e6edf3' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#8b949e' }}
            >
              {icon}
              <span>{label}</span>
              {label === 'Escalations' && pending > 0 && (
                <span
                  className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(248,81,73,0.15)', color: '#f85149' }}
                >
                  {pending}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid #1e2d45' }}>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: healthColor, boxShadow: health === 'ok' ? `0 0 5px ${healthColor}88` : 'none' }}
          />
          <span className="text-xs" style={{ color: '#6e7681' }}>{healthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
            style={{ background: '#21262d', color: '#8b949e' }}
          >
            {(user || '?')[0].toUpperCase()}
          </div>
          <p className="text-xs truncate flex-1" style={{ color: '#8b949e' }}>{user || 'Admin'}</p>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1 rounded"
            style={{ color: '#6e7681' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f85149' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6e7681' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
