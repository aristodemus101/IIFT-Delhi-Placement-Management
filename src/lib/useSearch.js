import { useState, useEffect, useMemo } from 'react'

// Keys that are internal/non-searchable — never contribute to the index.
const SKIP_KEYS = new Set(['_id', 'cohort', 'createdAt', 'updatedAt', 'postedBy'])

function extractSearchableText(item) {
  const parts = []

  for (const k of Object.keys(item)) {
    // Skip internal private keys (but still recurse into placement objects below)
    if (k.startsWith('_') || SKIP_KEYS.has(k)) continue
    const v = item[k]
    if (v == null) continue
    if (typeof v === 'object') continue   // nested objects skipped at top level
    if (typeof v === 'boolean') continue  // true/false would cause false positives
    parts.push(String(v))
  }

  // Recurse into placement slots so search finds students by company/role
  for (const slot of ['_placement_summer', '_placement_final']) {
    const p = item[slot]
    if (!p || typeof p !== 'object') continue
    for (const field of ['company', 'role', 'sector', 'location', 'via']) {
      if (p[field]) parts.push(String(p[field]))
    }
  }

  return parts.join(' ').toLowerCase()
}

export function useSearch(items) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 180)
    return () => clearTimeout(t)
  }, [searchTerm])

  const index = useMemo(() => items.map(extractSearchableText), [items])

  const match = useMemo(() => {
    const term = debouncedTerm.toLowerCase().trim()
    if (!term) return null // null = no filter active, caller uses full list
    return new Set(items.reduce((acc, _, i) => {
      if (index[i].includes(term)) acc.push(i)
      return acc
    }, []))
  }, [debouncedTerm, index, items])

  return { searchTerm, setSearchTerm, match }
}
