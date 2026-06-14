import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { PendingChangesProvider } from './lib/PendingChangesContext'
import { SheetsSyncProvider } from './lib/SheetsSyncContext'
import { ThemeProvider } from './lib/ThemeContext'
import { BatchProvider } from './lib/BatchContext'
import { usePermissions } from './lib/usePermissions'
import { Spinner } from './components/UI'
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
import TpoPage from './pages/TpoPage'

// Full-screen centered spinner used during auth resolution
function FullSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Spinner />
    </div>
  )
}

function AuthGate({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return <FullSpinner />
  if (!user) return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}${location.hash}` }} replace />
  return children
}

function LoginRoute() {
  const { user } = useAuth()
  const location = useLocation()
  // Still resolving auth — show spinner so login page doesn't flash before redirect
  if (user === undefined) return <FullSpinner />
  // Already logged in — go back to where they came from, or home
  if (user) return <Navigate to={location.state?.from || '/'} replace />
  return <LoginPage />
}

function roleHome(role) {
  if (role === 'tpo') return '/tpo'
  if (role === 'faculty_coordinator') return '/analytics'
  return '/'
}

function PageGate({ page, children }) {
  const { role } = useAuth()
  const { canAccessPage } = usePermissions()
  if (!role) return <FullSpinner />
  if (!canAccessPage(page)) return <Navigate to={roleHome(role)} replace />
  return children
}

function RoleHome() {
  const { role } = useAuth()
  if (!role) return <FullSpinner />
  if (role === 'tpo') return <Navigate to="/tpo" replace />
  if (role === 'faculty_coordinator') return <Navigate to="/analytics" replace />
  return <DashboardPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/" element={<AuthGate><BatchProvider><SheetsSyncProvider><PendingChangesProvider><Layout /></PendingChangesProvider></SheetsSyncProvider></BatchProvider></AuthGate>}>
        <Route index                element={<RoleHome />} />
        <Route path="roster"        element={<RosterPage />} />
        <Route path="placed"        element={<PageGate page="placed"><PlacedPage /></PageGate>} />
        <Route path="remapper"      element={<RemapperPage />} />
        <Route path="activity"      element={<ActivityPage />} />
        <Route path="analytics"     element={<PageGate page="analytics"><AnalyticsPage /></PageGate>} />
        <Route path="tpo"           element={<PageGate page="tpo"><TpoPage /></PageGate>} />
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
