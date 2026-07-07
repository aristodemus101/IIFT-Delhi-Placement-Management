// useIntel: live Firestore subscription to /intel collection.
// Provides search, filter, and IIFT benchmark join (fuzzy, last 3 years).
//
// Benchmark logic:
//   - "At IIFT"  : company fuzzy-matches one placed at IIFT (SIP or Finals)
//                  within the last 3 calendar years. SIP+Finals count once.
//   - "IIFT Gap" : appears in peer-college intel data but NOT at IIFT in that window.

import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { fuzzyMatch, normalizeId } from './intel'

export function useIntel({ students = [] } = {}) {
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    // Simple equality filter on _deleted avoids requiring a composite index.
    // Sorting is done client-side after enrichment.
    const q = query(
      collection(db, 'intel'),
      where('_deleted', '==', false),
    )
    const unsub = onSnapshot(
      q,
      snap => {
        const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
        docs.sort((a, b) => (a.recruiterName || '').localeCompare(b.recruiterName || ''))
        setRecords(docs)
        setLoading(false)
        setError(null)
      },
      err => {
        console.error('useIntel error', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  // ── IIFT placed company list (last 3 calendar years, deduplicated) ──────────
  // One entry per unique company name from IIFT student placements.
  // SIP and Finals both included — a company in both cycles still counts once
  // (Set deduplicates). Raw names preserved so fuzzyMatch can token-split.
  // Window: placementYear >= currentYear - 3 (2026 → 2023, 2024, 2025).
  const iiftPlacedNames = useMemo(() => {
    const cutoff = new Date().getFullYear() - 3
    const seen = new Set()
    students.forEach(s => {
      if (s._placed_final && s._placement_final?.company) {
        const yr = s._placement_final.placedAtIso
          ? new Date(s._placement_final.placedAtIso).getFullYear() : null
        if (yr !== null && yr >= cutoff) seen.add(s._placement_final.company)
      }
      if (s._placed_summer && s._placement_summer?.company) {
        const yr = s._placement_summer.placedAtIso
          ? new Date(s._placement_summer.placedAtIso).getFullYear() : null
        if (yr !== null && yr >= cutoff) seen.add(s._placement_summer.company)
      }
    })
    return [...seen]
  }, [students])

  // ── Attach IIFT status to each intel record ───────────────────────────────
  const enriched = useMemo(() => {
    return records.map(r => {
      const matchesIift = iiftPlacedNames.length > 0 && iiftPlacedNames.some(
        iiftName => fuzzyMatch(r.recruiterName, iiftName) || fuzzyMatch(r.alias, iiftName)
      )
      return { ...r, _iiftStatus: matchesIift ? 'at_iift' : 'gap' }
    })
  }, [records, iiftPlacedNames])

  // ── Derived filter options ─────────────────────────────────────────────────
  const colleges = useMemo(() => {
    const s = new Set()
    records.forEach(r => { if (r.collegeName) s.add(r.collegeName) })
    return [...s].sort()
  }, [records])

  const years = useMemo(() => {
    const s = new Set()
    records.forEach(r => { if (r.placementYear) s.add(r.placementYear) })
    return [...s].sort((a, b) => b - a)
  }, [records])

  const sectors = useMemo(() => {
    const s = new Set()
    records.forEach(r => { if (r.sector) s.add(r.sector) })
    return [...s].sort()
  }, [records])

  const programs = useMemo(() => {
    const s = new Set()
    records.forEach(r => { if (r.program) s.add(r.program) })
    return [...s].sort()
  }, [records])

  const cycles = useMemo(() => {
    const s = new Set()
    records.forEach(r => { if (r.placementCycle) s.add(r.placementCycle) })
    return [...s].sort()
  }, [records])

  return {
    records: enriched,
    loading,
    error,
    colleges,
    years,
    sectors,
    programs,
    cycles,
  }
}

// ── Client-side filter + search ───────────────────────────────────────────────
// Extracted so IntelPage can keep filter state without re-running the subscription.
export function filterIntelRecords(records, { search, college, year, cycle, sector, program, iiftFilter }) {
  const q = (search || '').toLowerCase().trim()

  return records.filter(r => {
    if (college && r.collegeName !== college) return false
    if (year    && r.placementYear !== Number(year)) return false
    if (cycle   && (r.placementCycle || '').toLowerCase() !== cycle.toLowerCase()) return false
    if (sector  && r.sector !== sector) return false
    if (program && r.program !== program) return false
    if (iiftFilter === 'gap'     && r._iiftStatus !== 'gap') return false
    if (iiftFilter === 'at_iift' && r._iiftStatus !== 'at_iift') return false
    if (q) {
      const haystack = [
        r.recruiterName, r.alias, r.sector, r.function,
        r.rolesMentioned, r.collegeName, r.program, r.compensation,
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

// ── Company aggregation for benchmark / card views ────────────────────────────
// Groups all records by normalised recruiterId, returns one entry per unique company.
export function aggregateByCompany(records) {
  const map = {}
  records.forEach(r => {
    const key = normalizeId(r.recruiterId || r.recruiterName)
    if (!map[key]) {
      map[key] = {
        _key:          key,
        recruiterName: r.recruiterName,
        alias:         r.alias,
        sector:        r.sector,
        _iiftStatus:   r._iiftStatus,
        appearances:   [],
      }
    }
    map[key].appearances.push(r)
    // Upgrade status: if any appearance is at_iift, company = at_iift
    if (r._iiftStatus === 'at_iift') map[key]._iiftStatus = 'at_iift'
    // Prefer non-empty sector
    if (!map[key].sector && r.sector) map[key].sector = r.sector
  })
  return Object.values(map).sort((a, b) =>
    a.recruiterName.localeCompare(b.recruiterName)
  )
}
