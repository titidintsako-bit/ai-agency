/**
 * SmilecareWidget — Production chat widget for SmileCare Dental.
 *
 * Route: embedded in /smilecare (and any other page that imports it)
 * API:   POST /api/chat/smilecare
 */

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

// ── Constants ─────────────────────────────────────────────────────────────────

const INDIGO   = '#6366f1'
const INDIGO_D = '#4f46e5'
const API_BASE = '/api'
const SLUG     = 'smilecare'
const MIN_MS   = 800

const WELCOME = "Hi, I'm Lerato, SmileCare's virtual receptionist. I'm here to help with appointments, pricing, and any questions about our services. How can I help you today?"

function uid() { return Math.random().toString(36).slice(2, 10) }
function fmt(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

// ── Message formatter ─────────────────────────────────────────────────────────

function formatAgentMessage(text) {
  text = text.replace(/\*+/g, '')
  text = text.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, '')
  text = text.replace(/  +/g, ' ').trim()
  return text
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white" stroke="none" />
    </svg>
  )
}

function SendArrow() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" stroke="none" />
    </svg>
  )
}

function CloseX() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" style={{ display: 'block' }}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ padding: '0 0 4px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#6e7681', display: 'block',
            animation: `wcDot 1.3s ease-in-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  const text = msg.role === 'assistant' ? formatAgentMessage(msg.content) : msg.content

  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 12, animation: 'wcFade 0.18s ease-out' }}>
        <div style={{
          background: INDIGO, color: 'white',
          borderRadius: '16px 4px 16px 16px',
          padding: '10px 14px', maxWidth: '80%',
          fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {text}
        </div>
        <span style={{ fontSize: 11, color: '#6e7681', marginTop: 4 }}>{fmt(msg.ts)}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12, animation: 'wcFade 0.18s ease-out' }}>
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: '4px 16px 16px 16px',
        padding: '10px 14px', maxWidth: '80%',
        fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
        color: '#e6edf3',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {text.split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#6e7681', marginTop: 4 }}>{fmt(msg.ts)}</span>
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
  const [launchHov, setLaunchHov] = useState(false)
  const [sessionId]               = useState(() => 'web-' + uid())

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // External open trigger (hero button, contact section, etc.)
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
    setTimeout(() => inputRef.current?.focus(), 400)
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
        content: "I'm having connection issues right now. Please call us directly on 011 234 5678.",
      }])
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const canSend = input.trim() && !typing && !escalated

  return (
    <>
      <style>{`
        @keyframes wcSlide {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes wcDot {
          0%, 60%, 100% { transform: scale(1);   opacity: 0.4; }
          30%            { transform: scale(1.5); opacity: 1;   }
        }
        @keyframes wcFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .sc-messages::-webkit-scrollbar { display: none; }
        .sc-messages { scrollbar-width: none; }
        .sc-input { caret-color: ${INDIGO}; }
        .sc-input::placeholder { color: #6e7681; }
        .sc-input:focus { outline: none; }
      `}</style>

      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>

        {/* ── Chat window ── */}
        {isOpen && (
          <div style={{
            width: 360, height: 520,
            borderRadius: 16, background: '#161b22',
            border: '1px solid #30363d',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'wcSlide 0.22s ease-out',
          }}>

            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              height: 64,
              padding: '0 16px', flexShrink: 0,
              borderRadius: '16px 16px 0 0',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'system-ui, sans-serif' }}>S</span>
              </div>

              {/* Name stack */}
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
                  SmileCare Dental
                </p>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: '2px 0 0', fontFamily: 'system-ui, sans-serif' }}>
                  Lerato · Receptionist
                </p>
              </div>

              {/* Online status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', display: 'block', flexShrink: 0, boxShadow: '0 0 6px #4ADE8088' }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>Online</span>
              </div>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}
              >
                <CloseX />
              </button>
            </div>

            {/* Messages */}
            <div
              className="sc-messages"
              style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#0d1117', display: 'flex', flexDirection: 'column' }}
            >
              {messages.length === 0 && !typing && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e7681', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
                  Connecting…
                </div>
              )}
              {messages.map(m => <Bubble key={m.id} msg={m} />)}
              {typing && <TypingDots />}
              {escalated && !typing && (
                <div style={{
                  margin: '4px 0 8px', padding: '12px 14px',
                  background: 'rgba(240,136,62,0.08)', border: '1px solid rgba(240,136,62,0.2)',
                  borderRadius: 10, fontSize: 13, color: '#8b949e',
                  lineHeight: 1.5, fontFamily: 'system-ui, sans-serif',
                }}>
                  A team member will be in touch shortly. For urgent matters, call <strong style={{ color: '#e6edf3' }}>011 234 5678</strong>.
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{
              borderTop: '1px solid #21262d', height: 60,
              padding: '0 16px', background: '#161b22', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <input
                ref={inputRef}
                className="sc-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={escalated}
                placeholder={escalated ? 'Team will follow up…' : 'Message SmileCare...'}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: 14, fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#e6edf3',
                }}
              />
              <button
                onClick={send}
                disabled={!canSend}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: canSend ? INDIGO : '#21262d',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canSend ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                <SendArrow />
              </button>
            </div>
          </div>
        )}

        {/* ── Launcher ── */}
        <button
          onClick={isOpen ? () => setIsOpen(false) : openWidget}
          onMouseEnter={() => setLaunchHov(true)}
          onMouseLeave={() => setLaunchHov(false)}
          aria-label={isOpen ? 'Close chat' : 'Chat with SmileCare'}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: launchHov ? INDIGO_D : INDIGO,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            transform: launchHov ? 'scale(1.06)' : 'scale(1)',
            transition: 'background 0.18s, transform 0.18s',
          }}
        >
          {isOpen ? <CloseX /> : <ChatIcon />}
        </button>
      </div>
    </>
  )
}
