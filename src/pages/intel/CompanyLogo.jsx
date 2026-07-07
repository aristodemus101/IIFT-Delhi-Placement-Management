import React, { useState } from 'react'
import { sectorColor } from './IntelTable'

function inferDomain(name) {
  if (!name) return null
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '')
  if (!slug) return null
  return `${slug}.com`
}

// Google Favicon API — returns a 16×16 globe placeholder on unknown domains
// instead of 404ing. We detect this on onLoad by checking naturalWidth ≤ 16.
function googleLogoUrl(domain) {
  return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`
}

// Clearbit Logo API — proper 404 on unknown domains, fires onError correctly.
// Good quality PNG at any size. Works well for global MNCs.
function clearbitLogoUrl(domain) {
  return `https://logo.clearbit.com/${domain}?size=128`
}

// Fallback chain:
//   1. Google Favicon (128px) — detected as globe if naturalWidth ≤ 16 → skip
//   2. Clearbit Logo (128px) — 404s on miss → onError fires → skip
//   3. CSS initials avatar — guaranteed, zero network
export default function CompanyLogo({ name, size = 28, fallbackColor, sector }) {
  const [stage, setStage] = useState(0)

  const domain  = inferDomain(name)
  const color   = fallbackColor || sectorColor(sector)
  const initial = (name || '?')[0].toUpperCase()

  const containerStyle = {
    width: size, height: size, borderRadius: Math.round(size * 0.25),
    flexShrink: 0, overflow: 'hidden', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  }

  // No domain inferred, or all remote stages exhausted → initials
  if (!domain || stage >= 2) {
    return (
      <span style={{
        ...containerStyle,
        background: color,
        fontSize: Math.round(size * 0.42), fontWeight: 800, color: '#fff',
      }}>
        {initial}
      </span>
    )
  }

  const src = stage === 0 ? googleLogoUrl(domain) : clearbitLogoUrl(domain)

  const handleLoad = e => {
    // Google returns a 16×16 globe for unknown domains — treat as failure
    if (stage === 0 && e.currentTarget.naturalWidth <= 16) {
      setStage(1)
    }
  }

  return (
    <span style={{ ...containerStyle, background: 'var(--surface2)', padding: 2 }}>
      <img
        key={src}
        src={src}
        alt=""
        width={size - 4}
        height={size - 4}
        style={{ objectFit: 'contain', display: 'block', width: '100%', height: '100%' }}
        onLoad={handleLoad}
        onError={() => setStage(s => s + 1)}
      />
    </span>
  )
}
