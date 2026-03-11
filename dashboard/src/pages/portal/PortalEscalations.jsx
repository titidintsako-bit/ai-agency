/**
 * pages/portal/PortalEscalations.jsx
 *
 * Client portal escalation queue — conversations flagged for human follow-up.
 * Route: /portal/escalations
 */

import { useCallback, useEffect, useState } from 'react'
import { getPortalEscalations } from '../../api/portal'

const STATUS_STYLE = {
  pending:  { bg: 'rgba(248,81,73,0.12)',   text: '#f85149' },
  reviewed: { bg: 'rgba(240,136,62,0.12)',  text: '#f0883e' },
  resolved: { bg: 'rgba(63,185,80,0.12)',   text: '#3fb950' },
}

const REASON_LABEL = {
  complaint:           'Complaint',
  appointment_failed:  'Booking issue',
  out_of_scope:        'Out of scope',
  explicit_request:    'Requested human',
  other:               'Other',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function EscalRow({ esc }) {
  const [open, setOpen] = useState(false)
  const s = STATUS_STYLE[esc.status] || STATUS_STYLE.pending

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#161b22', border: '1px solid #21262d', borderLeft: '3px solid #f85149' }}>
      <button className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth={1.8} className="w-4 h-4 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
              {REASON_LABEL[esc.reason] || esc.reason}
            </p>
            <p className="text-xs truncate" style={{ color: '#8b949e' }}>
              {fmtDate(esc.flagged_at)} · {esc.conversations?.channel || '—'}
            </p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0"
            style={{ background: s.bg, color: s.text }}>
            {esc.status}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth={2} className="w-4 h-4 shrink-0 transition-transform duration-150"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #21262d', padding: 16 }} className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>Summary</p>
            <p className="text-sm" style={{ color: '#e6edf3' }}>{esc.summary || 'No summary provided.'}</p>
          </div>
          {esc.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>Agency notes</p>
              <p className="text-sm" style={{ color: '#e6edf3' }}>{esc.notes}</p>
            </div>
          )}
          {esc.reviewed_at && (
            <p className="text-xs" style={{ color: '#6e7681' }}>
              Reviewed on {fmtDate(esc.reviewed_at)}
            </p>
          )}
          <div
            className="rounded-lg p-3 text-sm"
            style={{ background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.15)', color: '#8b949e' }}
          >
            Our team handles all escalations. If urgent, call your dedicated agency contact directly.
          </div>
        </div>
      )}
    </div>
  )
}

export default function PortalEscalations() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('pending')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter) params.status = filter
      const data = await getPortalEscalations(params)
      setRows(data.escalations || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const pending = rows.filter(r => r.status === 'pending').length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Escalations</h1>
          {!loading && pending > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(248,81,73,0.12)', color: '#f85149' }}>
              {pending} pending
            </span>
          )}
        </div>
        <div className="flex items-center rounded-lg p-0.5 gap-0.5"
          style={{ background: '#161b22', border: '1px solid #21262d' }}>
          {[
            { val: 'pending',  label: 'Pending'  },
            { val: 'reviewed', label: 'Reviewed' },
            { val: 'resolved', label: 'Resolved' },
            { val: '',         label: 'All'      },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setFilter(val)}
              className="px-3 py-1 rounded-md text-sm transition-all duration-150"
              style={filter === val ? { background: '#21262d', color: '#e6edf3' } : { color: '#8b949e' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm shrink-0"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}>
          {error}
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="px-6 mt-4 rounded-lg py-3 text-sm shrink-0 mx-6"
          style={{ background: 'rgba(63,185,80,0.06)', border: '1px solid rgba(63,185,80,0.2)', color: '#3fb950' }}>
          No {filter || ''} escalations. Your agent is handling everything well.
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#161b22' }} />
          ))
        ) : (
          rows.map(e => <EscalRow key={e.id} esc={e} />)
        )}
      </div>
    </div>
  )
}
