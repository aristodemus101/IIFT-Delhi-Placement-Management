import React, { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Shows a small banner when a new deployed version is available, so users on an
// always-open tab aren't stuck on stale code. Clicking "Reload" applies the
// waiting service worker and refreshes. Registration failures are swallowed —
// the app must never break because the SW couldn't register.
export default function PwaUpdatePrompt() {
  const [reloading, setReloading] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) { console.warn('SW registration failed', err) },
  })

  // updateServiceWorker(true) is supposed to skipWaiting the new SW and reload
  // on 'controllerchange' — but that event is known to occasionally not fire,
  // leaving the user clicking "Reload" with nothing happening. Guarantee the
  // reload ourselves with a short fallback timer, so the button ALWAYS refreshes
  // to the new version even if the SW handshake is flaky.
  const handleReload = () => {
    setReloading(true)
    try {
      const p = updateServiceWorker(true)
      if (p && typeof p.then === 'function') {
        p.then(() => window.location.reload()).catch(() => window.location.reload())
      }
    } catch (_) { /* fall through to the timer below */ }
    // Hard fallback: if the SW handshake didn't trigger a reload shortly, do it.
    setTimeout(() => window.location.reload(), 1500)
  }

  if (!needRefresh) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed', zIndex: 2000, left: 16, right: 16, bottom: 16,
        maxWidth: 420, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 12,
        background: '#1d3557', color: '#fff',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 14,
      }}
    >
      <span style={{ flex: 1 }}>A new version is available.</span>
      <button
        onClick={handleReload}
        disabled={reloading}
        style={{
          border: 'none', cursor: reloading ? 'default' : 'pointer', borderRadius: 8,
          padding: '7px 14px', fontWeight: 700, fontSize: 13,
          background: '#fff', color: '#1d3557', fontFamily: 'inherit', opacity: reloading ? 0.7 : 1,
        }}
      >
        {reloading ? 'Reloading…' : 'Reload'}
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        style={{
          border: 'none', cursor: 'pointer', background: 'transparent',
          color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1, padding: '0 4px',
        }}
      >
        ×
      </button>
    </div>
  )
}
