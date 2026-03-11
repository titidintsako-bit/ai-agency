/**
 * Agents — Agent Control Panel
 *
 * Route: /agents (protected)
 * Shows all agents across all clients with live status, model info,
 * and a toggle switch to enable/disable each agent instantly.
 */

import { useCallback, useEffect, useState } from 'react'
import { getAgents, toggleAgent } from '../api/dashboard'
import { useToast } from '../context/ToastContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function modelLabel(model) {
  if (!model) return '—'
  if (model.includes('haiku'))  return 'Haiku'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus'))   return 'Opus'
  return model
}

const CHANNEL_ICON = {
  web: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  ),
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, loading }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      aria-label={checked ? 'Disable agent' : 'Enable agent'}
      className="relative inline-flex items-center shrink-0 transition-opacity duration-150"
      style={{ opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      <span
        className="inline-block transition-colors duration-200"
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? '#3fb950' : '#30363d',
          boxShadow: checked ? '0 0 8px #3fb95044' : 'none',
        }}
      />
      <span
        className="absolute transition-transform duration-200"
        style={{
          left: 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ agent, onToggle }) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    await onToggle(agent.id)
    setToggling(false)
  }

  const channelIcon  = CHANNEL_ICON[agent.channel] || CHANNEL_ICON.web
  const channelLabel = agent.channel === 'whatsapp' ? 'WhatsApp' : 'Web'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 transition-all duration-150"
      style={{
        background: '#161b22',
        border: agent.is_active ? '1px solid #21262d' : '1px solid #21262d',
        borderLeft: `3px solid ${agent.is_active ? '#3fb950' : '#30363d'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: agent.is_active ? '#3fb950' : '#6e7681',
                boxShadow: agent.is_active ? '0 0 6px #3fb95088' : 'none',
              }}
            />
            <p className="text-sm font-semibold truncate" style={{ color: '#e6edf3' }}>
              {agent.name}
            </p>
          </div>
          <p className="text-xs truncate" style={{ color: '#8b949e' }}>
            {agent.clients?.name || '—'}
          </p>
        </div>

        <Toggle
          checked={agent.is_active}
          onChange={handleToggle}
          loading={toggling}
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#818cf8' }}
        >
          {channelIcon}
          {channelLabel}
        </span>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
          style={{ background: '#21262d', color: '#8b949e' }}
        >
          {modelLabel(agent.model)}
        </span>
        <span
          className="ml-auto text-xs px-2.5 py-1 rounded-lg font-medium"
          style={
            agent.is_active
              ? { background: 'rgba(63,185,80,0.1)', color: '#3fb950' }
              : { background: 'rgba(110,118,129,0.1)', color: '#6e7681' }
          }
        >
          {agent.is_active ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: '#6e7681' }}>
          Added {fmtDate(agent.created_at)}
        </p>
        <p className="text-xs" style={{ color: '#6e7681' }}>
          {agent.clients?.slug || ''}
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Agents() {
  const toast = useToast()

  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAgents()
      setAgents(data.agents || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(agentId) {
    try {
      const data = await toggleAgent(agentId)
      setAgents(prev =>
        prev.map(a => a.id === agentId ? { ...a, is_active: data.agent.is_active } : a)
      )
      const updated = agents.find(a => a.id === agentId)
      const newState = data.agent.is_active
      toast(`${updated?.name || 'Agent'} ${newState ? 'enabled' : 'disabled'}`, newState ? 'success' : 'info')
    } catch (e) {
      toast('Failed to toggle agent: ' + e.message, 'error')
    }
  }

  const online  = agents.filter(a => a.is_active).length
  const offline = agents.length - online

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-4 shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}
      >
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Agent Control Panel</h1>
          {!loading && (
            <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
              {online} online · {offline} offline
            </p>
          )}
        </div>

        <button
          onClick={load}
          disabled={loading}
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

      {/* Error */}
      {error && (
        <div
          className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm shrink-0"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}
        >
          {error}
        </div>
      )}

      {/* Stats strip */}
      {!loading && agents.length > 0 && (
        <div
          className="px-6 py-3 flex items-center gap-6 shrink-0"
          style={{ borderBottom: '1px solid #21262d', background: 'rgba(99,102,241,0.03)' }}
        >
          {[
            { label: 'Total',   value: agents.length },
            { label: 'Online',  value: online,  color: '#3fb950' },
            { label: 'Offline', value: offline, color: offline > 0 ? '#f0883e' : '#6e7681' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#6e7681' }}>{label}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: color || '#e6edf3' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl animate-pulse" style={{ background: '#161b22' }} />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            <p style={{ color: '#6e7681' }}>No agents configured yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map(a => (
              <AgentCard key={a.id} agent={a} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
