/**
 * api.js
 *
 * All HTTP calls to the FastAPI backend.
 *
 * In development: Vite proxies /api/* → http://localhost:8000/*
 * In production:  Vercel rewrites /api/* → https://your-app.railway.app/*
 *
 * So all paths use the /api prefix and the proxy strips it before forwarding.
 */

const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, opts)

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const json = await res.json()
      detail = json.detail ?? detail
    } catch (_) {}
    throw new Error(detail)
  }

  return res.json()
}

const get   = (path)        => request('GET',   path)
const patch = (path, body)  => request('PATCH', path, body)

export const api = {
  // ── System ─────────────────────────────────────────────────────────────
  health: () => get('/health'),
  root:   () => get('/'),

  // ── Dashboard ───────────────────────────────────────────────────────────
  getStats:  () => get('/dashboard/stats'),
  getAgents: () => get('/dashboard/agents'),

  /**
   * @param {{ limit?, offset?, status?, client_slug? }} opts
   */
  getConversations: ({ limit = 50, offset = 0, status = '', client_slug = '' } = {}) => {
    const q = new URLSearchParams({ limit, offset })
    if (status)      q.set('status', status)
    if (client_slug) q.set('client_slug', client_slug)
    return get(`/dashboard/conversations?${q}`)
  },

  /**
   * @param {{ status? }} opts
   */
  getEscalations: ({ status = '' } = {}) => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    const qs = q.toString()
    return get(`/dashboard/escalations${qs ? `?${qs}` : ''}`)
  },

  updateEscalation: (id, body) => patch(`/dashboard/escalations/${id}`, body),

  // ── Conversation detail ─────────────────────────────────────────────────
  // Returns { conversation, messages: [{role, content, created_at}] }
  getConversationHistory: (conversationId) =>
    get(`/dashboard/conversations/${conversationId}/messages`),
}
