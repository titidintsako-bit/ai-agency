import { useCallback, useEffect, useState } from 'react'
import { getEscalations, updateEscalation } from '../api/dashboard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLE = {
  pending:  { bg: 'rgba(240,136,62,0.12)',  text: '#f0883e', accent: '#f0883e' },
  reviewed: { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', accent: '#6366f1' },
  resolved: { bg: 'rgba(63,185,80,0.12)',   text: '#3fb950', accent: '#3fb950' },
}

function Badge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}

function fmtDatetime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

// ---------------------------------------------------------------------------
// Escalation card
// ---------------------------------------------------------------------------

function EscalCard({ esc, onUpdate }) {
  const [open, setOpen]     = useState(false)
  const [notes, setNotes]   = useState(esc.notes || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  const s = STATUS_STYLE[esc.status] || STATUS_STYLE.pending

  async function submit(status) {
    setSaving(true)
    setErr(null)
    try {
      await updateEscalation(esc.id, { status, notes })
      onUpdate()
    } catch (e) {
      setErr('Failed to update escalation.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#161b22', border: '1px solid #21262d', borderLeft: `3px solid ${s.accent}` }}
    >
      {/* Card header */}
      <button
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(248,81,73,0.12)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth={2} className="w-3 h-3">
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
              {esc.clients?.name || 'Unknown client'}
            </p>
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#8b949e' }}>
              {esc.reason || esc.summary || 'No reason provided.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge status={esc.status} />
          <svg
            viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth={2}
            className="w-4 h-4 transition-transform duration-150"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: '1px solid #21262d' }}>
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>
                Flagged at
              </p>
              <p style={{ color: '#e6edf3' }}>{fmtDatetime(esc.flagged_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>
                Reviewed at
              </p>
              <p style={{ color: '#e6edf3' }}>{fmtDatetime(esc.reviewed_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>
                Channel
              </p>
              <p className="capitalize" style={{ color: '#e6edf3' }}>
                {esc.conversations?.channel || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>
                User
              </p>
              <p style={{ color: '#e6edf3' }}>
                {esc.conversations?.user_identifier || '—'}
              </p>
            </div>
            {esc.summary && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>
                  Summary
                </p>
                <p style={{ color: '#e6edf3' }}>{esc.summary}</p>
              </div>
            )}
          </div>

          {/* Notes + actions — only show if still pending or reviewed */}
          {esc.status !== 'resolved' && (
            <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid #21262d', paddingTop: 16 }}>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6e7681' }}>
                  Internal notes
                </span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes for your records…"
                  className="mt-1.5 w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#e6edf3',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#30363d' }}
                />
              </label>

              {err && (
                <p className="text-xs" style={{ color: '#f85149' }}>{err}</p>
              )}

              <div className="flex items-center gap-2">
                {esc.status === 'pending' && (
                  <button
                    onClick={() => submit('reviewed')}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-sm transition-colors duration-150"
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      color: saving ? '#6e7681' : '#818cf8',
                      border: '1px solid rgba(99,102,241,0.25)',
                    }}
                  >
                    Mark reviewed
                  </button>
                )}
                <button
                  onClick={() => submit('resolved')}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-sm transition-colors duration-150"
                  style={{
                    background: 'rgba(63,185,80,0.12)',
                    color: saving ? '#6e7681' : '#3fb950',
                    border: '1px solid rgba(63,185,80,0.25)',
                  }}
                >
                  {saving ? 'Saving…' : 'Resolve'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Escalations page
// ---------------------------------------------------------------------------

export default function Escalations() {
  const [escalations, setEscalations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')

  const fetchEscalations = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEscalations(statusFilter ? { status: statusFilter } : {})
      setEscalations(data.escalations || [])
      setError(null)
    } catch (e) {
      setError('Failed to load escalations.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchEscalations() }, [fetchEscalations])

  const counts = {
    pending:  escalations.filter(e => e.status === 'pending').length,
    reviewed: escalations.filter(e => e.status === 'reviewed').length,
    resolved: escalations.filter(e => e.status === 'resolved').length,
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-4 shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Escalations</h1>
          {!loading && escalations.length > 0 && statusFilter === 'pending' && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(248,81,73,0.12)', color: '#f85149' }}
            >
              {counts.pending} pending
            </span>
          )}
        </div>

        {/* Status filter tabs */}
        <div
          className="flex items-center rounded-lg p-0.5 gap-0.5"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          {[
            { val: 'pending',  label: 'Pending' },
            { val: 'reviewed', label: 'Reviewed' },
            { val: 'resolved', label: 'Resolved' },
            { val: '',         label: 'All' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className="px-3 py-1 rounded-md text-sm transition-all duration-150"
              style={
                statusFilter === val
                  ? { background: '#21262d', color: '#e6edf3' }
                  : { color: '#8b949e' }
              }
            >
              {label}
            </button>
          ))}
        </div>
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

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#161b22' }} />
          ))
        ) : escalations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p style={{ color: '#6e7681' }}>
              {statusFilter === 'pending' ? 'No pending escalations. All clear.' : 'No escalations found.'}
            </p>
          </div>
        ) : (
          escalations.map(e => (
            <EscalCard key={e.id} esc={e} onUpdate={fetchEscalations} />
          ))
        )}
      </div>
    </div>
  )
}
