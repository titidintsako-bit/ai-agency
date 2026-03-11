/**
 * pages/portal/PortalAppointments.jsx
 *
 * Client portal appointments — confirm, cancel, and view all bookings.
 * Route: /portal/appointments
 */

import { useCallback, useEffect, useState } from 'react'
import { getPortalAppointments, updatePortalAppointment } from '../../api/portal'

const STATUS_STYLE = {
  pending:   { bg: 'rgba(240,136,62,0.12)', text: '#f0883e', dot: '#f0883e' },
  confirmed: { bg: 'rgba(63,185,80,0.12)',  text: '#3fb950', dot: '#3fb950' },
  completed: { bg: 'rgba(139,148,158,0.1)', text: '#8b949e', dot: '#8b949e' },
  cancelled: { bg: 'rgba(248,81,73,0.12)',  text: '#f85149', dot: '#f85149' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  )
}

function ApptRow({ appt, onStatusChange }) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  async function changeStatus(newStatus) {
    setSaving(true)
    setErr(null)
    try {
      await updatePortalAppointment(appt.id, { status: newStatus })
      onStatusChange(appt.id, newStatus)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#161b22', border: '1px solid #21262d', borderLeft: `3px solid ${(STATUS_STYLE[appt.status] || STATUS_STYLE.pending).dot}` }}>
      <button className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <div className="grid items-center text-sm gap-3 px-4 py-3"
          style={{ gridTemplateColumns: '1.6fr 1.2fr 1fr 1fr 1fr auto' }}>
          <div className="min-w-0">
            <p className="font-medium truncate" style={{ color: '#e6edf3' }}>{appt.patient_name || '—'}</p>
            <p className="text-xs truncate" style={{ color: '#8b949e' }}>{appt.contact_number || '—'}</p>
          </div>
          <span className="truncate text-sm" style={{ color: '#8b949e' }}>{appt.service_type || '—'}</span>
          <span className="text-sm" style={{ color: '#8b949e' }}>{appt.preferred_date || '—'}</span>
          <span className="text-sm" style={{ color: '#8b949e' }}>{appt.preferred_time || '—'}</span>
          <StatusBadge status={appt.status} />
          <svg viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth={2} className="w-4 h-4 shrink-0 transition-transform duration-150"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #21262d', padding: 16 }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#6e7681' }}>Requested on</p>
              <p style={{ color: '#e6edf3' }}>{new Date(appt.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#6e7681' }}>Existing patient</p>
              <p style={{ color: '#e6edf3' }}>{appt.is_existing_patient == null ? '—' : appt.is_existing_patient ? 'Yes' : 'No'}</p>
            </div>
            {appt.notes && (
              <div className="col-span-full">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>Notes</p>
                <p style={{ color: '#e6edf3' }}>{appt.notes}</p>
              </div>
            )}
            {err && (
              <div className="col-span-full text-xs" style={{ color: '#f85149' }}>{err}</div>
            )}
            {appt.status === 'pending' && (
              <div className="col-span-full flex items-center gap-2 pt-1">
                <button onClick={() => changeStatus('confirmed')} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.25)' }}>
                  {saving ? 'Saving…' : '✓ Confirm'}
                </button>
                <button onClick={() => changeStatus('cancelled')} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.2)' }}>
                  ✕ Cancel
                </button>
              </div>
            )}
            {appt.status === 'confirmed' && (
              <div className="col-span-full pt-1">
                <button onClick={() => changeStatus('completed')} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>
                  {saving ? 'Saving…' : '✓ Mark Completed'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const PAGE_SIZE = 50

export default function PortalAppointments() {
  const [rows,          setRows]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [offset,        setOffset]        = useState(0)
  const [hasMore,       setHasMore]       = useState(false)
  const [appliedStatus, setAppliedStatus] = useState('pending')

  const fetchPage = useCallback(async (off, status) => {
    setLoading(true)
    try {
      const params = { limit: PAGE_SIZE, offset: off }
      if (status) params.status = status
      const data  = await getPortalAppointments(params)
      const items = data.appointments || []
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

  function handleStatusChange(id, newStatus) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
  }

  const pending = rows.filter(r => r.status === 'pending').length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Appointments</h1>
          {!loading && appliedStatus === 'pending' && pending > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(240,136,62,0.12)', color: '#f0883e' }}>
              {pending} pending
            </span>
          )}
        </div>
        <div className="flex items-center rounded-lg p-0.5 gap-0.5"
          style={{ background: '#161b22', border: '1px solid #21262d' }}>
          {[
            { val: 'pending',   label: 'Pending'   },
            { val: 'confirmed', label: 'Confirmed' },
            { val: 'completed', label: 'Completed' },
            { val: '',          label: 'All'        },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setAppliedStatus(val)}
              className="px-3 py-1 rounded-md text-sm transition-all duration-150"
              style={appliedStatus === val ? { background: '#21262d', color: '#e6edf3' } : { color: '#8b949e' }}>
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

      {/* Column headers */}
      <div className="grid text-xs font-semibold uppercase tracking-widest shrink-0"
        style={{ gridTemplateColumns: '1.6fr 1.2fr 1fr 1fr 1fr auto', padding: '10px 18px', background: '#0d1117', borderBottom: '1px solid #21262d', color: '#6e7681' }}>
        <span>Patient</span><span>Service</span><span>Date</span><span>Time</span><span>Status</span><span />
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {loading && rows.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#161b22' }} />
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <p style={{ color: '#6e7681' }}>
              {appliedStatus === 'pending' ? 'No pending appointments.' : 'No appointments found.'}
            </p>
          </div>
        ) : (
          <>
            {rows.map(a => <ApptRow key={a.id} appt={a} onStatusChange={handleStatusChange} />)}
            {hasMore && (
              <div className="py-4 flex justify-center">
                <button onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); fetchPage(next, appliedStatus) }}
                  disabled={loading}
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
