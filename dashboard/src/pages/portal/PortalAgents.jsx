/**
 * pages/portal/PortalAgents.jsx
 *
 * Client portal agents — view status and toggle agents on/off.
 * Route: /portal/agents
 */

import { useCallback, useEffect, useState } from 'react'
import { getPortalAgents, togglePortalAgent } from '../../api/portal'

function Toggle({ checked, onChange, loading }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      className="relative inline-flex items-center shrink-0"
      style={{ opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      <span style={{ width: 40, height: 22, borderRadius: 11, background: checked ? '#3fb950' : '#30363d', display: 'inline-block', transition: 'background 0.2s', boxShadow: checked ? '0 0 8px #3fb95044' : 'none' }} />
      <span style={{ position: 'absolute', left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: checked ? 'translateX(18px)' : 'translateX(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

function AgentCard({ agent, onToggle }) {
  const [toggling, setToggling] = useState(false)
  const [err,      setErr]      = useState(null)

  async function handleToggle() {
    setToggling(true)
    setErr(null)
    try {
      await onToggle(agent.id)
    } catch (e) {
      setErr(e.message)
    } finally {
      setToggling(false)
    }
  }

  const channelLabel = agent.channel === 'whatsapp' ? 'WhatsApp' : 'Web'
  const modelLabel   = agent.model?.includes('haiku') ? 'Haiku' : agent.model?.includes('sonnet') ? 'Sonnet' : 'Claude'

  return (
    <div className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: '#161b22', border: '1px solid #21262d', borderLeft: `3px solid ${agent.is_active ? '#3fb950' : '#30363d'}` }}>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: agent.is_active ? '#3fb950' : '#6e7681', boxShadow: agent.is_active ? '0 0 6px #3fb95088' : 'none' }} />
            <p className="text-sm font-semibold truncate" style={{ color: '#e6edf3' }}>{agent.name}</p>
          </div>
          <p className="text-xs" style={{ color: '#8b949e' }}>{channelLabel} · {modelLabel}</p>
        </div>
        <Toggle checked={agent.is_active} onChange={handleToggle} loading={toggling} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs px-2.5 py-1 rounded-lg font-medium"
          style={agent.is_active
            ? { background: 'rgba(63,185,80,0.1)', color: '#3fb950' }
            : { background: 'rgba(110,118,129,0.1)', color: '#6e7681' }
          }>
          {agent.is_active ? 'Online — accepting conversations' : 'Offline — not responding'}
        </span>
      </div>

      {err && <p className="text-xs" style={{ color: '#f85149' }}>{err}</p>}

      {!agent.is_active && (
        <p className="text-xs" style={{ color: '#6e7681' }}>
          Toggle on to resume your virtual receptionist. New conversations will be handled immediately.
        </p>
      )}
    </div>
  )
}

export default function PortalAgents() {
  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPortalAgents()
      setAgents(data.agents || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(id) {
    const data = await togglePortalAgent(id)
    setAgents(prev => prev.map(a => a.id === id ? { ...a, is_active: data.agent.is_active } : a))
  }

  const online = agents.filter(a => a.is_active).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between gap-4 shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Your Agents</h1>
          {!loading && (
            <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{online} of {agents.length} online</p>
          )}
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e6edf3' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8b949e' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm shrink-0"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: '#161b22' }} />)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map(a => <AgentCard key={a.id} agent={a} onToggle={handleToggle} />)}
          </div>
        )}
      </div>
    </div>
  )
}
