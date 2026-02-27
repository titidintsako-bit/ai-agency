/**
 * Monitor — Live conversation monitor.
 *
 * Route:    /monitor  (public, password-gated)
 * Password: autocore2026  (hardcoded)
 * API:      GET /api/monitor/conversations?password=autocore2026
 *
 * Features:
 *  - Password gate (stored in sessionStorage)
 *  - Live grid of all conversations
 *  - Click-to-open thread panel
 *  - Auto-refreshes every 5 seconds
 *  - Cost in ZAR per conversation
 *  - Mobile responsive
 */

import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = '/api'
const PASSWORD = 'autocore2026'
const STORAGE_KEY = 'monitor_pw_ok'
const REFRESH_MS = 5_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return d.toLocaleDateString()
}

function fmtClock(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtZar(v) {
  if (!v && v !== 0) return '—'
  return `R ${Number(v).toFixed(2)}`
}

const STATUS_CONFIG = {
  active:    { color: '#3fb950', label: 'Active',    glow: true  },
  completed: { color: '#8b949e', label: 'Ended',     glow: false },
  escalated: { color: '#f85149', label: 'Escalated', glow: false },
  abandoned: { color: '#6e7681', label: 'Abandoned', glow: false },
}

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onSuccess }) {
  const [value,  setValue]  = useState('')
  const [error,  setError]  = useState(false)
  const [shake,  setShake]  = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function attempt() {
    if (value === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, '1')
      onSuccess()
    } else {
      setError(true)
      setShake(true)
      setValue('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0d1117' }}
    >
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-6px); }
          40%,80% { transform: translateX(6px); }
        }
        .shake { animation: shake 0.4s ease; }
      `}</style>

      <div
        className={`w-full max-w-xs rounded-2xl p-8 space-y-5 ${shake ? 'shake' : ''}`}
        style={{ background: '#161b22', border: '1px solid #21262d' }}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-7 h-7">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-lg font-semibold" style={{ color: '#e6edf3' }}>Live Monitor</h1>
          <p className="text-sm mt-1" style={{ color: '#8b949e' }}>Enter access password</p>
        </div>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none text-center tracking-widest"
            style={{
              background: '#0d1117',
              border: `1px solid ${error ? '#f85149' : '#30363d'}`,
              color: '#e6edf3',
            }}
          />

          {error && (
            <p className="text-xs text-center" style={{ color: '#f85149' }}>
              Incorrect password
            </p>
          )}

          <button
            onClick={attempt}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Conversation card ─────────────────────────────────────────────────────────

function ConvCard({ conv, onClick, isSelected }) {
  const sc = STATUS_CONFIG[conv.status] || STATUS_CONFIG.completed

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-all duration-150 space-y-2"
      style={{
        background: isSelected ? 'rgba(99,102,241,0.12)' : '#161b22',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : '#21262d'}`,
      }}
    >
      {/* Top row: status + client + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: sc.color,
              boxShadow: sc.glow ? `0 0 6px ${sc.color}88` : 'none',
            }}
          />
          <span className="text-xs font-medium truncate" style={{ color: sc.color }}>
            {sc.label}
          </span>
          {conv.status === 'active' && (
            <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse"
              style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950' }}>
              live
            </span>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: '#6e7681' }}>
          {fmtTime(conv.started_at)}
        </span>
      </div>

      {/* Client + agent */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
          {conv.clients?.name || '—'}
          <span className="ml-1.5 text-xs font-normal" style={{ color: '#8b949e' }}>
            via {conv.channel}
          </span>
        </p>
        <span className="text-xs shrink-0" style={{ color: '#8b949e' }}>
          {conv.agents?.name || ''}
        </span>
      </div>

      {/* Last message preview */}
      {conv.last_message && (
        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: '#8b949e' }}>
          {conv.last_message_role === 'assistant' ? '🤖 ' : '👤 '}
          {conv.last_message}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#6e7681' }}>
            💬 {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
          </span>
          <span className="text-xs" style={{ color: '#6e7681' }}>
            💰 {fmtZar(conv.cost_zar)}
          </span>
        </div>
        <span className="text-xs" style={{ color: '#6e7681' }}>
          {conv.user_identifier?.slice(0, 12) || 'anonymous'}
        </span>
      </div>
    </button>
  )
}

// ── Thread panel ──────────────────────────────────────────────────────────────

function ThreadPanel({ convId, onClose }) {
  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState(true)
  const bottomRef  = useRef(null)

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${API_BASE}/monitor/conversations/${convId}/messages`,
        { params: { password: PASSWORD } }
      )
      setMessages(data.messages || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [convId])

  useEffect(() => { load() }, [load])

  // Auto-refresh thread every 5s
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#0d1117' }}
    >
      {/* Panel header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid #21262d', background: '#161b22' }}
      >
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg"
          style={{ color: '#8b949e' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e6edf3' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8b949e' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
          Thread · {messages.length} messages
        </p>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full animate-pulse"
          style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950' }}
        >
          live
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div
                className="h-10 rounded-2xl animate-pulse"
                style={{ width: '55%', background: '#21262d' }}
              />
            </div>
          ))
        ) : messages.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: '#6e7681' }}>
            No messages yet.
          </p>
        ) : (
          messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} py-0.5`}>
                <div style={{ maxWidth: '80%' }}>
                  <div
                    className="px-3 py-2 rounded-2xl text-sm leading-relaxed"
                    style={{
                      background: isUser ? 'rgba(99,102,241,0.2)' : '#1f2c34',
                      color: '#e6edf3',
                      borderBottomRightRadius: isUser ? 4 : undefined,
                      borderBottomLeftRadius:  isUser ? undefined : 4,
                    }}
                  >
                    {msg.content}
                  </div>
                  <p
                    className="text-xs mt-0.5 px-1"
                    style={{ color: '#6e7681', textAlign: isUser ? 'right' : 'left' }}
                  >
                    {isUser ? 'Customer' : 'Agent'} · {fmtClock(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Monitor page ──────────────────────────────────────────────────────────────

export default function Monitor() {
  const [authed,        setAuthed]        = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1')
  const [conversations, setConversations] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [selectedId,    setSelectedId]    = useState(null)
  const [lastRefresh,   setLastRefresh]   = useState(null)
  const [tick,          setTick]          = useState(0)     // drives the relative time refresh

  const fetchConvs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/monitor/conversations`, {
        params: { password: PASSWORD },
      })
      setConversations(data.conversations || [])
      setLastRefresh(new Date())
      setError(null)
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Failed to load.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchConvs()
    const dataTimer = setInterval(fetchConvs, REFRESH_MS)
    const tickTimer = setInterval(() => setTick(t => t + 1), 15_000) // refresh relative times
    return () => { clearInterval(dataTimer); clearInterval(tickTimer) }
  }, [authed, fetchConvs])

  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />
  }

  const active    = conversations.filter(c => c.status === 'active').length
  const escalated = conversations.filter(c => c.status === 'escalated').length
  const totalCost = conversations.reduce((s, c) => s + (c.cost_zar || 0), 0)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d1117' }}>

      {/* ── Left panel: conversation list ── */}
      <div
        className={`flex flex-col ${selectedId ? 'hidden lg:flex' : 'flex'} w-full lg:w-96 shrink-0`}
        style={{ borderRight: '1px solid #21262d' }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid #21262d', background: '#161b22' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Live Monitor</p>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#3fb950' }}
              />
              <span className="text-xs" style={{ color: '#8b949e' }}>
                {lastRefresh
                  ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '…'}
              </span>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color: '#3fb950' }}>{active}</p>
              <p className="text-xs" style={{ color: '#6e7681' }}>active</p>
            </div>
            <div className="h-6 w-px" style={{ background: '#21262d' }} />
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color: '#e6edf3' }}>{conversations.length}</p>
              <p className="text-xs" style={{ color: '#6e7681' }}>total</p>
            </div>
            <div className="h-6 w-px" style={{ background: '#21262d' }} />
            {escalated > 0 && (
              <>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: '#f85149' }}>{escalated}</p>
                  <p className="text-xs" style={{ color: '#6e7681' }}>escalated</p>
                </div>
                <div className="h-6 w-px" style={{ background: '#21262d' }} />
              </>
            )}
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color: '#f0883e' }}>
                R {totalCost.toFixed(2)}
              </p>
              <p className="text-xs" style={{ color: '#6e7681' }}>total cost</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mx-3 mt-3 rounded-lg px-3 py-2 text-xs"
            style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.2)' }}
          >
            {error}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: '#161b22' }} />
            ))
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p className="text-sm" style={{ color: '#6e7681' }}>No conversations yet.</p>
              <p className="text-xs" style={{ color: '#6e7681' }}>
                Send a test message at <span style={{ color: '#6366f1' }}>/chat/smilecare</span>
              </p>
            </div>
          ) : (
            conversations.map(conv => (
              <ConvCard
                key={conv.id}
                conv={conv}
                isSelected={selectedId === conv.id}
                onClick={() => setSelectedId(conv.id === selectedId ? null : conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: thread view ── */}
      {selectedId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ThreadPanel
            convId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </div>
      ) : (
        <div className="flex-1 hidden lg:flex items-center justify-center flex-col gap-3"
          style={{ background: '#0d1117' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#21262d" strokeWidth={1} className="w-20 h-20">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p style={{ color: '#30363d' }}>Select a conversation to view the thread</p>
        </div>
      )}
    </div>
  )
}
