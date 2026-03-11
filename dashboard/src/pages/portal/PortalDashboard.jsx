/**
 * pages/portal/PortalDashboard.jsx
 *
 * Client portal home — headline stats + pending items at a glance.
 * Route: /portal
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPortalStats, getPortalAppointments, getPortalEscalations, getPortalAgents } from '../../api/portal'
import { usePortalAuth } from '../../context/PortalAuthContext'

const fmtZar = v => (v == null ? '—' : `R ${Number(v).toFixed(2)}`)

function StatCard({ label, value, sub, accent, icon, loading }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: '#161b22', border: '1px solid #21262d', borderTop: `2px solid ${accent}` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6e7681' }}>{label}</p>
        <span style={{ color: accent, opacity: 0.7 }}>{icon}</span>
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded animate-pulse" style={{ background: '#21262d' }} />
      ) : (
        <p className="text-3xl font-bold tabular-nums" style={{ color: '#e6edf3' }}>{value ?? '—'}</p>
      )}
      {sub && <p className="text-xs" style={{ color: '#6e7681' }}>{sub}</p>}
    </div>
  )
}

const LEAD_SCORE_STYLE = {
  booked:    { bg: 'rgba(63,185,80,0.12)',   text: '#3fb950' },
  urgent:    { bg: 'rgba(248,81,73,0.12)',   text: '#f85149' },
  qualified: { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
  active:    { bg: 'rgba(63,185,80,0.08)',   text: '#3fb950' },
  cold:      { bg: 'rgba(110,118,129,0.1)',  text: '#6e7681' },
}

function LeadBadge({ score }) {
  const s = LEAD_SCORE_STYLE[score] || LEAD_SCORE_STYLE.cold
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: s.bg, color: s.text }}>
      {score}
    </span>
  )
}

const STATUS_STYLE = {
  pending:   { color: '#f0883e' },
  confirmed: { color: '#3fb950' },
  completed: { color: '#8b949e' },
  cancelled: { color: '#f85149' },
}

export default function PortalDashboard() {
  const { clientName } = usePortalAuth()

  const [stats,      setStats]      = useState(null)
  const [appts,      setAppts]      = useState([])
  const [escalations,setEscalations]= useState([])
  const [agents,     setAgents]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastRefresh,setLastRefresh]= useState(null)

  const fetchAll = useCallback(async () => {
    try {
      const [s, a, e, ag] = await Promise.all([
        getPortalStats(),
        getPortalAppointments({ limit: 5, status: 'pending' }),
        getPortalEscalations({ status: 'pending' }),
        getPortalAgents(),
      ])
      setStats(s)
      setAppts(a.appointments || [])
      setEscalations(e.escalations || [])
      setAgents(ag.agents || [])
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Portal dashboard fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 30_000)
    return () => clearInterval(t)
  }, [fetchAll])

  const onlineAgents = agents.filter(a => a.is_active).length

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>
            Welcome back{clientName ? `, ${clientName}` : ''}
          </h1>
          <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#8b949e' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: '#3fb950' }} />
            Live · refreshes every 30s
            {lastRefresh && ` · ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e6edf3' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8b949e' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Conversations Today"
          value={stats?.conversations.today}
          sub={`${stats?.conversations.active_now ?? 0} active now`}
          accent="#6366f1"
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
        <StatCard
          label="Pending Appointments"
          value={stats?.appointments.pending}
          sub={`${stats?.appointments.this_month ?? 0} booked this month`}
          accent="#f0883e"
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          label="Pending Escalations"
          value={stats?.escalations.pending}
          sub="requiring follow-up"
          accent={stats?.escalations.pending > 0 ? '#f85149' : '#3fb950'}
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>}
        />
        <StatCard
          label="Agents Online"
          value={loading ? null : `${onlineAgents} / ${agents.length}`}
          sub="virtual receptionists"
          accent="#3fb950"
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>}
        />
      </div>

      {/* Two-column: pending appointments + agents */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Pending appointments */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#161b22', border: '1px solid #21262d' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #21262d' }}>
            <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Pending Appointments</p>
            <Link to="/portal/appointments" className="text-xs" style={{ color: '#6366f1' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#818cf8' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6366f1' }}>
              View all →
            </Link>
          </div>
          <div className="divide-y" style={{ '--tw-divide-color': '#21262d' }}>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: '#21262d' }} />)}
              </div>
            ) : appts.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-2">
                <p style={{ color: '#6e7681' }} className="text-sm">No pending appointments</p>
              </div>
            ) : (
              appts.map(a => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>{a.patient_name}</p>
                    <p className="text-xs truncate" style={{ color: '#8b949e' }}>
                      {a.service_type} · {a.preferred_date} {a.preferred_time}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full shrink-0 capitalize"
                    style={{ background: 'rgba(240,136,62,0.12)', color: STATUS_STYLE.pending.color }}
                  >
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agents + escalations */}
        <div className="space-y-4">

          {/* Agent status */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#161b22', border: '1px solid #21262d' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #21262d' }}>
              <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Your Agents</p>
              <Link to="/portal/agents" className="text-xs" style={{ color: '#6366f1' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#818cf8' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6366f1' }}>
                Manage →
              </Link>
            </div>
            <div className="p-4 space-y-2">
              {loading ? (
                <div className="h-12 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
              ) : agents.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#0d1117' }}>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: a.is_active ? '#3fb950' : '#6e7681', boxShadow: a.is_active ? '0 0 6px #3fb95088' : 'none' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: '#e6edf3' }}>{a.name}</p>
                    <p className="text-xs" style={{ color: '#6e7681' }}>{a.channel}</p>
                  </div>
                  <span className="text-xs" style={{ color: a.is_active ? '#3fb950' : '#6e7681' }}>
                    {a.is_active ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Escalations */}
          {escalations.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#161b22', border: '1px solid rgba(248,81,73,0.2)', borderLeft: '3px solid #f85149' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(248,81,73,0.12)' }}>
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth={2} className="w-4 h-4">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                  <p className="text-sm font-semibold" style={{ color: '#f85149' }}>
                    Needs Follow-up ({escalations.length})
                  </p>
                </div>
                <Link to="/portal/escalations" className="text-xs" style={{ color: '#f85149' }}>
                  View all →
                </Link>
              </div>
              <div className="p-4 space-y-2">
                {escalations.slice(0, 3).map(e => (
                  <div key={e.id} className="text-sm" style={{ color: '#e6edf3' }}>
                    <p className="truncate font-medium">{e.reason.replace('_', ' ')}</p>
                    <p className="text-xs truncate" style={{ color: '#8b949e' }}>{e.summary?.slice(0, 80)}…</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
