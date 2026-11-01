import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Shows a small banner when a new deployed version is available, so users on an
// always-open tab aren't stuck on stale code. Clicking "Reload" applies the
// waiting service worker and refreshes. Registration failures are swallowed —
// the app must never break because the SW couldn't register.
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) { console.warn('SW registration failed', err) },
  })

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
        onClick={() => updateServiceWorker(true)}
        style={{
          border: 'none', cursor: 'pointer', borderRadius: 8,
          padding: '7px 14px', fontWeight: 700, fontSize: 13,
          background: '#fff', color: '#1d3557', fontFamily: 'inherit',
        }}
      >
        Reload
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
