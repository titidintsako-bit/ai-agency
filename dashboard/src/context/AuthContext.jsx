/**
 * context/AuthContext.jsx
 *
 * In-memory auth state. The JWT is never written to localStorage or cookies —
 * it lives only in React state and is cleared on page refresh (by design, for
 * a personal admin tool this is fine and more secure).
 *
 * Provides: { token, user, loading, login, logout }
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { login as loginApi } from '../api/auth'
import { setAuthToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token,   setToken]   = useState(null)   // raw JWT string
  const [user,    setUser]    = useState(null)   // email string
  const [loading, setLoading] = useState(false)

  // ── Logout ──────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setAuthToken(null)
  }, [])

  // Listen for 401 events fired by the axios interceptor
  useEffect(() => {
    window.addEventListener('auth:expired', logout)
    return () => window.removeEventListener('auth:expired', logout)
  }, [logout])

  // ── Login ───────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      const data = await loginApi(email, password)
      setToken(data.access_token)
      setUser(data.email ?? email)
      setAuthToken(data.access_token)   // attach to all future axios requests
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
