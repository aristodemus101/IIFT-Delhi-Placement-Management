import React, { useState } from 'react'
import { sectorColor } from './IntelTable'

// Domain inference: "Asian Paints" → "asianpaints.com"
// Covers ~60-70% of well-known companies; the fallback chain handles misses.
function inferDomain(name) {
  if (!name) return null
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')   // strip punctuation
    .replace(/\s+/g, '')           // collapse spaces
  if (!slug) return null
  return `${slug}.com`
}

// Google Favicon API at 64px — backed by Google infra, never down.
// Returns a branded placeholder (not a broken image) on misses.
function googleLogoUrl(domain) {
  return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`
}

// DuckDuckGo favicon — secondary fallback, reliable uptime.
function ddgLogoUrl(domain) {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}

// Three-stage fallback:
//   1. Google Favicon API (64px, branded placeholder on miss)
//   2. DuckDuckGo favicon (32px ico, globe on miss — triggers next fallback)
//   3. CSS initials avatar — guaranteed, zero network
//
// We track failure count via state so we know which src to try next.
export default function CompanyLogo({ name, size = 28, fallbackColor, sector }) {
  const [failures, setFailures] = useState(0)

  const domain = inferDomain(name)
  const color  = fallbackColor || sectorColor(sector)
  const initial = (name || '?')[0].toUpperCase()

  const containerStyle = {
    width: size, height: size, borderRadius: Math.round(size * 0.25),
    flexShrink: 0, overflow: 'hidden', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  }

  // No domain or both remote sources failed → initials avatar
  if (!domain || failures >= 2) {
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

  const src = failures === 0 ? googleLogoUrl(domain) : ddgLogoUrl(domain)

  return (
    <span style={{ ...containerStyle, background: 'var(--surface2)' }}>
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setFailures(f => f + 1)}
      />
    </span>
  )
}
