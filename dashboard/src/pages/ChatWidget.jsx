/**
 * ChatWidget — Standalone public chat interface for SmileCare Dental.
 *
 * Route:  /chat/smilecare  (no auth required)
 * API:    POST /api/chat/smilecare
 *
 * Features:
 *  - WhatsApp-style chat bubbles
 *  - Typing indicator with animated dots
 *  - Conversation ID maintained throughout session
 *  - Timestamps on every message
 *  - Escalation notice when agent flags for human review
 *  - Fully mobile-responsive
 */

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE      = '/api'
const CLIENT_SLUG   = 'smilecare'
const AGENT_NAME    = 'Zara'
const CLINIC_NAME   = 'SmileCare Dental'

// Minimum ms to show the typing indicator — feels more natural
const MIN_TYPING_MS = 900

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function genSessionId() {
  return 'web-' + Math.random().toString(36).slice(2, 10)
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 px-4 py-1">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
        style={{ background: 'linear-gradient(135deg, #00a884, #00cf9d)' }}
      >
        Z
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1"
        style={{ background: '#1f2c34' }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: '#8696a0',
              animation: `bounce 1.2s infinite ${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-0.5">
        <div className="max-w-xs sm:max-w-sm lg:max-w-md">
          <div
            className="px-3.5 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed"
            style={{ background: '#005c4b', color: '#e9edef' }}
          >
            {msg.content.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </div>
          <p className="text-right mt-0.5 pr-1 text-xs" style={{ color: '#8696a0' }}>
            {fmtTime(msg.ts)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 px-4 py-0.5">
      {/* Agent avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold self-end mb-5"
        style={{ background: 'linear-gradient(135deg, #00a884, #00cf9d)' }}
      >
        Z
      </div>
      <div className="max-w-xs sm:max-w-sm lg:max-w-md">
        <div
          className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed"
          style={{ background: '#1f2c34', color: '#e9edef' }}
        >
          {msg.content.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
        <p className="mt-0.5 pl-1 text-xs" style={{ color: '#8696a0' }}>
          {fmtTime(msg.ts)}
        </p>
      </div>
    </div>
  )
}

// ── Escalation notice ─────────────────────────────────────────────────────────

function EscalationNotice() {
  return (
    <div className="mx-4 my-2">
      <div
        className="rounded-xl px-4 py-3 text-sm text-center"
        style={{ background: 'rgba(255, 213, 91, 0.1)', border: '1px solid rgba(255, 213, 91, 0.25)', color: '#ffd55b' }}
      >
        <p className="font-medium">A team member will follow up with you shortly.</p>
        <p className="text-xs mt-0.5 opacity-75">You can also call us directly on 011 555 0100</p>
      </div>
    </div>
  )
}

// ── Date divider ──────────────────────────────────────────────────────────────

function DateDivider({ label }) {
  return (
    <div className="flex items-center justify-center py-3">
      <span
        className="text-xs px-3 py-1 rounded-full"
        style={{ background: '#1f2c34', color: '#8696a0' }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const [messages,       setMessages]       = useState([])
  const [input,          setInput]          = useState('')
  const [isTyping,       setIsTyping]       = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [wasEscalated,   setWasEscalated]   = useState(false)
  const [sessionId]                         = useState(() => genSessionId())
  const [error,          setError]          = useState(null)

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  // Add greeting on mount
  useEffect(() => {
    setMessages([{
      id:      'greeting',
      role:    'assistant',
      content: `👋 Hi there! I'm Zara, your SmileCare virtual receptionist.\n\nI can help you with:\n• Booking appointments\n• Our services and pricing\n• Business hours and location\n• Any dental questions you have\n\nHow can I help you today?`,
      ts:      new Date(),
    }])
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isTyping || wasEscalated) return

    setInput('')
    setError(null)

    // Add user message immediately
    const userMsg = { id: Date.now(), role: 'user', content: text, ts: new Date() }
    setMessages(prev => [...prev, userMsg])

    const typingStart = Date.now()
    setIsTyping(true)

    try {
      const { data } = await axios.post(
        `${API_BASE}/chat/${CLIENT_SLUG}`,
        {
          message:         text,
          conversation_id: conversationId,
          channel:         'web',
          user_identifier: sessionId,
        }
      )

      // Ensure typing indicator shows for at least MIN_TYPING_MS
      const elapsed = Date.now() - typingStart
      if (elapsed < MIN_TYPING_MS) {
        await new Promise(r => setTimeout(r, MIN_TYPING_MS - elapsed))
      }

      setIsTyping(false)

      if (!conversationId) setConversationId(data.conversation_id)

      setMessages(prev => [
        ...prev,
        {
          id:      data.conversation_id + Date.now(),
          role:    'assistant',
          content: data.message,
          ts:      new Date(),
        },
      ])

      if (data.was_escalated) setWasEscalated(true)

    } catch (err) {
      setIsTyping(false)
      const detail = err.response?.data?.detail || 'Connection error. Please try again.'
      setError(detail)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Bounce animation for typing dots */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      <div
        className="flex flex-col h-screen w-full"
        style={{ background: '#0b141a', maxWidth: '100vw' }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ background: '#1f2c34', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
        >
          {/* Logo / Avatar */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #00a884, #00cf9d)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-6 h-6">
              <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V12l2 2-2 2v1a4 4 0 0 1-8 0v-1l-2-2 2-2V9.5A4 4 0 0 1 8 6a4 4 0 0 1 4-4z"/>
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-none" style={{ color: '#e9edef' }}>
              {CLINIC_NAME}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: '#00a884', boxShadow: '0 0 5px #00a88488' }}
              />
              <span className="text-xs" style={{ color: '#8696a0' }}>
                {AGENT_NAME} is online
              </span>
            </div>
          </div>

          {/* Optional: call icon placeholder */}
          <a
            href="tel:+27115550100"
            className="p-2 rounded-full transition-colors duration-150"
            style={{ color: '#8696a0' }}
            title="Call SmileCare"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.08 6.08l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </a>
        </div>

        {/* ── Message feed ── */}
        <div
          className="flex-1 overflow-y-auto py-3 space-y-0.5"
          style={{ background: '#0b141a' }}
        >
          <DateDivider label="Today" />

          {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}

          {isTyping && <TypingIndicator />}

          {wasEscalated && !isTyping && <EscalationNotice />}

          {error && (
            <div className="px-4 py-1">
              <div
                className="text-xs px-3 py-2 rounded-lg text-center"
                style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.2)' }}
              >
                {error}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div
          className="shrink-0 px-3 py-3 flex items-end gap-2"
          style={{ background: '#1f2c34' }}
        >
          <div
            className="flex-1 flex items-end rounded-2xl overflow-hidden"
            style={{ background: '#2a3942' }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                // Auto-grow up to 4 rows
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder={wasEscalated ? 'A team member will follow up…' : 'Message SmileCare…'}
              disabled={wasEscalated}
              className="flex-1 px-4 py-3 text-sm resize-none outline-none bg-transparent leading-relaxed"
              style={{
                color: '#e9edef',
                minHeight: 44,
                maxHeight: 96,
                '::placeholder': { color: '#8696a0' },
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping || wasEscalated}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
            style={{
              background: input.trim() && !isTyping && !wasEscalated
                ? '#00a884'
                : '#2a3942',
              transform: input.trim() ? 'scale(1)' : 'scale(0.9)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke={input.trim() && !wasEscalated ? 'white' : '#8696a0'}
              strokeWidth={2}
              className="w-5 h-5"
              style={{ transform: 'rotate(45deg)' }}
            >
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        {/* Safe area spacer for iPhone home bar */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)', background: '#1f2c34' }} />
      </div>
    </>
  )
}
