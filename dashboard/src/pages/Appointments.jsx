/**
 * Appointments — view all appointment / consultation requests across all clients.
 *
 * Route: /appointments (protected)
 * API:   GET /api/dashboard/appointments
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAppointments } from '../api/dashboard'
import { useToast } from '../context/ToastContext'

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  pending:   { bg: 'rgba(240,136,62,0.12)', text: '#f0883e', dot: '#f0883e' },
  confirmed: { bg: 'rgba(63,185,80,0.12)',  text: '#3fb950', dot: '#3fb950' },
  completed: { bg: 'rgba(139,148,158,0.1)', text: '#8b949e', dot: '#8b949e' },
  cancelled: { bg: 'rgba(248,81,73,0.12)',  text: '#f85149', dot: '#f85149' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const PAGE_SIZE = 50

// ── Appointment row ───────────────────────────────────────────────────────────

function ApptRow({ appt }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-150"
      style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderLeft: `3px solid ${(STATUS_STYLE[appt.status] || STATUS_STYLE.pending).dot}`,
      }}
    >
      {/* Summary row */}
      <button
        className="w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="grid items-center text-sm gap-3"
          style={{
            gridTemplateColumns: '1.6fr 1.2fr 1fr 1fr 1fr auto',
            padding: '12px 16px',
          }}
        >
          <div className="min-w-0">
            <p className="font-medium truncate" style={{ color: '#e6edf3' }}>
              {appt.patient_name || '—'}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: '#8b949e' }}>
              {appt.contact_number || '—'}
            </p>
          </div>
          <span className="truncate text-sm" style={{ color: '#8b949e' }}>
            {appt.service_type || '—'}
          </span>
          <span className="text-sm" style={{ color: '#8b949e' }}>
            {appt.preferred_date || '—'}
          </span>
          <span className="text-sm" style={{ color: '#8b949e' }}>
            {appt.preferred_time || '—'}
          </span>
          <StatusBadge status={appt.status} />
          <svg
            viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth={2}
            className="w-4 h-4 shrink-0 transition-transform duration-150"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div style={{ borderTop: '1px solid #21262d', padding: '16px' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Detail label="Client" value={appt.clients?.name} />
            <Detail label="Requested" value={`${fmtDate(appt.created_at)} ${fmtTime(appt.created_at)}`} />
            <Detail
              label="Existing patient"
              value={appt.is_existing_patient == null ? '—' : appt.is_existing_patient ? 'Yes' : 'No'}
            />
            {appt.notes && (
              <div className="col-span-full">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>
                  Notes
                </p>
                <p style={{ color: '#e6edf3' }}>{appt.notes}</p>
              </div>
            )}
            {appt.conversation_id && (
              <div className="col-span-full">
                <Link
                  to={`/conversations/${appt.conversation_id}`}
                  className="text-xs transition-colors duration-150"
                  style={{ color: '#6366f1' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#818cf8' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#6366f1' }}
                >
                  View conversation →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#6e7681' }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: '#e6edf3' }}>{value}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Appointments() {
  const toast = useToast()

  const [rows,     setRows]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [offset,   setOffset]   = useState(0)
  const [hasMore,  setHasMore]  = useState(false)

  const [pendingStatus, setPendingStatus] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('pending')

  const fetchPage = useCallback(async (off, status) => {
    setLoading(true)
    try {
      const params = { limit: PAGE_SIZE, offset: off }
      if (status) params.status = status
      const data  = await getAppointments(params)
      const items = data.appointments || []
      setRows(off === 0 ? items : prev => [...prev, ...items])
      setHasMore(items.length === PAGE_SIZE)
      setError(null)
    } catch (e) {
      setError(e.message)
      toast('Failed to load appointments', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    setPendingStatus(appliedStatus)
    setOffset(0)
    fetchPage(0, appliedStatus)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedStatus])

  function applyFilters() {
    setAppliedStatus(pendingStatus)
  }

  function loadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchPage(next, appliedStatus)
  }

  const pending   = rows.filter(r => r.status === 'pending').length
  const confirmed = rows.filter(r => r.status === 'confirmed').length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Appointments</h1>
          {!loading && rows.length > 0 && appliedStatus === 'pending' && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(240,136,62,0.12)', color: '#f0883e' }}
            >
              {pending} pending
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div
          className="flex items-center rounded-lg p-0.5 gap-0.5"
          style={{ background: '#161b22', border: '1px solid #21262d' }}
        >
          {[
            { val: 'pending',   label: 'Pending'   },
            { val: 'confirmed', label: 'Confirmed' },
            { val: 'completed', label: 'Completed' },
            { val: '',          label: 'All'        },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => { setPendingStatus(val); setAppliedStatus(val) }}
              className="px-3 py-1 rounded-md text-sm transition-all duration-150"
              style={
                appliedStatus === val
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

      {/* Stats strip */}
      {!loading && rows.length > 0 && (
        <div
          className="px-6 py-3 flex items-center gap-6 shrink-0"
          style={{ borderBottom: '1px solid #21262d', background: 'rgba(99,102,241,0.03)' }}
        >
          {[
            { label: 'Showing', value: rows.length },
            { label: 'Pending',   value: rows.filter(r => r.status === 'pending').length,   color: '#f0883e' },
            { label: 'Confirmed', value: rows.filter(r => r.status === 'confirmed').length, color: '#3fb950' },
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

      {/* Column headers */}
      <div
        className="grid text-xs font-semibold uppercase tracking-widest shrink-0"
        style={{
          gridTemplateColumns: '1.6fr 1.2fr 1fr 1fr 1fr auto',
          padding: '10px 18px',
          background: '#0d1117',
          borderBottom: '1px solid #21262d',
          color: '#6e7681',
          letterSpacing: '0.07em',
        }}
      >
        <span>Patient / Client</span>
        <span>Service</span>
        <span>Date</span>
        <span>Time</span>
        <span>Status</span>
        <span />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {loading && rows.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#161b22' }} />
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <p style={{ color: '#6e7681' }}>
              {appliedStatus === 'pending' ? 'No pending appointments.' : 'No appointments found.'}
            </p>
          </div>
        ) : (
          <>
            {rows.map(a => <ApptRow key={a.id} appt={a} />)}
            {hasMore && (
              <div className="py-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: '#21262d', color: loading ? '#6e7681' : '#e6edf3', border: '1px solid #30363d' }}
                >
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
