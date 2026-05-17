import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { PendingChangesProvider } from './lib/PendingChangesContext'
import { SheetsSyncProvider } from './lib/SheetsSyncContext'
import { ThemeProvider } from './lib/ThemeContext'
import { BatchProvider } from './lib/BatchContext'
import { usePermissions } from './lib/usePermissions'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RosterPage from './pages/RosterPage'
import PlacedPage from './pages/PlacedPage'
import RemapperPage from './pages/RemapperPage'
import ApprovalsPage from './pages/ApprovalsPage'
import AdminPage from './pages/AdminPage'
import ActivityPage from './pages/ActivityPage'
import AnalyticsPage from './pages/AnalyticsPage'

function AuthGate({ children }) {
  const { user } = useAuth()
  if (user === undefined) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>
      Loading…
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PageGate({ page, children }) {
  const { canAccessPage } = usePermissions()
  if (!canAccessPage(page)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<AuthGate><BatchProvider><SheetsSyncProvider><PendingChangesProvider><Layout /></PendingChangesProvider></SheetsSyncProvider></BatchProvider></AuthGate>}>
        <Route index                element={<DashboardPage />} />
        <Route path="roster"        element={<RosterPage />} />
        <Route path="placed"        element={<PageGate page="placed"><PlacedPage /></PageGate>} />
        <Route path="remapper"      element={<RemapperPage />} />
        <Route path="activity"      element={<ActivityPage />} />
        <Route path="analytics"     element={<PageGate page="analytics"><AnalyticsPage /></PageGate>} />
        <Route path="approvals"     element={<PageGate page="approvals"><ApprovalsPage /></PageGate>} />
        <Route path="admin"         element={<PageGate page="admin"><AdminPage /></PageGate>} />
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
