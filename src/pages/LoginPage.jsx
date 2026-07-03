// src/pages/LoginPage.jsx
import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { ShieldX } from 'lucide-react'


function getSignInErrorMessage(error) {
  const code = error?.code || ''
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''

  if (code === 'auth/popup-blocked') {
    return 'Google sign-in could not open a popup. Please allow popups for this site and try again.'
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was closed before it completed. Please try again.'
  }

  if (code === 'auth/unauthorized-domain') {
    return currentHost
      ? `This domain (${currentHost}) is not authorized in Firebase Authentication. Add it under Firebase Console → Authentication → Settings → Authorized domains.`
      : 'This domain is not authorized in Firebase Authentication. Add the current site under Firebase Console → Authentication → Settings → Authorized domains.'
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled for this Firebase project. Enable Google under Firebase Authentication → Sign-in method.'
  }

  if (code === 'auth/admin-restricted-operation') {
    return 'This Firebase project does not allow Google sign-in from the current account or domain.'
  }

  if (error?.message) {
    return `${error.message}${code ? ` (${code})` : ''}`
  }

  return 'Sign-in failed. Please try again.'
}

function LoginLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'var(--login-cols, 1fr 1fr)',
      fontFamily: 'var(--font-sans)',
    }}>
      <style>{`@media (max-width: 640px) { :root { --login-cols: 1fr } .login-brand { display: none !important } }`}</style>
      {/* Left panel — brand (hidden on mobile) */}
      <div className="login-brand" style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '48px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '-0.02em', userSelect: 'none' }}>POS</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em' }}>PlacementOS</span>
        </div>

        {/* center text */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(147,197,253,0.8)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20,
          }}>IIFT Delhi · Placement Cell</div>
          <h1 style={{
            fontSize: 40, fontWeight: 900, color: '#fff',
            letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 18,
          }}>
            One place<br />for placement.
          </h1>
          <p style={{
            fontSize: 14.5, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.65, maxWidth: 300,
          }}>
            Roster, tracking, analytics, and outreach — for the placement team.
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 52px',
      }}>
        {children}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { login, authStatus } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try { await login() }
    catch (e) { setError(getSignInErrorMessage(e)) }
    finally { setLoading(false) }
  }

  if (authStatus === 'unauthorized') {
    return (
      <LoginLayout>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--red-bg)', border: '1px solid var(--red-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <ShieldX size={20} color="var(--red-text)" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10, color: 'var(--text)' }}>Access Denied</h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>
            Your email is not authorised to access this platform. Contact the placement team to request access.
          </p>
        </div>
      </LoginLayout>
    )
  }

  return (
    <LoginLayout>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{
            fontSize: 26, fontWeight: 900,
            letterSpacing: '-0.04em', lineHeight: 1.1,
            color: 'var(--text)', marginBottom: 8,
          }}>Sign in</h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Use your institute Google account to continue.
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', height: 44,
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: loading ? 'var(--surface2)' : 'var(--surface)',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, fontSize: 13.5, fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.12s var(--easing-out)',
          }}
          onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.boxShadow = 'var(--shadow)' } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
        >
          {loading ? (
            <span style={{ color: 'var(--text-3)' }}>Signing in…</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {error && (
          <div style={{
            marginTop: 16, padding: '11px 14px',
            background: 'var(--red-bg)', color: 'var(--red-text)',
            borderRadius: 10, fontSize: 13,
            border: '1px solid var(--red-border)',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 28, lineHeight: 1.5 }}>
          Access is restricted to authorised placement team members only.
        </p>
      </div>
    </LoginLayout>
  )
}
