/**
 * SmilecareWidget — Floating production chat widget for SmileCare Dental.
 *
 * Renders as a fixed bottom-right launcher. Click to open a 380×520 chat panel.
 * Agent: Lerato, SmileCare's virtual receptionist.
 * API:   POST /api/chat/smilecare  (same pattern as ChatWidget.jsx)
 *
 * Responds to window event 'smilecare:open' to allow external triggers.
 */

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const TEAL     = '#0B8FAC'
const TEAL_D   = '#097a93'
const API_BASE = '/api'
const SLUG     = 'smilecare'
const MIN_MS   = 800

const WELCOME = "Hi there! 👋 I'm Lerato, SmileCare's virtual receptionist. I'm here 24/7 to help you with appointments, pricing, and any questions about our services. How can I help you today?"

function uid() { return Math.random().toString(36).slice(2, 10) }
function fmt(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

// ── Icons ────────────────────────────────────────────────────────────────────

function ToothIcon({ size = 22, color = 'white' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ display: 'block' }}>
      <path d="M12 2C9.24 2 7 4.24 7 7c0 1.74.89 3.28 2.25 4.2L8.25 19c-.11.82.49 1.56 1.31 1.63.82.07 1.54-.49 1.66-1.31L12 15.5l.78 3.82c.12.82.84 1.38 1.66 1.31.82-.07 1.42-.81 1.31-1.63l-1-7.8C16.11 10.28 17 8.74 17 7c0-2.76-2.24-5-5-5z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} style={{ display: 'block' }}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2} style={{ display: 'block', transform: 'rotate(45deg)' }}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <ToothIcon size={15} />
      </div>
      <div style={{ background: '#F0F2F5', borderRadius: '16px 16px 16px 4px', padding: '9px 13px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', display: 'block', animation: `wcTyping 1.2s infinite ${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '3px 16px' }}>
        <div style={{ background: TEAL, color: 'white', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', maxWidth: '78%', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
          {msg.content}
        </div>
        <span style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>{fmt(msg.ts)}</span>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '3px 16px' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <ToothIcon size={15} />
      </div>
      <div style={{ maxWidth: '78%' }}>
        <div style={{ background: '#F0F2F5', color: '#1F2937', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
          {msg.content.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, display: 'block' }}>{fmt(msg.ts)}</span>
      </div>
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

export default function SmilecareWidget() {
  const [isOpen,    setIsOpen]    = useState(false)
  const [initiated, setInitiated] = useState(false)
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [typing,    setTyping]    = useState(false)
  const [convId,    setConvId]    = useState(null)
  const [escalated, setEscalated] = useState(false)
  const [sessionId]               = useState(() => 'web-' + uid())

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Allow external open trigger (e.g. from hero button)
  useEffect(() => {
    const handler = () => openWidget()
    window.addEventListener('smilecare:open', handler)
    return () => window.removeEventListener('smilecare:open', handler)
  }, [initiated]) // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function openWidget() {
    setIsOpen(true)
    if (!initiated) {
      setInitiated(true)
      setTimeout(() => {
        setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME, ts: new Date() }])
      }, 350)
    }
    setTimeout(() => inputRef.current?.focus(), 480)
  }

  async function send() {
    const text = input.trim()
    if (!text || typing || escalated) return
    setInput('')
    setMessages(prev => [...prev, { id: uid(), role: 'user', content: text, ts: new Date() }])
    const t0 = Date.now()
    setTyping(true)
    try {
      const { data } = await axios.post(`${API_BASE}/chat/${SLUG}`, {
        message: text, conversation_id: convId,
        channel: 'web', user_identifier: sessionId,
      })
      const wait = MIN_MS - (Date.now() - t0)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      setTyping(false)
      if (!convId) setConvId(data.conversation_id)
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: data.message, ts: new Date() }])
      if (data.was_escalated) setEscalated(true)
    } catch {
      setTyping(false)
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', ts: new Date(),
        content: "Sorry, I'm having connection issues. Please call us on 011 234 5678.",
      }])
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes wcPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(11,143,172,0.55); }
          60%      { box-shadow: 0 0 0 14px rgba(11,143,172,0); }
        }
        @keyframes wcSlide {
          from { opacity:0; transform:translateY(18px) scale(0.96); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes wcTyping {
          0%,60%,100% { transform:translateY(0); }
          30%          { transform:translateY(-5px); }
        }
        .wc-input::placeholder { color:#9CA3AF; }
        .wc-input:focus { outline:none; border-color:${TEAL} !important; }
      `}</style>

      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>

        {/* ── Chat panel ── */}
        {isOpen && (
          <div style={{
            width: 380, height: 520, borderRadius: 20, background: 'white',
            boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'wcSlide 0.22s ease-out',
          }}>

            {/* Header */}
            <div style={{ background: TEAL, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ToothIcon size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 15, margin: 0 }}>SmileCare Dental</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
                  <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: 12 }}>Lerato · Virtual Receptionist · Online now</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2, background: '#FAFAFA' }}>
              {messages.length === 0 && !typing && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF', fontSize: 13 }}>
                  Connecting…
                </div>
              )}
              {messages.map(m => <Bubble key={m.id} msg={m} />)}
              {typing && <TypingDots />}
              {escalated && !typing && (
                <div style={{ margin: '8px 16px', padding: '12px 16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, fontSize: 13, color: '#92400E', textAlign: 'center' }}>
                  A team member will follow up shortly. You can also call <strong>011 234 5678</strong>.
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', background: 'white', flexShrink: 0 }}>
              <input
                ref={inputRef}
                className="wc-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={escalated}
                placeholder={escalated ? 'Team will follow up…' : 'Type a message...'}
                style={{ flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 24, padding: '9px 16px', fontSize: 14, fontFamily: 'inherit', background: 'white', color: '#1F2937', transition: 'border-color 0.15s' }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || typing || escalated}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: input.trim() && !typing && !escalated ? TEAL : '#E5E7EB',
                  color: input.trim() && !typing && !escalated ? 'white' : '#9CA3AF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() && !typing && !escalated ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        )}

        {/* ── Launcher button ── */}
        <button
          onClick={isOpen ? () => setIsOpen(false) : openWidget}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: TEAL, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 18px rgba(11,143,172,0.45)`,
            animation: isOpen ? 'none' : 'wcPulse 2.5s infinite',
            transition: `background 0.2s, transform 0.15s`,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = TEAL_D; e.currentTarget.style.transform = 'scale(1.07)' }}
          onMouseLeave={e => { e.currentTarget.style.background = TEAL;   e.currentTarget.style.transform = 'scale(1)' }}
          aria-label={isOpen ? 'Close chat' : 'Chat with Lerato'}
        >
          {isOpen ? <CloseIcon /> : <ToothIcon size={26} />}
        </button>
      </div>
    </>
  )
}
