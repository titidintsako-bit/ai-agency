/**
 * pages/portal/PortalShell.jsx
 *
 * Layout wrapper for all authenticated portal pages.
 * Provides sidebar navigation scoped to what clients can see:
 *   - Dashboard (stats overview)
 *   - Conversations
 *   - Appointments
 *   - Escalations
 *   - Agents (toggle on/off)
 *
 * Redirects to /portal/login if not authenticated.
 */

import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { usePortalAuth } from '../../context/PortalAuthContext'

const NAV = [
  {
    to: '/portal',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    to: '/portal/appointments',
    label: 'Appointments',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    to: '/portal/conversations',
    label: 'Conversations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    to: '/portal/escalations',
    label: 'Escalations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/portal/agents',
    label: 'Agents',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    ),
  },
]

function PortalSidebar({ open, onClose, clientName, slug, onLogout }) {
  const location = useLocation()

  return (
    <aside
      className={[
        'w-56 shrink-0 flex flex-col h-screen',
        'fixed inset-y-0 left-0 z-50',
        'transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full',
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
          <p className="text-sm font-semibold leading-none truncate" style={{ color: '#e6edf3' }}>
            {clientName || 'Portal'}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#8b949e' }}>{slug || 'client'}</p>
        </div>
        <button className="md:hidden p-1 rounded" onClick={onClose} style={{ color: '#6e7681' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon }) => {
          const active = to === '/portal'
            ? location.pathname === '/portal'
            : location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              style={active
                ? { background: 'rgba(99,102,241,0.12)', color: '#818cf8', boxShadow: 'inset 2px 0 0 #6366f1' }
                : { color: '#8b949e' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#e6edf3'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.background = 'transparent' } }}
            >
              {icon}
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid #1e2d45' }}>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150"
          style={{ color: '#8b949e' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f85149'; e.currentTarget.style.background = 'rgba(248,81,73,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.background = 'transparent' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}

export default function PortalShell({ children }) {
  const { token, clientName, slug, logout } = usePortalAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!token) return <Navigate to="/portal/login" replace />

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d1117' }}>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        clientName={clientName}
        slug={slug}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 shrink-0"
          style={{ height: 48, borderBottom: '1px solid #21262d', background: '#0d1117' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ color: '#8b949e', display: 'flex', alignItems: 'center', padding: 4 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
              <line x1="3" y1="6"  x2="21" y2="6"  strokeLinecap="round"/>
              <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round"/>
              <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round"/>
            </svg>
          </button>
          <span style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600 }}>{clientName || 'Portal'}</span>
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
