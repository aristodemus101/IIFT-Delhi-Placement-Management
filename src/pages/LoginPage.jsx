// src/pages/LoginPage.jsx
import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { GraduationCap } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try { await login() }
    catch (e) { setError('Sign-in failed. Make sure pop-ups are allowed.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '40px 44px', width: 380,
        boxShadow: 'var(--shadow)', textAlign: 'center'
      }}>
        <div style={{
          width: 52, height: 52, background: 'var(--text)', borderRadius: 'var(--radius)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
        }}>
          <GraduationCap size={26} color="#fff" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>PlacementOS</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 32, lineHeight: 1.6 }}>
          Batch placement management for placement teams. Sign in with your institute Google account.
        </p>

        <button onClick={handleLogin} disabled={loading} style={{
          width: '100%', height: 42, border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', background: loading ? 'var(--surface2)' : 'var(--surface)',
          cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 500, color: 'var(--text)',
          fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
        }}>
          {loading ? (
            <span style={{ color: 'var(--text-2)' }}>Signing in…</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </>
          )}
        </button>

        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 24 }}>
          Access restricted to authorized team members.
        </p>
      </div>
    </div>
  )
}
