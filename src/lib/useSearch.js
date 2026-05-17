import { useState, useEffect, useMemo } from 'react'

export function useSearch(items) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 180)
    return () => clearTimeout(t)
  }, [searchTerm])

  const index = useMemo(() => items.map(s => {
    const parts = []
    for (const k of Object.keys(s)) {
      const v = s[k]
      if (v != null && typeof v !== 'object') parts.push(String(v))
    }
    return parts.join(' ').toLowerCase()
  }), [items])

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
