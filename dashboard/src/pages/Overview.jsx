import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, accent = '#6366f1', loading }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: '#161b22', border: '1px solid #21262d' }}
    >
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: '#8b949e' }}>
        {label}
      </p>
      {loading ? (
        <div className="h-8 w-24 rounded animate-pulse" style={{ background: '#21262d' }} />
      ) : (
        <p className="text-3xl font-semibold tabular-nums" style={{ color: '#e6edf3' }}>
          {value}
        </p>
      )}
      {sub && (
        <p className="text-xs" style={{ color: '#8b949e' }}>
          {sub}
        </p>
      )}
      <div className="h-0.5 w-8 rounded-full mt-auto" style={{ background: accent }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agent status row
// ---------------------------------------------------------------------------

function AgentRow({ agent }) {
  const channel = agent.channel === 'whatsapp' ? 'WhatsApp' : 'Web'
  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded-lg"
      style={{ background: '#0d1117' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: agent.is_active ? '#3fb950' : '#8b949e',
            boxShadow: agent.is_active ? '0 0 6px #3fb95066' : 'none',
          }}
        />
        <div>
          <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
            {agent.name}
          </p>
          <p className="text-xs" style={{ color: '#8b949e' }}>
            {agent.clients?.name || '—'} · {channel}
          </p>
        </div>
      </div>
      <span
        className="text-xs px-2 py-0.5 rounded-full"
        style={
          agent.is_active
            ? { background: 'rgba(63,185,80,0.12)', color: '#3fb950' }
            : { background: 'rgba(139,148,158,0.1)', color: '#8b949e' }
        }
      >
        {agent.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent conversation row
// ---------------------------------------------------------------------------

function ConvRow({ conv }) {
  const status = conv.status
  const statusColors = {
    active:    { bg: 'rgba(63,185,80,0.12)',  text: '#3fb950' },
    ended:     { bg: 'rgba(139,148,158,0.1)', text: '#8b949e' },
    escalated: { bg: 'rgba(248,81,73,0.12)',  text: '#f85149' },
  }
  const sc = statusColors[status] || statusColors.ended

  return (
    <Link
      to={`/conversations/${conv.id}`}
      className="flex items-center justify-between py-3 px-4 rounded-lg transition-colors duration-150"
      style={{ background: '#0d1117' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#161b22' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#0d1117' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium"
          style={{ background: '#21262d', color: '#8b949e' }}
        >
          {(conv.user_identifier || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
            {conv.user_identifier || 'Unknown'}
          </p>
          <p className="text-xs truncate" style={{ color: '#8b949e' }}>
            {conv.clients?.name || '—'} · {conv.agents?.name || '—'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: sc.bg, color: sc.text }}
        >
          {status}
        </span>
        <span className="text-xs tabular-nums" style={{ color: '#6e7681' }}>
          {new Date(conv.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Escalation row (mini)
// ---------------------------------------------------------------------------

function EscalRow({ esc }) {
  return (
    <Link
      to="/escalations"
      className="flex items-start gap-3 py-3 px-4 rounded-lg transition-colors duration-150"
      style={{ background: '#0d1117' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#161b22' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#0d1117' }}
    >
      <span className="mt-0.5 shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth={1.8} className="w-4 h-4">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
          {esc.clients?.name || 'Unknown client'}
        </p>
        <p className="text-xs truncate" style={{ color: '#8b949e' }}>
          {esc.reason || esc.summary || 'No reason provided'}
        </p>
      </div>
      <span className="text-xs tabular-nums shrink-0 ml-2" style={{ color: '#6e7681' }}>
        {new Date(esc.flagged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Overview page
// ---------------------------------------------------------------------------

const REFRESH_MS = 30_000

export default function Overview() {
  const [stats, setStats]             = useState(null)
  const [agents, setAgents]           = useState([])
  const [conversations, setConvs]     = useState([])
  const [escalations, setEscalations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError]             = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      const [s, a, c, e] = await Promise.all([
        api.getStats(),
        api.getAgents(),
        api.getConversations({ limit: 10 }),
        api.getEscalations({ status: 'pending' }),
      ])
      setStats(s)
      setAgents(a.agents || [])
      setConvs(c.conversations || [])
      setEscalations(e.escalations || [])
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError('Failed to load dashboard data.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const timer = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(timer)
  }, [fetchAll])

  const fmtZar = v =>
    v == null ? '—' : `R ${Number(v).toFixed(2)}`

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Loading…'}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150"
          style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e6edf3' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8b949e' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}
        >
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Agents"
          value={loading ? null : `${stats?.agents?.active ?? 0} / ${stats?.agents?.total ?? 0}`}
          sub="agents running"
          accent="#6366f1"
          loading={loading}
        />
        <StatCard
          label="Conversations Today"
          value={loading ? null : stats?.conversations?.today ?? 0}
          sub={`${stats?.conversations?.active_now ?? 0} active now`}
          accent="#3fb950"
          loading={loading}
        />
        <StatCard
          label="Cost Today"
          value={loading ? null : fmtZar(stats?.cost_zar?.today)}
          sub={`${fmtZar(stats?.cost_zar?.this_month)} this month`}
          accent="#f0883e"
          loading={loading}
        />
        <StatCard
          label="Pending Escalations"
          value={loading ? null : stats?.escalations?.pending ?? 0}
          sub="need review"
          accent="#f85149"
          loading={loading}
        />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Agents */}
        <div
          className="rounded-xl p-5 space-y-3"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>Agents</p>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm" style={{ color: '#6e7681' }}>No agents configured.</p>
          ) : (
            <div className="space-y-1.5">
              {agents.map(a => <AgentRow key={a.id} agent={a} />)}
            </div>
          )}
        </div>

        {/* Recent conversations */}
        <div
          className="rounded-xl p-5 space-y-3 xl:col-span-1"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>Recent Conversations</p>
            <Link to="/conversations" className="text-xs" style={{ color: '#6366f1' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm" style={{ color: '#6e7681' }}>No conversations yet.</p>
          ) : (
            <div className="space-y-1.5">
              {conversations.map(c => <ConvRow key={c.id} conv={c} />)}
            </div>
          )}
        </div>

        {/* Pending escalations */}
        <div
          className="rounded-xl p-5 space-y-3"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>Pending Escalations</p>
            <Link to="/escalations" className="text-xs" style={{ color: '#6366f1' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1,2].map(i => (
                <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
              ))}
            </div>
          ) : escalations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth={1.5} className="w-8 h-8">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-sm" style={{ color: '#6e7681' }}>All clear — no pending escalations.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {escalations.map(e => <EscalRow key={e.id} esc={e} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
