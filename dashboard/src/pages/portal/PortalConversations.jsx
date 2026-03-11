/**
 * pages/portal/PortalConversations.jsx
 *
 * Client portal conversation list with lead score badges.
 * Clicking a row expands the full chat replay inline.
 * Route: /portal/conversations
 */

import { useCallback, useEffect, useState } from 'react'
import { getPortalConversations, getPortalConversationMessages } from '../../api/portal'

const STATUS_DOT = {
  active:    '#3fb950',
  completed: '#8b949e',
  escalated: '#f85149',
  abandoned: '#6e7681',
}

const LEAD_STYLE = {
  booked:    { bg: 'rgba(63,185,80,0.12)',   text: '#3fb950'  },
  urgent:    { bg: 'rgba(248,81,73,0.12)',   text: '#f85149'  },
  qualified: { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8'  },
  active:    { bg: 'rgba(63,185,80,0.08)',   text: '#3fb950'  },
  cold:      { bg: 'rgba(110,118,129,0.1)',  text: '#6e7681'  },
}

function LeadBadge({ score }) {
  const s = LEAD_STYLE[score] || LEAD_STYLE.cold
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0"
      style={{ background: s.bg, color: s.text }}>
      {score}
    </span>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm"
        style={isUser
          ? { background: 'rgba(99,102,241,0.15)', color: '#e6edf3', borderBottomRightRadius: 4 }
          : { background: '#21262d', color: '#e6edf3', borderBottomLeftRadius: 4 }
        }
      >
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        {msg.created_at && (
          <p className="text-xs mt-1 opacity-50">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}

function ConvRow({ conv }) {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const dot = STATUS_DOT[conv.status] || '#6e7681'

  async function handleExpand() {
    const next = !open
    setOpen(next)
    if (next && messages.length === 0) {
      setLoadingMsgs(true)
      try {
        const data = await getPortalConversationMessages(conv.id)
        setMessages(data.messages || [])
      } catch {
        setMessages([])
      } finally {
        setLoadingMsgs(false)
      }
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#161b22', border: '1px solid #21262d' }}>
      <button className="w-full text-left" onClick={handleExpand}>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot, boxShadow: conv.status === 'active' ? `0 0 6px ${dot}88` : 'none' }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
              {conv.user_identifier || 'Anonymous visitor'}
            </p>
            <p className="text-xs" style={{ color: '#8b949e' }}>
              {conv.agents?.name || '—'} · {conv.channel} · {new Date(conv.started_at).toLocaleDateString()}
            </p>
          </div>
          <LeadBadge score={conv.lead_score} />
          <span className="text-xs capitalize shrink-0" style={{ color: dot }}>{conv.status}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth={2} className="w-4 h-4 shrink-0 transition-transform duration-150"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #21262d', padding: 16, maxHeight: 400, overflowY: 'auto' }}>
          {loadingMsgs ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: '#21262d' }} />)}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#6e7681' }}>No messages in this conversation.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const PAGE_SIZE = 50

export default function PortalConversations() {
  const [rows,          setRows]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [offset,        setOffset]        = useState(0)
  const [hasMore,       setHasMore]       = useState(false)
  const [appliedStatus, setAppliedStatus] = useState('')

  const fetchPage = useCallback(async (off, status) => {
    setLoading(true)
    try {
      const params = { limit: PAGE_SIZE, offset: off }
      if (status) params.status = status
      const data  = await getPortalConversations(params)
      const items = data.conversations || []
      setRows(off === 0 ? items : prev => [...prev, ...items])
      setHasMore(items.length === PAGE_SIZE)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setOffset(0)
    fetchPage(0, appliedStatus)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedStatus])

  const booked = rows.filter(r => r.lead_score === 'booked').length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Conversations</h1>
          {!loading && booked > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950' }}>
              {booked} booked
            </span>
          )}
        </div>
        <div className="flex items-center rounded-lg p-0.5 gap-0.5"
          style={{ background: '#161b22', border: '1px solid #21262d' }}>
          {[
            { val: '',          label: 'All'       },
            { val: 'active',    label: 'Active'    },
            { val: 'completed', label: 'Completed' },
            { val: 'escalated', label: 'Escalated' },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setAppliedStatus(val)}
              className="px-3 py-1 rounded-md text-sm transition-all duration-150"
              style={appliedStatus === val ? { background: '#21262d', color: '#e6edf3' } : { color: '#8b949e' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="px-6 py-2 flex items-center gap-5 shrink-0"
          style={{ borderBottom: '1px solid #21262d', background: 'rgba(99,102,241,0.02)' }}>
          {[
            { label: 'Total',     value: rows.length },
            { label: 'Booked',    value: booked,                                          color: '#3fb950' },
            { label: 'Urgent',    value: rows.filter(r => r.lead_score === 'urgent').length,    color: '#f85149' },
            { label: 'Qualified', value: rows.filter(r => r.lead_score === 'qualified').length, color: '#818cf8' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#6e7681' }}>{label}</span>
              <span className="text-sm font-semibold" style={{ color: color || '#e6edf3' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm shrink-0"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {loading && rows.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#161b22' }} />
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ color: '#6e7681' }}>No conversations yet.</p>
          </div>
        ) : (
          <>
            {rows.map(c => <ConvRow key={c.id} conv={c} />)}
            {hasMore && (
              <div className="py-4 flex justify-center">
                <button onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); fetchPage(next, appliedStatus) }}
                  disabled={loading} className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: '#21262d', color: loading ? '#6e7681' : '#e6edf3', border: '1px solid #30363d' }}>
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
