// useIntel: live Firestore subscription to /intel collection.
// Provides search, filter, and IIFT benchmark join (fuzzy, last 2 years).
//
// Benchmark logic:
//   - "At IIFT"   : recruiterName/alias fuzzy-matches a company in IIFT placed students
//                   within the last 2 calendar years (final or summer).
//   - "IIFT Gap"  : appeared at a peer college but NOT at IIFT in the last 2 years.
//   - "Both"      : at IIFT and at ≥1 peer college in the same window.

import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from './firebase'
import { fuzzyMatch, normalizeId } from './intel'

export function useIntel({ students = [] } = {}) {
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    // Exclude soft-deleted docs. Firestore inequality filter requires index,
    // so we filter _deleted !== true via a where clause.
    const q = query(
      collection(db, 'intel'),
      where('_deleted', '!=', true),
      orderBy('_deleted'),
      orderBy('recruiterName'),
    )
    const unsub = onSnapshot(
      q,
      snap => {
        setRecords(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
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

  // ── IIFT placed company index (last 2 years, fuzzy-normalised) ────────────
  const iiftCompanySet = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const cutoff = currentYear - 2
    const set = new Set()
    students.forEach(s => {
      const finalYear = s._placement_final?.placedAtIso
        ? new Date(s._placement_final.placedAtIso).getFullYear()
        : null
      const summerYear = s._placement_summer?.placedAtIso
        ? new Date(s._placement_summer.placedAtIso).getFullYear()
        : null

      if (s._placed_final && s._placement_final?.company && finalYear >= cutoff) {
        set.add(normalizeId(s._placement_final.company))
      }
      if (s._placed_summer && s._placement_summer?.company && summerYear >= cutoff) {
        set.add(normalizeId(s._placement_summer.company))
      }
    })
    return set
  }, [students])

  // ── Attach IIFT status to each intel record ───────────────────────────────
  const enriched = useMemo(() => {
    return records.map(r => {
      const matchesIift = iiftCompanySet.size > 0 && [...iiftCompanySet].some(
        iiftName => fuzzyMatch(r.recruiterName, iiftName) || fuzzyMatch(r.alias, iiftName)
      )
      return { ...r, _iiftStatus: matchesIift ? 'at_iift' : 'gap' }
    })
  }, [records, iiftCompanySet])

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

  return {
    records: enriched,
    loading,
    error,
    colleges,
    years,
    sectors,
    programs,
  }
}

// ── Client-side filter + search ───────────────────────────────────────────────
// Extracted so IntelPage can keep filter state without re-running the subscription.
export function filterIntelRecords(records, { search, college, year, cycle, sector, program, iiftFilter }) {
  const q = (search || '').toLowerCase().trim()

  return records.filter(r => {
    if (college && r.collegeName !== college) return false
    if (year    && r.placementYear !== Number(year)) return false
    if (cycle   && r.placementCycle !== cycle) return false
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
