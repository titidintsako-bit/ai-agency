import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getConversations } from '../api/dashboard'

const STATUS_STYLE = {
  active:    { bg: 'rgba(63,185,80,0.12)',  text: '#3fb950' },
  completed: { bg: 'rgba(139,148,158,0.1)', text: '#8b949e' },
  escalated: { bg: 'rgba(248,81,73,0.12)',  text: '#f85149' },
  abandoned: { bg: 'rgba(110,118,129,0.1)', text: '#6e7681' },
}

function Badge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.completed
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.text }}>{status}</span>
  )
}

const PAGE_SIZE = 50

export default function Conversations() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [offset,  setOffset]  = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [pendingStatus,     setPendingStatus]     = useState('')
  const [pendingClientSlug, setPendingClientSlug] = useState('')
  const [appliedStatus,     setAppliedStatus]     = useState('')
  const [appliedClientSlug, setAppliedClientSlug] = useState('')

  const fetchPage = useCallback(async (off, status, slug) => {
    setLoading(true)
    try {
      const params = { limit: PAGE_SIZE, offset: off }
      if (status) params.status      = status
      if (slug)   params.client_slug = slug
      const data  = await getConversations(params)
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
    fetchPage(0, appliedStatus, appliedClientSlug)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedStatus, appliedClientSlug])

  function applyFilters() {
    setAppliedStatus(pendingStatus)
    setAppliedClientSlug(pendingClientSlug)
  }

  function loadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchPage(next, appliedStatus, appliedClientSlug)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}>
        <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Conversations</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={pendingStatus} onChange={e => setPendingStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="escalated">Escalated</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <input type="text" placeholder="Client slug…" value={pendingClientSlug}
            onChange={e => setPendingClientSlug(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            className="px-3 py-1.5 rounded-lg text-sm outline-none w-36"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }} />
          <button onClick={applyFilters} className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: '#21262d', color: '#e6edf3', border: '1px solid #30363d' }}>
            Filter
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm shrink-0"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {/* Column headers */}
        <div className="grid text-xs font-medium uppercase tracking-wider sticky top-0"
          style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr auto', padding: '10px 16px',
            background: '#0d1117', borderBottom: '1px solid #21262d', color: '#6e7681' }}>
          <span>User</span>
          <span>Client</span>
          <span>Agent</span>
          <span>Channel</span>
          <span>Status</span>
          <span className="text-right">Started</span>
        </div>

        {loading && rows.length === 0 ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{ height: 48, borderBottom: '1px solid #21262d' }} />
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ color: '#6e7681' }}>No conversations found.</p>
          </div>
        ) : (
          <>
            {rows.map(c => {
              const start = new Date(c.started_at)
              return (
                <Link key={c.id} to={`/conversations/${c.id}`}
                  className="grid items-center text-sm transition-colors duration-150"
                  style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr auto',
                    padding: '12px 16px', borderBottom: '1px solid #21262d',
                    color: '#e6edf3', textDecoration: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <span className="truncate">{c.user_identifier || 'Anonymous'}</span>
                  <span className="truncate" style={{ color: '#8b949e' }}>{c.clients?.name || '—'}</span>
                  <span style={{ color: '#8b949e' }}>{c.agents?.name || '—'}</span>
                  <span className="capitalize" style={{ color: '#8b949e' }}>{c.channel}</span>
                  <Badge status={c.status} />
                  <span className="tabular-nums text-xs text-right" style={{ color: '#6e7681' }}>
                    {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              )
            })}
            {hasMore && (
              <div className="py-4 flex justify-center">
                <button onClick={loadMore} disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm"
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
