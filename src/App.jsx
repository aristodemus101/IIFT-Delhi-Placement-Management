import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { PendingChangesProvider } from './lib/PendingChangesContext'
import { SheetsSyncProvider } from './lib/SheetsSyncContext'
import { ThemeProvider } from './lib/ThemeContext'
import { BatchProvider } from './lib/BatchContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RosterPage from './pages/RosterPage'
import PlacedPage from './pages/PlacedPage'
import RemapperPage from './pages/RemapperPage'
import ApprovalsPage from './pages/ApprovalsPage'
import AdminPage from './pages/AdminPage'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, role } = useAuth()

  if (user === undefined) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>
      Loading…
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (adminOnly && role !== 'admin') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>
      <strong style={{ color: 'var(--text)', fontSize: 16 }}>Access Restricted</strong>
      <p style={{ fontSize: 13 }}>This page is only accessible to admins.</p>
    </div>
  )

  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><BatchProvider><SheetsSyncProvider><PendingChangesProvider><Layout /></PendingChangesProvider></SheetsSyncProvider></BatchProvider></ProtectedRoute>}>
        <Route index          element={<DashboardPage />} />
        <Route path="roster"  element={<RosterPage />} />
        <Route path="placed"  element={<PlacedPage />} />
        <Route path="remapper" element={<RemapperPage />} />
        <Route path="approvals" element={<ProtectedRoute adminOnly><ApprovalsPage /></ProtectedRoute>} />
        <Route path="admin"   element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
