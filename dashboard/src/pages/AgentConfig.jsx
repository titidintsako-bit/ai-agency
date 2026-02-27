import { useCallback, useEffect, useState } from 'react'
import { getConfig, listClients, updateConfig } from '../api/config'

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{title}</p>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{subtitle}</p>}
    </div>
  )
}

function SaveButton({ saving, onClick, dirty }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || !dirty}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity duration-150"
      style={{
        background: dirty ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#21262d',
        color: dirty ? '#fff' : '#6e7681',
        opacity: saving ? 0.6 : 1,
        border: '1px solid transparent',
      }}
    >
      {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
    </button>
  )
}

// ── Business hours editor ─────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function HoursEditor({ hours = {}, onChange }) {
  function update(day, val) {
    onChange({ ...hours, [day]: val })
  }

  return (
    <div className="space-y-2">
      {DAYS.map(day => {
        const val    = hours[day] ?? ''
        const closed = val === '' || val?.toLowerCase() === 'closed'
        return (
          <div key={day} className="flex items-center gap-3">
            <span className="w-24 text-sm shrink-0" style={{ color: '#e6edf3' }}>{day}</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!closed}
                onChange={e => update(day, e.target.checked ? '08:00-17:00' : 'Closed')}
                className="accent-indigo-500"
              />
              <span className="text-xs" style={{ color: '#8b949e' }}>Open</span>
            </label>
            {!closed ? (
              <input
                type="text"
                value={val}
                onChange={e => update(day, e.target.value)}
                placeholder="08:00-17:00"
                className="px-2.5 py-1 rounded-lg text-sm outline-none flex-1 max-w-xs"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#30363d' }}
              />
            ) : (
              <span className="text-sm" style={{ color: '#6e7681' }}>Closed</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Services editor ───────────────────────────────────────────────────────────

function ServicesEditor({ services = [], onChange }) {
  function add() {
    onChange([...services, { name: '', description: '', price: '' }])
  }
  function remove(i) {
    onChange(services.filter((_, idx) => idx !== i))
  }
  function update(i, field, val) {
    const next = [...services]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {services.map((s, i) => (
        <div
          key={i}
          className="rounded-lg p-4 space-y-2"
          style={{ background: '#0d1117', border: '1px solid #21262d' }}
        >
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={s.name || ''}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder="Service name"
              className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none font-medium"
              style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#30363d' }}
            />
            <input
              type="text"
              value={s.price || ''}
              onChange={e => update(i, 'price', e.target.value)}
              placeholder="R450"
              className="w-24 px-2.5 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#30363d' }}
            />
            <button
              onClick={() => remove(i)}
              className="p-1.5 rounded-lg transition-colors duration-150"
              style={{ color: '#6e7681' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f85149' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6e7681' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          </div>
          <textarea
            rows={2}
            value={s.description || ''}
            onChange={e => update(i, 'description', e.target.value)}
            placeholder="Short description shown to customers…"
            className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none resize-none"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
            onBlur={e  => { e.currentTarget.style.borderColor = '#30363d' }}
          />
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150"
        style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#e6edf3' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#8b949e' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add service
      </button>
    </div>
  )
}

// ── Triggers editor ───────────────────────────────────────────────────────────

function TriggersEditor({ triggers = [], onChange }) {
  const [draft, setDraft] = useState('')

  function add() {
    const trimmed = draft.trim()
    if (trimmed && !triggers.includes(trimmed)) {
      onChange([...triggers, trimmed])
      setDraft('')
    }
  }
  function remove(t) {
    onChange(triggers.filter(x => x !== t))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {triggers.map(t => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
            style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.2)' }}
          >
            {t}
            <button onClick={() => remove(t)} className="opacity-60 hover:opacity-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add keyword e.g. complaint, refund…"
          className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
          onBlur={e  => { e.currentTarget.style.borderColor = '#30363d' }}
        />
        <button
          onClick={add}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: '#21262d', color: '#e6edf3', border: '1px solid #30363d' }}
        >
          Add
        </button>
      </div>
      <p className="text-xs" style={{ color: '#6e7681' }}>
        When a customer mentions these words the agent will escalate to you.
      </p>
    </div>
  )
}

// ── AgentConfig page ──────────────────────────────────────────────────────────

export default function AgentConfig() {
  const [clients,    setClients]    = useState([])
  const [activeSlug, setActiveSlug] = useState(null)
  const [config,     setConfig]     = useState(null)
  const [dirty,      setDirty]      = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)
  const [success,    setSuccess]    = useState(false)
  const [tab,        setTab]        = useState('hours')

  // Load client list
  useEffect(() => {
    listClients()
      .then(data => {
        const slugs = data.clients || []
        setClients(slugs)
        if (slugs.length > 0) setActiveSlug(slugs[0])
      })
      .catch(err => setError(err.message))
  }, [])

  // Load config when active client changes
  const loadConfig = useCallback(async () => {
    if (!activeSlug) return
    setLoading(true)
    setDirty(false)
    try {
      const data = await getConfig(activeSlug)
      setConfig(data.config)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeSlug])

  useEffect(() => { loadConfig() }, [loadConfig])

  function patch(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateConfig(activeSlug, config)
      setDirty(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid #21262d' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Agent Config</h1>
          {/* Client selector */}
          {clients.length > 1 && (
            <select
              value={activeSlug || ''}
              onChange={e => setActiveSlug(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
            >
              {clients.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {clients.length === 1 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
            >
              {activeSlug}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {success && (
            <span className="text-xs flex items-center gap-1" style={{ color: '#3fb950' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </span>
          )}
          <SaveButton saving={saving} dirty={dirty} onClick={handleSave} />
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

      {/* Tabs */}
      <div
        className="px-6 flex items-center gap-1 shrink-0"
        style={{ borderBottom: '1px solid #21262d', paddingTop: 12, paddingBottom: 0 }}
      >
        {[
          { key: 'hours',    label: 'Business Hours' },
          { key: 'services', label: 'Services'       },
          { key: 'triggers', label: 'Escalation Triggers' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2 text-sm transition-colors duration-150"
            style={{
              color: tab === key ? '#e6edf3' : '#8b949e',
              borderBottom: tab === key ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: '#161b22' }} />
            ))}
          </div>
        ) : !config ? (
          <p style={{ color: '#6e7681' }}>No config loaded.</p>
        ) : (
          <>
            {tab === 'hours' && (
              <div className="max-w-lg">
                <SectionHeader
                  title="Business Hours"
                  subtitle="The agent uses these to tell customers when you're open and to set expectations about reply times."
                />
                <HoursEditor
                  hours={config.hours || {}}
                  onChange={val => patch('hours', val)}
                />
              </div>
            )}

            {tab === 'services' && (
              <div className="max-w-2xl">
                <SectionHeader
                  title="Services"
                  subtitle="What you offer — the agent uses these to answer pricing and availability questions."
                />
                <ServicesEditor
                  services={config.services || []}
                  onChange={val => patch('services', val)}
                />
              </div>
            )}

            {tab === 'triggers' && (
              <div className="max-w-xl">
                <SectionHeader
                  title="Escalation Triggers"
                  subtitle="Keywords that automatically escalate a conversation to you for human review."
                />
                <TriggersEditor
                  triggers={config.escalation_triggers || []}
                  onChange={val => patch('escalation_triggers', val)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
