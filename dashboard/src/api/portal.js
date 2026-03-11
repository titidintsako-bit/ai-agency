/**
 * api/portal.js
 *
 * All API calls for the client portal.
 * Uses a separate axios instance that attaches the portal JWT
 * (stored in sessionStorage) rather than the admin JWT.
 */

import axios from 'axios'

const portalClient = axios.create({
  baseURL: '/api/portal',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// ── Attach portal token from sessionStorage on every request ─────────────────

portalClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('portal_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// ── Unwrap response data, convert errors to messages ────────────────────────

portalClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status
    const detail = err.response?.data?.detail ?? err.message ?? 'Network error'
    if (status === 401) {
      sessionStorage.removeItem('portal_token')
      window.dispatchEvent(new CustomEvent('portal:expired'))
    }
    return Promise.reject(new Error(detail))
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export const portalLogin = (slug, password) =>
  portalClient.post('/auth/login', { slug, password })

export const portalMe = () =>
  portalClient.get('/auth/me')

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getPortalStats = () =>
  portalClient.get('/stats')

// ── Conversations ─────────────────────────────────────────────────────────────

export const getPortalConversations = (params = {}) =>
  portalClient.get('/conversations', { params })

export const getPortalConversationMessages = (id) =>
  portalClient.get(`/conversations/${id}/messages`)

// ── Appointments ──────────────────────────────────────────────────────────────

export const getPortalAppointments = (params = {}) =>
  portalClient.get('/appointments', { params })

export const updatePortalAppointment = (id, data) =>
  portalClient.patch(`/appointments/${id}`, data)

// ── Escalations ───────────────────────────────────────────────────────────────

export const getPortalEscalations = (params = {}) =>
  portalClient.get('/escalations', { params })

// ── Agents ────────────────────────────────────────────────────────────────────

export const getPortalAgents = () =>
  portalClient.get('/agents')

export const togglePortalAgent = (id) =>
  portalClient.patch(`/agents/${id}/toggle`)
