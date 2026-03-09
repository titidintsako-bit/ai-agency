import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAgents, getConversations, getEscalations, getStats } from '../api/dashboard'
import StatCard from '../components/StatCard'

const REFRESH_MS = 10_000

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtZar = v => (v == null ? '—' : `R ${Number(v).toFixed(2)}`)

const STATUS_DOT = {
  active:    { color: '#3fb950', shadow: '0 0 6px #3fb95066' },
  completed: { color: '#8b949e', shadow: 'none' },
  escalated: { color: '#f85149', shadow: '0 0 6px #f8514966' },
  abandoned: { color: '#6e7681', shadow: 'none' },
}

// ── Agent status card ─────────────────────────────────────────────────────────

function AgentCard({ agent }) {
  const channel = agent.channel === 'whatsapp' ? 'WhatsApp' : 'Web'
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl"
      style={{ background: '#161b22', border: '1px solid #21262d' }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{
          background: agent.is_active ? '#3fb950' : '#8b949e',
          boxShadow: agent.is_active ? '0 0 8px #3fb95088' : 'none',
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>{agent.name}</p>
        <p className="text-xs" style={{ color: '#8b949e' }}>
          {agent.clients?.name || '—'} · {channel} · {agent.model?.includes('haiku') ? 'Haiku' : 'Sonnet'}
        </p>
      </div>
      <span
        className="text-xs px-2 py-0.5 rounded-full shrink-0"
        style={
          agent.is_active
            ? { background: 'rgba(63,185,80,0.12)', color: '#3fb950' }
            : { background: 'rgba(139,148,158,0.1)', color: '#8b949e' }
        }
      >
        {agent.is_active ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

// ── Live feed row ─────────────────────────────────────────────────────────────

function FeedRow({ conv, isNew }) {
  const dot = STATUS_DOT[conv.status] || STATUS_DOT.completed
  const time = new Date(conv.started_at)

  return (
    <Link
      to={`/conversations/${conv.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150"
      style={{
        background: isNew ? 'rgba(99,102,241,0.05)' : 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = isNew ? 'rgba(99,102,241,0.05)' : 'transparent' }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: dot.color, boxShadow: dot.shadow }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate" style={{ color: '#e6edf3' }}>
          {conv.user_identifier || 'Anonymous'}
          <span className="ml-2 text-xs" style={{ color: '#6e7681' }}>
            {conv.clients?.name || ''}
          </span>
        </p>
        <p className="text-xs" style={{ color: '#8b949e' }}>
          {conv.agents?.name || '—'} · {conv.channel}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs tabular-nums" style={{ color: '#6e7681' }}>
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-xs capitalize mt-0.5" style={{ color: dot.color }}>
          {conv.status}
        </p>
      </div>
    </Link>
  )
}

// ── Escalation mini row ───────────────────────────────────────────────────────

function EscalRow({ esc }) {
  return (
    <Link
      to="/escalations"
      className="flex items-start gap-3 px-4 py-3 rounded-lg transition-colors duration-150"
      style={{ background: 'rgba(248,81,73,0.04)', border: '1px solid rgba(248,81,73,0.12)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,81,73,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,81,73,0.04)' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth={1.8} className="w-4 h-4 mt-0.5 shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
          {esc.clients?.name || '—'}
        </p>
        <p className="text-xs truncate" style={{ color: '#8b949e' }}>
          {esc.reason} · {esc.summary?.slice(0, 60)}…
        </p>
      </div>
      <span className="text-xs shrink-0" style={{ color: '#f85149' }}>Review →</span>
    </Link>
  )
}

// ── Home page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [stats,         setStats]         = useState(null)
  const [agents,        setAgents]        = useState([])
  const [conversations, setConversations] = useState([])
  const [escalations,   setEscalations]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [lastRefresh,   setLastRefresh]   = useState(null)
  const [newIds,        setNewIds]        = useState(new Set())

  const prevConvIds = useRef(new Set())

  const fetchAll = useCallback(async () => {
    try {
      const [s, a, c, e] = await Promise.all([
        getStats(),
        getAgents(),
        getConversations({ limit: 20 }),
        getEscalations({ status: 'pending' }),
      ])

      const incoming = (c.conversations || [])
      const currentIds = new Set(incoming.map(r => r.id))

      // Highlight conversations that weren't in the previous fetch
      if (prevConvIds.current.size > 0) {
        const fresh = new Set([...currentIds].filter(id => !prevConvIds.current.has(id)))
        if (fresh.size) {
          setNewIds(fresh)
          setTimeout(() => setNewIds(new Set()), 4000)
        }
      }
      prevConvIds.current = currentIds

      setStats(s)
      setAgents(a.agents || [])
      setConversations(incoming)
      setEscalations(e.escalations || [])
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError('Failed to load data. Is the backend running?')
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Home</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#3fb950' }}
            />
            <p className="text-xs" style={{ color: '#8b949e' }}>
              Live · refreshes every 10s
              {lastRefresh && ` · last updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </p>
          </div>
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

      {/* Error banner */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}
        >
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Agents"
          value={stats ? `${stats.agents.active} / ${stats.agents.total}` : null}
          sub="agents online"
          accent="#6366f1"
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>}
        />
        <StatCard
          label="Conversations Today"
          value={stats?.conversations.today}
          sub={`${stats?.conversations.active_now ?? 0} active right now`}
          accent="#3fb950"
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
        <StatCard
          label="Cost Today"
          value={stats ? fmtZar(stats.cost_zar.today) : null}
          sub={stats ? `${fmtZar(stats.cost_zar.this_month)} this month` : null}
          accent="#f0883e"
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <StatCard
          label="Pending Escalations"
          value={stats?.escalations.pending}
          sub="need your review"
          accent={stats?.escalations.pending > 0 ? '#f85149' : '#3fb950'}
          loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
      </div>

      {/* Agent grid + Live feed side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Agent grid */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #21262d' }}>
            <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Agent Status</p>
            <Link to="/conversations" className="text-xs transition-colors duration-150" style={{ color: '#6366f1' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#818cf8' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6366f1' }}>
              All →
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#21262d' }} />)}
              </div>
            ) : agents.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: '#6e7681' }}>No agents configured.</p>
            ) : (
              agents.map(a => <AgentCard key={a.id} agent={a} />)
            )}
          </div>
        </div>

        {/* Live activity feed */}
        <div
          className="xl:col-span-2 rounded-xl overflow-hidden"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #21262d' }}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Live Activity</p>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full tabular-nums"
                style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950' }}
              >
                {stats?.conversations.active_now ?? 0} active
              </span>
            </div>
            <Link to="/conversations" className="text-xs transition-colors duration-150" style={{ color: '#6366f1' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#818cf8' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6366f1' }}>
              View all →
            </Link>
          </div>

          <div className="p-3">
            {loading ? (
              <div className="space-y-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-10 h-10">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p style={{ color: '#6e7681' }}>No conversations yet. Send a test message!</p>
              </div>
            ) : (
              <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
                {conversations.map(c => (
                  <FeedRow key={c.id} conv={c} isNew={newIds.has(c.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending escalations */}
      {(escalations.length > 0 || loading) && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#161b22', border: '1px solid rgba(248,81,73,0.2)', borderLeft: '3px solid #f85149' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(248,81,73,0.12)' }}>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth={2} className="w-4 h-4">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
              <p className="text-sm font-semibold" style={{ color: '#f85149' }}>
                Escalations Requiring Review
              </p>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(248,81,73,0.12)', color: '#f85149' }}
              >
                {escalations.length}
              </span>
            </div>
            <Link to="/escalations" className="text-xs" style={{ color: '#f85149' }}>
              Review all →
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {escalations.slice(0, 3).map(e => <EscalRow key={e.id} esc={e} />)}
            {escalations.length > 3 && (
              <p className="text-xs text-center py-1" style={{ color: '#6e7681' }}>
                +{escalations.length - 3} more —{' '}
                <Link to="/escalations" style={{ color: '#6366f1' }}>view all</Link>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
