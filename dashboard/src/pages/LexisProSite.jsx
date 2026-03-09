/**
 * LexisProSite — Full LexisPro Attorneys website.
 *
 * Route: /lexispro (public, no auth)
 *
 * Design: Cormorant Garamond headings, Inter body, navy #0A1628 primary,
 *         gold #C9A84C accent. Professional law firm aesthetic.
 * Sections: Nav, Hero, Practice Areas, About, Team, Fees, Contact, Footer.
 * Chat widget floats bottom-right.
 */

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const NAVY   = '#0A1628'
const NAVY_M = '#112040'
const GOLD   = '#C9A84C'
const GOLD_D = '#A8862F'
const BODY   = '#4A5568'
const LIGHT  = '#F7F8FA'
const BORDER = '#E2E5EA'

const API_BASE = '/api'
const SLUG     = 'lexispro'
const MIN_MS   = 800

const WELCOME = "Good day, I'm Aisha, LexisPro's virtual assistant. I can help with consultations, fees, and any questions about our legal services. How can I assist you today?"

function uid() { return Math.random().toString(36).slice(2, 10) }
function fmt(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

function formatMessage(text) {
  return text.replace(/\*+/g, '').replace(/  +/g, ' ').trim()
}

// ── Fonts ─────────────────────────────────────────────────────────────────────

function useFonts() {
  useEffect(() => {
    if (document.getElementById('lp-fonts')) return
    const link = document.createElement('link')
    link.id   = 'lp-fonts'
    link.rel  = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap'
    document.head.appendChild(link)
  }, [])
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PRACTICE_AREAS = [
  { icon: '⚖️', name: 'Commercial & Contract',  desc: 'Contracts, NDAs, business disputes, and corporate advisory for SMEs and listed companies.' },
  { icon: '🏠', name: 'Property & Conveyancing', desc: 'Transfer of ownership, bond registrations, lease agreements, and sectional title matters.' },
  { icon: '👨‍👩‍👧', name: 'Family & Divorce Law',   desc: 'Divorce, custody, maintenance orders, domestic partnerships, and ante-nuptial contracts.' },
  { icon: '👷', name: 'Labour & Employment',     desc: 'CCMA representation, unfair dismissal, retrenchment, and employment contract review.' },
  { icon: '📜', name: 'Wills & Estates',         desc: 'Will drafting, estate administration, trusts, and deceased estate winding-up.' },
  { icon: '🏛️', name: 'Litigation',              desc: 'High Court and Magistrates\' Court representation for civil and commercial disputes.' },
]

const TEAM = [
  { name: 'Adv. Nadia van der Merwe', role: 'Founding Partner',   area: 'Family & Divorce Law',         initials: 'NvdM' },
  { name: 'Adv. Themba Nkosi',        role: 'Senior Associate',   area: 'Commercial & Contract Law',    initials: 'TN'   },
  { name: 'Adv. Priya Reddy',         role: 'Associate',          area: 'Property & Conveyancing',      initials: 'PR'   },
  { name: 'Adv. Christiaan Botha',    role: 'Associate',          area: 'Labour & Employment Law',      initials: 'CB'   },
]

const FEES = [
  { service: 'Initial Consultation',    fee: 'R1,200',     note: '60-minute session with a qualified attorney' },
  { service: 'Contract Drafting',       fee: 'from R3,500', note: 'Commercial agreements, NDAs, SLAs'          },
  { service: 'Property Transfer',       fee: 'from R5,000', note: 'Conveyancing & bond registration'           },
  { service: 'Divorce Proceedings',     fee: 'from R2,500', note: 'Uncontested and contested divorce'           },
  { service: 'Will Drafting',           fee: 'from R1,800', note: 'Single will, joint will, or trust'          },
  { service: 'CCMA Representation',     fee: 'from R2,000', note: 'Conciliation and arbitration hearings'      },
]

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const serif = "'Cormorant Garamond', Georgia, serif"
const sans  = "'Inter', system-ui, sans-serif"

const sectionLabel = {
  color: GOLD, fontWeight: 600, fontSize: 12,
  letterSpacing: '0.15em', textTransform: 'uppercase',
  margin: '0 0 14px', fontFamily: sans,
}

// ── Chat Widget ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ padding: '0 0 4px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#f7f8fa', border: '1px solid #e2e5ea',
        borderRadius: '4px 16px 16px 16px',
        padding: '10px 14px',
      }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#9CA3AF', display: 'block',
            animation: 'lpDot 1.3s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user'
  const text   = isUser ? msg.content : formatMessage(msg.content)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div style={{
        background: isUser ? NAVY : '#F7F8FA',
        color: isUser ? 'white' : NAVY,
        border: isUser ? 'none' : `1px solid ${BORDER}`,
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '9px 13px', maxWidth: '80%',
        fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word',
        fontFamily: sans,
      }}>
        {text.split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </div>
      <span style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>{fmt(msg.ts)}</span>
    </div>
  )
}

function LexisWidget() {
  const [isOpen,    setIsOpen]    = useState(false)
  const [initiated, setInitiated] = useState(false)
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [typing,    setTyping]    = useState(false)
  const [convId,    setConvId]    = useState(null)
  const [escalated, setEscalated] = useState(false)
  const [sessionId]               = useState(() => 'web-' + uid())
  const bottomRef                 = useRef(null)
  const inputRef                  = useRef(null)

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
        content: "I'm having connection issues. Please call us on 021 555 1234.",
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
        @keyframes lpSlide {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lpDot {
          0%, 60%, 100% { transform: scale(1); opacity: 0.4; }
          30%            { transform: scale(1.5); opacity: 1; }
        }
        @keyframes lpFade {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-msgs::-webkit-scrollbar { display: none; }
        .lp-msgs { scrollbar-width: none; }
        .lp-input { caret-color: ${NAVY}; }
        .lp-input::placeholder { color: #9CA3AF; }
        .lp-input:focus { outline: none; }
      `}</style>

      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>

        {/* Chat window */}
        {isOpen && (
          <div style={{
            width: 360, height: 520,
            borderRadius: 16, background: 'white',
            border: `1px solid ${BORDER}`,
            boxShadow: '0 16px 48px rgba(10,22,40,0.18)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'lpSlide 0.22s ease-out',
          }}>
            {/* Header */}
            <div style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_M} 100%)`,
              height: 64, padding: '0 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(201,168,76,0.2)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(201,168,76,0.35)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: GOLD, fontFamily: sans }}>L</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: 0, fontFamily: sans }}>
                  LexisPro Attorneys
                </p>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '2px 0 0', fontFamily: sans }}>
                  Aisha · Legal Receptionist
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, display: 'block', boxShadow: `0 0 5px ${GOLD}88` }} />
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: sans }}>Online</span>
              </div>
              <button onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="lp-msgs" style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'white', display: 'flex', flexDirection: 'column' }}>
              {messages.length === 0 && !typing && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13, fontFamily: sans }}>
                  Connecting…
                </div>
              )}
              {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
              {typing && <TypingDots />}
              {escalated && !typing && (
                <div style={{ padding: '10px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, fontSize: 12, color: '#92400E', lineHeight: 1.5, fontFamily: sans }}>
                  An attorney will be in touch shortly. For urgent matters, call <strong>021 555 1234</strong>.
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: `1px solid ${BORDER}`, height: 58, padding: '0 14px', background: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                ref={inputRef}
                className="lp-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={escalated}
                placeholder={escalated ? 'Attorney will follow up…' : 'Message LexisPro…'}
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, fontFamily: sans, color: NAVY }}
              />
              <button
                onClick={send}
                disabled={!canSend}
                style={{
                  width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: canSend ? NAVY : BORDER,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canSend ? 'pointer' : 'default', transition: 'background 0.15s',
                }}
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" stroke="none"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Launcher */}
        <LauncherBtn isOpen={isOpen} onToggle={isOpen ? () => setIsOpen(false) : openWidget} />
      </div>
    </>
  )
}

function LauncherBtn({ isOpen, onToggle }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={isOpen ? 'Close chat' : 'Chat with LexisPro'}
      style={{
        width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: hov ? NAVY_M : NAVY,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 20px rgba(10,22,40,0.35), 0 0 0 2px ${GOLD}55`,
        transform: hov ? 'scale(1.06)' : 'scale(1)',
        transition: 'all 0.18s',
      }}
    >
      {isOpen ? (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="white" stroke="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LexisProSite() {
  useFonts()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <div style={{ fontFamily: sans, color: BODY, background: 'white', overflowX: 'hidden' }}>

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100, background: 'white',
        borderBottom: `1px solid ${scrolled ? BORDER : 'transparent'}`,
        boxShadow: scrolled ? '0 2px 16px rgba(10,22,40,0.07)' : 'none',
        transition: 'all 0.3s', padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: 0 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 8, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 18, color: GOLD }}>L</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontFamily: serif, fontWeight: 700, fontSize: 18, color: NAVY, margin: 0, lineHeight: 1.1 }}>LexisPro Attorneys</p>
              <p style={{ fontSize: 10, color: GOLD, margin: 0, fontWeight: 600, letterSpacing: '0.12em', fontFamily: sans }}>CAPE TOWN</p>
            </div>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {['practice', 'team', 'fees', 'contact'].map(id => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: sans, color: BODY, textTransform: 'capitalize', padding: '4px 0' }}
                onMouseEnter={e => { e.currentTarget.style.color = GOLD }}
                onMouseLeave={e => { e.currentTarget.style.color = BODY }}>
                {id === 'practice' ? 'Practice Areas' : id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>

          <NavyButton onClick={() => scrollTo('contact')}>Book Consultation</NavyButton>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #0D1E38 60%, #152545 100%)`, padding: '112px 24px 100px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -100, top: -100, width: 600, height: 600, borderRadius: '50%', background: `rgba(201,168,76,0.04)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -80, bottom: -80, width: 400, height: 400, borderRadius: '50%', background: `rgba(201,168,76,0.03)`, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 24, padding: '6px 18px', marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: sans }}>Cape Town's Trusted Legal Practice</span>
          </div>

          <h1 style={{ fontFamily: serif, fontSize: 'clamp(40px, 5.5vw, 68px)', fontWeight: 600, color: 'white', lineHeight: 1.1, margin: '0 0 24px', maxWidth: 700 }}>
            Expert Legal Counsel<br />
            <span style={{ color: GOLD }}>When It Matters Most</span>
          </h1>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, margin: '0 0 44px', maxWidth: 520, fontFamily: sans, fontWeight: 300 }}>
            A Cape Town law firm of dedicated attorneys providing clear, practical legal advice across commercial, property, family, and employment law.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 64 }}>
            <NavyGoldButton onClick={() => scrollTo('contact')}>Book a Consultation</NavyGoldButton>
            <button
              onClick={() => scrollTo('practice')}
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '13px 28px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: sans, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              Our Practice Areas
            </button>
          </div>

          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            {[['20+', 'Years Combined Experience'], ['4', 'Practice Areas'], ['Trusted', 'Cape Town Attorneys']].map(([n, l]) => (
              <div key={l}>
                <p style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: GOLD, margin: 0, lineHeight: 1 }}>{n}</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '5px 0 0', fontFamily: sans }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Practice Areas ── */}
      <section id="practice" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={sectionLabel}>What We Do</p>
            <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, color: NAVY, margin: 0, lineHeight: 1.15 }}>
              Our Practice Areas
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {PRACTICE_AREAS.map(a => <PracticeCard key={a.name} {...a} />)}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section id="team" style={{ padding: '96px 24px', background: LIGHT }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={sectionLabel}>Our People</p>
            <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, color: NAVY, margin: 0 }}>
              Meet the Team
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
            {TEAM.map(m => <TeamCard key={m.name} {...m} />)}
          </div>
        </div>
      </section>

      {/* ── Fees ── */}
      <section id="fees" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={sectionLabel}>Transparent Pricing</p>
            <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, color: NAVY, margin: '0 0 16px' }}>
              Fee Schedule
            </h2>
            <p style={{ color: BODY, fontSize: 16, maxWidth: 460, margin: '0 auto', lineHeight: 1.7, fontFamily: sans }}>
              All fees are indicative. A detailed estimate is provided after your initial consultation.
            </p>
          </div>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
            {FEES.map(({ service, fee, note }, i) => (
              <div key={service} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                padding: '20px 28px',
                borderBottom: i < FEES.length - 1 ? `1px solid ${BORDER}` : 'none',
                background: i % 2 === 0 ? 'white' : LIGHT,
              }}>
                <div>
                  <p style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: NAVY, margin: 0 }}>{service}</p>
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: '3px 0 0', fontFamily: sans }}>{note}</p>
                </div>
                <p style={{ fontFamily: sans, fontSize: 17, fontWeight: 700, color: GOLD, margin: 0, whiteSpace: 'nowrap' }}>{fee}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" style={{ padding: '96px 24px', background: NAVY }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ ...sectionLabel, color: GOLD }}>Get in Touch</p>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 600, color: 'white', margin: '0 0 16px' }}>
            Book Your Consultation
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, margin: '0 0 56px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', fontFamily: sans }}>
            Speak to a qualified attorney. Monday to Friday, 08:00–17:00.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20, marginBottom: 56, textAlign: 'left' }}>
            {[
              { label: 'Address', value: 'Suite 801, The Halyard, 12 Christiaan Barnard Street, Cape Town Foreshore, 8001', icon: '📍' },
              { label: 'Phone',   value: '021 555 1234',            href: 'tel:0215551234',              icon: '📞' },
              { label: 'Email',   value: 'hello@lexispro.co.za',    href: 'mailto:hello@lexispro.co.za', icon: '✉️' },
            ].map(c => (
              <div key={c.label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `rgba(201,168,76,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 20 }}>{c.icon}</div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontFamily: sans }}>{c.label}</p>
                {c.href
                  ? <a href={c.href} style={{ fontSize: 15, color: GOLD, fontWeight: 500, textDecoration: 'none', fontFamily: sans }}>{c.value}</a>
                  : <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.5, fontFamily: sans }}>{c.value}</p>
                }
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <NavyGoldButton onClick={() => {}} large>Call 021 555 1234</NavyGoldButton>
            <button
              style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '13px 28px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: sans }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            >
              Chat with Aisha →
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#060E1C', padding: '40px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 7, background: NAVY, border: `1px solid ${GOLD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 16, color: GOLD }}>L</span>
            </div>
            <div>
              <p style={{ fontFamily: serif, fontWeight: 600, color: 'white', margin: 0, fontSize: 15 }}>LexisPro Attorneys</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0, fontFamily: sans }}>Cape Town Foreshore</p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: sans }}>© 2025 LexisPro Attorneys. All rights reserved.</p>
          <p style={{ margin: 0, fontSize: 12, color: GOLD, fontFamily: sans }}>021 555 1234</p>
        </div>
      </footer>

      <LexisWidget />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavyButton({ children, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? NAVY_M : NAVY, color: 'white', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: sans, transition: 'all 0.15s' }}>
      {children}
    </button>
  )
}

function NavyGoldButton({ children, onClick, large }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? GOLD_D : GOLD, color: NAVY, border: 'none', borderRadius: 8, padding: large ? '14px 32px' : '12px 26px', fontSize: large ? 16 : 15, fontWeight: 700, cursor: 'pointer', fontFamily: sans, transform: hov ? 'translateY(-1px)' : 'none', transition: 'all 0.15s', boxShadow: '0 2px 12px rgba(201,168,76,0.35)' }}>
      {children}
    </button>
  )
}

function PracticeCard({ icon, name, desc }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ border: `1px solid ${hov ? GOLD : BORDER}`, borderRadius: 14, padding: '28px 24px', transform: hov ? 'translateY(-3px)' : 'none', boxShadow: hov ? '0 8px 30px rgba(10,22,40,0.08)' : 'none', transition: 'all 0.2s', cursor: 'default' }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 10, background: `rgba(10,22,40,0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontSize: 22 }}>{icon}</div>
      <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: NAVY, margin: '0 0 10px' }}>{name}</h3>
      <p style={{ color: BODY, fontSize: 14, lineHeight: 1.65, margin: 0, fontFamily: sans }}>{desc}</p>
    </div>
  )
}

function TeamCard({ name, role, area, initials }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 22px', textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: `2px solid ${GOLD}44` }}>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 17, color: GOLD }}>{initials}</span>
      </div>
      <p style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: NAVY, margin: '0 0 4px' }}>{name}</p>
      <p style={{ fontSize: 12, color: GOLD, fontWeight: 600, margin: '0 0 6px', fontFamily: sans }}>{role}</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontFamily: sans }}>{area}</p>
    </div>
  )
}
