/**
 * ChatWidget — Standalone public chat interface for SmileCare Dental.
 *
 * Route:  /chat/smilecare  (no auth required)
 * API:    POST /api/chat/smilecare
 */

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE    = '/api'
const CLIENT_SLUG = 'smilecare'
const AGENT_NAME  = 'Lerato'
const TEAL        = '#0B8FAC'
const TEAL_D      = '#097a93'
const MIN_MS      = 900

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return 'w-' + Math.random().toString(36).slice(2, 10) }
function fmtTime(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

function formatAgentMessage(text) {
  text = text.replace(/\*+/g, '')
  text = text.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, '')
  text = text.replace(/  +/g, ' ').trim()
  return text
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.08 6.08l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" />
    </svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ paddingLeft: 20, paddingBottom: 8, animation: 'cwFade 0.2s ease-out' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#fff', border: '1px solid #E5E7EB',
        borderRadius: '4px 18px 18px 18px',
        padding: '11px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF',
            display: 'block',
            animation: `cwDot 1.3s ease-in-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

function AgentBubble({ msg }) {
  const text = formatAgentMessage(msg.content)
  return (
    <div style={{ paddingLeft: 20, paddingRight: 56, paddingBottom: 10, animation: 'cwFade 0.2s ease-out' }}>
      <div style={{
        background: '#fff', border: '1px solid #E5E7EB',
        borderRadius: '4px 18px 18px 18px',
        padding: '12px 16px', fontSize: 14, lineHeight: 1.6,
        color: '#111827', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        wordBreak: 'break-word',
      }}>
        {text.split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </div>
      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5, paddingLeft: 2 }}>{fmtTime(msg.ts)}</p>
    </div>
  )
}

function UserBubble({ msg }) {
  return (
    <div style={{ paddingRight: 20, paddingLeft: 56, paddingBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', animation: 'cwFade 0.2s ease-out' }}>
      <div style={{
        background: TEAL, color: '#fff',
        borderRadius: '18px 4px 18px 18px',
        padding: '12px 16px', fontSize: 14, lineHeight: 1.6,
        wordBreak: 'break-word',
      }}>
        {msg.content.split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </div>
      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5, paddingRight: 2 }}>{fmtTime(msg.ts)}</p>
    </div>
  )
}

function Bubble({ msg }) {
  return msg.role === 'user' ? <UserBubble msg={msg} /> : <AgentBubble msg={msg} />
}

function EscalationNotice() {
  return (
    <div style={{ margin: '4px 20px 12px', padding: '14px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12 }}>
      <p style={{ fontSize: 13, color: '#92400E', fontWeight: 600, margin: '0 0 2px' }}>Our team has been notified</p>
      <p style={{ fontSize: 13, color: '#B45309', margin: 0 }}>A team member will follow up with you shortly. For urgent matters, call <strong>011 234 5678</strong>.</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const [messages,       setMessages]       = useState([])
  const [input,          setInput]          = useState('')
  const [isTyping,       setIsTyping]       = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [wasEscalated,   setWasEscalated]   = useState(false)
  const [sessionId]                         = useState(() => uid())
  const [error,          setError]          = useState(null)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const taRef     = useRef(null)

  useEffect(() => {
    setTimeout(() => {
      setMessages([{
        id:      'greeting',
        role:    'assistant',
        content: "Hi, I'm Lerato, SmileCare's virtual receptionist.\n\nI can help you book an appointment, answer questions about our services and pricing, or connect you with our team.\n\nHow can I help you today?",
        ts:      new Date(),
      }])
    }, 400)
    setTimeout(() => inputRef.current?.focus(), 500)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function autoGrow(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isTyping || wasEscalated) return
    setInput('')
    setError(null)
    if (taRef.current) { taRef.current.style.height = 'auto' }
    setMessages(prev => [...prev, { id: uid(), role: 'user', content: text, ts: new Date() }])
    const t0 = Date.now()
    setIsTyping(true)
    try {
      const { data } = await axios.post(`${API_BASE}/chat/${CLIENT_SLUG}`, {
        message: text, conversation_id: conversationId,
        channel: 'web', user_identifier: sessionId,
      })
      const wait = MIN_MS - (Date.now() - t0)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      setIsTyping(false)
      if (!conversationId) setConversationId(data.conversation_id)
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: data.message, ts: new Date() }])
      if (data.was_escalated) setWasEscalated(true)
    } catch (err) {
      setIsTyping(false)
      setError(err.response?.data?.detail || 'Connection issue. Please try again or call 011 234 5678.')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const canSend = input.trim() && !isTyping && !wasEscalated

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes cwFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cwDot {
          0%, 60%, 100% { transform: scale(1);    opacity: 0.45; }
          30%            { transform: scale(1.55); opacity: 1;    }
        }
        .cw-messages::-webkit-scrollbar { width: 4px; }
        .cw-messages::-webkit-scrollbar-track { background: transparent; }
        .cw-messages::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }
        .cw-textarea { resize: none; outline: none; border: none; background: transparent; width: 100%; font-family: inherit; font-size: 14px; color: #111827; line-height: 1.5; min-height: 22px; max-height: 120px; }
        .cw-textarea::placeholder { color: #9CA3AF; }
        .cw-send:hover { background: ${TEAL_D} !important; }
        .cw-phone:hover { color: ${TEAL} !important; }
      `}</style>

      {/* Page shell — light grey on desktop, white on mobile */}
      <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'stretch', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

        {/* Chat card */}
        <div style={{ width: '100%', maxWidth: 520, background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 32px rgba(0,0,0,0.10)', minHeight: '100vh' }}>

          {/* ── Header ── */}
          <div style={{ borderBottom: '1px solid #F0F0F0', padding: '0 20px', height: 72, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>

            {/* Logo */}
            <div style={{ width: 44, height: 44, borderRadius: 12, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.5px' }}>SC</span>
            </div>

            {/* Name + status */}
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.2 }}>SmileCare Dental</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'block', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#6B7280' }}>{AGENT_NAME} · Receptionist · Available now</span>
              </div>
            </div>

            {/* Phone CTA */}
            <a
              href="tel:+27112345678"
              className="cw-phone"
              title="Call SmileCare — 011 234 5678"
              style={{ color: '#9CA3AF', transition: 'color 0.15s', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, textDecoration: 'none' }}
            >
              <PhoneIcon />
            </a>
          </div>

          {/* ── Intro banner ── */}
          <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
            <div style={{ background: '#F0F9FB', border: '1px solid #CCE9F0', borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>SC</span>
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, color: '#0F4C57', marginBottom: 3 }}>SmileCare Dental — Sandton &amp; Rosebank</p>
                <p style={{ fontSize: 12, color: '#2A7A8C', lineHeight: 1.5 }}>Mon – Fri: 07:00 – 18:00 &nbsp;·&nbsp; Sat: 08:00 – 14:00 &nbsp;·&nbsp; Emergency: 011 234 5678</p>
              </div>
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            className="cw-messages"
            style={{ flex: 1, overflowY: 'auto', padding: '20px 0 8px', display: 'flex', flexDirection: 'column' }}
          >
            {/* Date pill */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', background: '#F3F4F6', padding: '4px 12px', borderRadius: 20, fontWeight: 500 }}>
                Today
              </span>
            </div>

            {/* Agent label — shown once before the first agent message */}
            {messages.length > 0 && (
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', paddingLeft: 22, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {AGENT_NAME}
              </p>
            )}

            {messages.map(m => <Bubble key={m.id} msg={m} />)}

            {isTyping && <TypingDots />}

            {wasEscalated && !isTyping && <EscalationNotice />}

            {error && (
              <div style={{ margin: '4px 20px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: '#991B1B' }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ── */}
          <div style={{ borderTop: '1px solid #F0F0F0', padding: '12px 16px', flexShrink: 0, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: '#F9FAFB', borderRadius: 14, border: '1.5px solid #E5E7EB', padding: '10px 14px', transition: 'border-color 0.15s' }}>
              <textarea
                ref={el => { inputRef.current = el; taRef.current = el }}
                className="cw-textarea"
                rows={1}
                value={input}
                onChange={e => { setInput(e.target.value); autoGrow(e.target) }}
                onKeyDown={handleKeyDown}
                disabled={wasEscalated}
                placeholder={wasEscalated ? 'Team will follow up with you…' : 'Type your message…'}
              />
              <button
                className="cw-send"
                onClick={sendMessage}
                disabled={!canSend}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  background: canSend ? TEAL : '#D1D5DB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canSend ? 'pointer' : 'default',
                  flexShrink: 0, transition: 'background 0.15s',
                }}
              >
                <SendIcon />
              </button>
            </div>

            {/* Footer note */}
            <p style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: 10 }}>
              SmileCare Dental &nbsp;·&nbsp; hello@smilecare.co.za
            </p>
          </div>

          {/* iPhone safe area */}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)', background: '#fff', flexShrink: 0 }} />
        </div>
      </div>
    </>
  )
}
