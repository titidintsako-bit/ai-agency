import { useEffect, useRef, useState } from 'react'
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
    to: '/agents',
    label: 'Agents',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
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
    to: '/appointments',
    label: 'Appointments',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
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
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export default function Sidebar({ open, onClose }) {
  const location = useLocation()
  const { user, logout } = useAuth()

  const [health,  setHealth]  = useState(null)
  const [pending, setPending] = useState(0)
  const esRef = useRef(null)

  useEffect(() => {
    client.get('/health')
      .then(data => setHealth(data.status ?? 'ok'))
      .catch(() => setHealth('error'))
  }, [])

  // SSE: live escalation badge count
  useEffect(() => {
    if (!user) return

    const token = localStorage.getItem('token')
    if (!token) return

    const apiBase = import.meta.env.VITE_API_URL || ''
    const url = `${apiBase}/api/events/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('escalations', (e) => {
      try {
        const data = JSON.parse(e.data)
        setPending(data.pending ?? 0)
      } catch {}
    })

    es.onerror = () => {
      // Fallback: poll once on error
      client.get('/dashboard/escalations', { params: { status: 'pending' } })
        .then(data => setPending((data.escalations || []).length))
        .catch(() => {})
    }

    return () => { es.close(); esRef.current = null }
  }, [user])

  // Close sidebar on nav (mobile)
  function handleNavClick() {
    if (onClose) onClose()
  }

  const healthColor = { ok: '#3fb950', degraded: '#f0883e', error: '#f85149' }[health] ?? '#6e7681'
  const healthLabel = { ok: 'Connected', degraded: 'Degraded', error: 'Offline' }[health] ?? 'Checking…'

  return (
    <aside
      className={[
        'w-56 shrink-0 flex flex-col h-screen',
        // Mobile: fixed overlay that slides in/out
        'fixed inset-y-0 left-0 z-50',
        'transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full',
        // Desktop: static in-flow, always visible
        'md:relative md:translate-x-0 md:z-auto',
      ].join(' ')}
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none" style={{ color: '#e6edf3' }}>AI Agency</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#8b949e' }}>Admin</p>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden p-1 rounded"
          onClick={onClose}
          style={{ color: '#6e7681' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
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
              onClick={handleNavClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              style={active
                ? { background: 'rgba(99,102,241,0.12)', color: '#818cf8', boxShadow: 'inset 2px 0 0 #6366f1' }
                : { color: '#8b949e' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#e6edf3'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.background = 'transparent' } }}
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
