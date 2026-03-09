/**
 * ToastContext — global toast notification system.
 *
 * Usage:
 *   1. Wrap your app with <ToastProvider>
 *   2. In any component: const toast = useToast()
 *      toast('Saved!', 'success')
 *      toast('Something went wrong', 'error')
 *      toast('New escalation received', 'warning')
 *
 * Types: 'success' | 'error' | 'warning' | 'info'
 * Duration: auto-dismiss after 3.5s (customisable per call)
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

// ── Animation keyframes injected once ────────────────────────────────────────

const KEYFRAMES = `
@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
@keyframes toastOut {
  from { opacity: 1; transform: translateY(0)   scale(1);    }
  to   { opacity: 0; transform: translateY(4px) scale(0.97); }
}
`

let _keyframesInjected = false
function ensureKeyframes() {
  if (_keyframesInjected) return
  const style = document.createElement('style')
  style.textContent = KEYFRAMES
  document.head.appendChild(style)
  _keyframesInjected = true
}

// ── Config per toast type ─────────────────────────────────────────────────────

const TYPE_STYLES = {
  success: { accent: '#3fb950', icon: '✓' },
  error:   { accent: '#f85149', icon: '✕' },
  warning: { accent: '#f0883e', icon: '!' },
  info:    { accent: '#818cf8', icon: 'i' },
}

// ── Single toast bubble ───────────────────────────────────────────────────────

function ToastBubble({ id, message, type, onDismiss }) {
  const t = TYPE_STYLES[type] || TYPE_STYLES.info

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#161b22',
        border: `1px solid rgba(${hexToRgb(t.accent)},0.35)`,
        borderLeft: `3px solid ${t.accent}`,
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        minWidth: 240, maxWidth: 380,
        animation: 'toastIn 0.18s ease-out',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Icon */}
      <span
        style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          background: `rgba(${hexToRgb(t.accent)},0.15)`,
          color: t.accent, fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {t.icon}
      </span>

      {/* Message */}
      <span style={{ flex: 1, fontSize: 13, color: '#e6edf3', lineHeight: 1.4 }}>
        {message}
      </span>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6e7681', padding: 0, flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#e6edf3' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6e7681' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={13} height={13}>
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ── Toast stack (portal at bottom-centre) ────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastBubble {...t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter             = useRef(0)

  ensureKeyframes()

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    }
    return id
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
