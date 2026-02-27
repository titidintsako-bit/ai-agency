import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'

import Login            from './pages/Login'
import Home             from './pages/Home'
import Conversations    from './pages/Conversations'
import ConversationDetail from './pages/ConversationDetail'
import Escalations      from './pages/Escalations'
import Analytics        from './pages/Analytics'
import AgentConfig      from './pages/AgentConfig'
import ChatWidget       from './pages/ChatWidget'
import Monitor          from './pages/Monitor'

function Shell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d1117' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — no auth, no sidebar */}
          <Route path="/login"          element={<Login />} />
          <Route path="/chat/:slug"     element={<ChatWidget />} />
          <Route path="/monitor"        element={<Monitor />} />

          {/* Protected — all inside the sidebar shell */}
          <Route path="/" element={
            <ProtectedRoute>
              <Shell><Home /></Shell>
            </ProtectedRoute>
          } />
          <Route path="/conversations" element={
            <ProtectedRoute>
              <Shell><Conversations /></Shell>
            </ProtectedRoute>
          } />
          <Route path="/conversations/:id" element={
            <ProtectedRoute>
              <Shell><ConversationDetail /></Shell>
            </ProtectedRoute>
          } />
          <Route path="/escalations" element={
            <ProtectedRoute>
              <Shell><Escalations /></Shell>
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Shell><Analytics /></Shell>
            </ProtectedRoute>
          } />
          <Route path="/config" element={
            <ProtectedRoute>
              <Shell><AgentConfig /></Shell>
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
