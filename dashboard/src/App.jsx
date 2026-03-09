import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'

import Login              from './pages/Login'
import Home               from './pages/Home'
import Conversations      from './pages/Conversations'
import ConversationDetail from './pages/ConversationDetail'
import Escalations        from './pages/Escalations'
import Analytics          from './pages/Analytics'
import AgentConfig        from './pages/AgentConfig'
import ChatWidget         from './pages/ChatWidget'
import Monitor            from './pages/Monitor'
import SmilecareSite      from './pages/SmilecareSite'
import LexisProSite       from './pages/LexisProSite'
import Appointments       from './pages/Appointments'

function Shell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d1117' }}>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 shrink-0"
          style={{ height: 48, borderBottom: '1px solid #21262d', background: '#0d1117' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ color: '#8b949e', display: 'flex', alignItems: 'center', padding: 4 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
              <line x1="3" y1="6"  x2="21" y2="6"  strokeLinecap="round"/>
              <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round"/>
              <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div
              style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} width={13} height={13}>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              </svg>
            </div>
            <span style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>AI Agency</span>
          </div>
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — no auth, no sidebar */}
          <Route path="/login"          element={<Login />} />
          <Route path="/chat/:slug"     element={<ChatWidget />} />
          <Route path="/monitor"        element={<Monitor />} />
          <Route path="/smilecare"      element={<SmilecareSite />} />
          <Route path="/lexispro"       element={<LexisProSite />} />

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
          <Route path="/appointments" element={
            <ProtectedRoute>
              <Shell><Appointments /></Shell>
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
