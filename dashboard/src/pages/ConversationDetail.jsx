import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getConversationMessages } from '../api/dashboard'

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
        >
          A
        </div>
      )}

      <div style={{ maxWidth: '72%' }}>
        <div
          className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
          style={
            isUser
              ? {
                  background: 'rgba(99,102,241,0.15)',
                  color: '#c9d1d9',
                  borderBottomRightRadius: 4,
                }
              : {
                  background: '#161b22',
                  color: '#e6edf3',
                  border: '1px solid #21262d',
                  borderBottomLeftRadius: 4,
                }
          }
        >
          {/* Render newlines */}
          {(msg.content || '').split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
        <p
          className="text-xs mt-1 px-1"
          style={{
            color: '#6e7681',
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {msg.role === 'assistant' ? 'Agent' : 'User'}
          {msg.created_at && (
            <>
              {' · '}
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </>
          )}
        </p>
      </div>

      {/* User avatar */}
      {isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-medium"
          style={{ background: '#21262d', color: '#8b949e' }}
        >
          U
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metadata row
// ---------------------------------------------------------------------------

function MetaRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: '#6e7681' }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: '#e6edf3' }}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConversationDetail page
// ---------------------------------------------------------------------------

export default function ConversationDetail() {
  const { id } = useParams()

  const [messages, setMessages] = useState([])
  const [meta, setMeta]         = useState(null) // first conv row returned by history
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getConversationMessages(id)
        // API returns { conversation_id, messages: [...] }
        // Optionally the backend also returns conv metadata
        setMessages(data.messages || [])
        if (data.conversation) setMeta(data.conversation)
        setError(null)
      } catch (e) {
        setError('Failed to load conversation.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const statusColors = {
    active:    { bg: 'rgba(63,185,80,0.12)',  text: '#3fb950' },
    ended:     { bg: 'rgba(139,148,158,0.1)', text: '#8b949e' },
    escalated: { bg: 'rgba(248,81,73,0.12)',  text: '#f85149' },
  }

  const sc = meta ? (statusColors[meta.status] || statusColors.ended) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center gap-3 shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}
      >
        <Link
          to="/conversations"
          className="flex items-center gap-1.5 text-sm transition-colors duration-150"
          style={{ color: '#8b949e' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e6edf3' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8b949e' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Conversations
        </Link>
        <span style={{ color: '#30363d' }}>/</span>
        <span className="text-sm font-mono truncate max-w-xs" style={{ color: '#e6edf3' }}>
          {id}
        </span>
        {meta && sc && (
          <span
            className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
            style={{ background: sc.bg, color: sc.text }}
          >
            {meta.status}
          </span>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {loading ? (
            <div className="space-y-4 pt-4">
              {[1,2,3,4,5].map(i => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl"
                  style={{
                    height: 52,
                    maxWidth: '60%',
                    background: '#161b22',
                    marginLeft: i % 2 === 0 ? 'auto' : 0,
                  }}
                />
              ))}
            </div>
          ) : error ? (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}
            >
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth={1.5} className="w-12 h-12">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ color: '#6e7681' }}>No messages in this conversation.</p>
            </div>
          ) : (
            messages.map((msg, idx) => <Bubble key={idx} msg={msg} />)
          )}
        </div>

        {/* Metadata sidebar */}
        {meta && (
          <div
            className="w-60 shrink-0 overflow-auto px-5 py-5 space-y-5"
            style={{ borderLeft: '1px solid #21262d', background: '#0d1526' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6e7681' }}>
              Details
            </p>
            <MetaRow label="Client"  value={meta.clients?.name} />
            <MetaRow label="Agent"   value={meta.agents?.name} />
            <MetaRow label="Channel" value={meta.channel} />
            <MetaRow label="User"    value={meta.user_identifier} />
            <MetaRow
              label="Started"
              value={meta.started_at
                ? new Date(meta.started_at).toLocaleString()
                : null}
            />
            <MetaRow
              label="Ended"
              value={meta.ended_at
                ? new Date(meta.ended_at).toLocaleString()
                : null}
            />
            <MetaRow label="Messages" value={`${messages.length}`} />
          </div>
        )}
      </div>
    </div>
  )
}
