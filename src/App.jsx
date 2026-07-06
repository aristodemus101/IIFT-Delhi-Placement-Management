import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { PendingChangesProvider } from './lib/PendingChangesContext'
import { SheetsSyncProvider } from './lib/SheetsSyncContext'
import { ThemeProvider } from './lib/ThemeContext'
import { BatchProvider } from './lib/BatchContext'
import { usePermissions } from './lib/usePermissions'
import { Spinner } from './components/UI'
import Layout from './components/Layout'

// LoginPage stays eager — it's the first thing unauthenticated users see.
import LoginPage from './pages/LoginPage'

// All authenticated pages are lazy — they only load after the user is signed in
// and navigates to that route. This splits the bundle into per-route chunks and
// keeps the initial JS payload small for the PWA shell.
const DashboardPage  = lazy(() => import('./pages/DashboardPage'))
const RosterPage     = lazy(() => import('./pages/RosterPage'))
const PlacedPage     = lazy(() => import('./pages/PlacedPage'))
const RemapperPage   = lazy(() => import('./pages/RemapperPage'))
const ApprovalsPage  = lazy(() => import('./pages/ApprovalsPage'))
const AdminPage      = lazy(() => import('./pages/AdminPage'))
const ActivityPage   = lazy(() => import('./pages/ActivityPage'))
const AnalyticsPage  = lazy(() => import('./pages/AnalyticsPage'))
const TpoPage        = lazy(() => import('./pages/TpoPage'))
const IntelPage      = lazy(() => import('./pages/IntelPage'))
const AboutPage      = lazy(() => import('./pages/AboutPage'))

// Full-screen centered spinner used during auth resolution and lazy page loads
function FullSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Spinner />
    </div>
  )
}

function AuthGate({ children }) {
  const { user, authStatus } = useAuth()
  const location = useLocation()
  // Block only while Firebase hasn't resolved yet (user === undefined, ~50ms from cache).
  // Once Firebase fires, we know if there's a user — render immediately.
  // Role loads in the background; PageGate handles per-page role gating.
  if (user === undefined) return <FullSpinner />
  if (authStatus === 'unauthorized') return <UnauthorizedPage />
  if (!user) return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}${location.hash}` }} replace />
  return children
}

function UnauthorizedPage() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-grad)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '40px 44px', width: 400,
        boxShadow: 'var(--shadow)', textAlign: 'center', backdropFilter: 'blur(20px)'
      }}>
        <div style={{
          width: 52, height: 52, background: 'var(--red-bg)', borderRadius: 'var(--radius)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          border: '1px solid var(--red-border)'
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--red-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10, color: 'var(--text)' }}>Access Denied</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Your email is not authorised to access this platform. Contact the placement team.
        </p>
      </div>
    </div>
  )
}

function LoginRoute() {
  const { user, authStatus } = useAuth()
  const location = useLocation()
  // Wait for Firebase to resolve before showing login or redirecting.
  // This prevents a flash of LoginPage for already-signed-in users.
  if (user === undefined) return <FullSpinner />
  if (authStatus === 'unauthorized') return <UnauthorizedPage />
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
        <Route index                element={<Suspense fallback={<FullSpinner />}><RoleHome /></Suspense>} />
        <Route path="roster"        element={<PageGate page="roster"><Suspense fallback={<FullSpinner />}><RosterPage /></Suspense></PageGate>} />
        <Route path="placed"        element={<PageGate page="placed"><Suspense fallback={<FullSpinner />}><PlacedPage /></Suspense></PageGate>} />
        <Route path="remapper"      element={<PageGate page="remapper"><Suspense fallback={<FullSpinner />}><RemapperPage /></Suspense></PageGate>} />
        <Route path="activity"      element={<PageGate page="activity"><Suspense fallback={<FullSpinner />}><ActivityPage /></Suspense></PageGate>} />
        <Route path="analytics"     element={<PageGate page="analytics"><Suspense fallback={<FullSpinner />}><AnalyticsPage /></Suspense></PageGate>} />
        <Route path="tpo"           element={<PageGate page="tpo"><Suspense fallback={<FullSpinner />}><TpoPage /></Suspense></PageGate>} />
        <Route path="intel"         element={<PageGate page="intel"><Suspense fallback={<FullSpinner />}><IntelPage /></Suspense></PageGate>} />
        <Route path="approvals"     element={<PageGate page="approvals"><Suspense fallback={<FullSpinner />}><ApprovalsPage /></Suspense></PageGate>} />
        <Route path="admin"         element={<PageGate page="admin"><Suspense fallback={<FullSpinner />}><AdminPage /></Suspense></PageGate>} />
        <Route path="about"         element={<PageGate page="about"><Suspense fallback={<FullSpinner />}><AboutPage /></Suspense></PageGate>} />
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
