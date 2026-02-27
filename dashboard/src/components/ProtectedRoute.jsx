import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wrap any route element with this to require authentication.
 * Unauthenticated users are redirected to /login with a `from` state
 * so the login page can redirect back after successful login.
 */
export default function ProtectedRoute({ children }) {
  const { token } = useAuth()
  const location  = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
