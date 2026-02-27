/**
 * api/client.js
 *
 * Configured axios instance shared by all API modules.
 *
 * Auth:
 *   Call setAuthToken(token) after login to attach the Bearer header
 *   to every subsequent request. Call setAuthToken(null) on logout.
 *
 * Errors:
 *   All responses are unwrapped to res.data automatically.
 *   On 401 the client fires a 'auth:expired' window event so AuthContext
 *   can log the user out without circular imports.
 */

import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// ── Auth token ──────────────────────────────────────────────────────────────

export function setAuthToken(token) {
  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete client.defaults.headers.common['Authorization']
  }
}

// ── Response interceptor ────────────────────────────────────────────────────

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status  = err.response?.status
    const detail  = err.response?.data?.detail ?? err.message ?? 'Network error'

    if (status === 401) {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }

    return Promise.reject(new Error(detail))
  },
)

export default client
