/**
 * context/PortalAuthContext.jsx
 *
 * Auth state for the client portal — separate from the admin AuthContext.
 * Stores the portal JWT in sessionStorage so it survives page refresh
 * but is cleared when the tab closes (unlike localStorage).
 *
 * Provides: { token, clientName, slug, loading, login, logout }
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { portalLogin } from '../api/portal'

const PortalAuthContext = createContext(null)

const STORAGE_KEY = 'portal_token'

function parseToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { clientName: payload.name, slug: payload.slug, clientId: payload.sub }
  } catch {
    return null
  }
}

export function PortalAuthProvider({ children }) {
  const [token,      setToken]      = useState(() => sessionStorage.getItem(STORAGE_KEY) || null)
  const [clientName, setClientName] = useState(null)
  const [slug,       setSlug]       = useState(null)
  const [loading,    setLoading]    = useState(false)

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseToken(stored)
      if (parsed) {
        setToken(stored)
        setClientName(parsed.clientName)
        setSlug(parsed.slug)
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setClientName(null)
    setSlug(null)
  }, [])

  const login = useCallback(async (clientSlug, password) => {
    setLoading(true)
    try {
      const data = await portalLogin(clientSlug, password)
      const parsed = parseToken(data.access_token)
      sessionStorage.setItem(STORAGE_KEY, data.access_token)
      setToken(data.access_token)
      setClientName(data.client_name || parsed?.clientName || clientSlug)
      setSlug(data.slug || clientSlug)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <PortalAuthContext.Provider value={{ token, clientName, slug, loading, login, logout }}>
      {children}
    </PortalAuthContext.Provider>
  )
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext)
  if (!ctx) throw new Error('usePortalAuth must be used inside <PortalAuthProvider>')
  return ctx
}
