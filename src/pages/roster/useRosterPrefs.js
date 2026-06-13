import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const DEFAULT_FILTERS = { catMin: '', wxMin: '', category: '', gender: '', pwdOnly: false }

export { DEFAULT_FILTERS }

export function useRosterPrefs({ user, allColumnDefs, selectedCohort }) {
  const [sortCol, setSortCol]         = useState('name')
  const [sortDir, setSortDir]         = useState(1)
  const [filters, setFilters]         = useState(DEFAULT_FILTERS)
  const [visibleCols, setVisibleCols] = useState([])
  const [prefsReady, setPrefsReady]   = useState(false)

  // Reset visible cols when column schema changes
  useEffect(() => {
    setPrefsReady(false)
    setVisibleCols(prev => {
      const allKeys = allColumnDefs.map(c => c.key)
      if (!allKeys.length) return []
      if (!prev.length) return allKeys
      const prevSet = new Set(prev)
      const filtered = allKeys.filter(k => prevSet.has(k))
      return filtered.length ? filtered : allKeys
    })
  }, [allColumnDefs])

  // Load prefs from Firestore on mount / cohort change
  useEffect(() => {
    if (!user?.uid || !allColumnDefs.length) { setPrefsReady(true); return }

    let cancelled = false
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'userPrefs', user.uid))
        if (!snap.exists() || cancelled) { if (!cancelled) setPrefsReady(true); return }

        const rosterRoot = snap.data()?.roster || {}
        const roster = rosterRoot[selectedCohort] || rosterRoot

        if (typeof roster.sortCol === 'string' && roster.sortCol) setSortCol(roster.sortCol)
        if (roster.sortDir === 1 || roster.sortDir === -1) setSortDir(roster.sortDir)
        if (roster.filters && typeof roster.filters === 'object')
          setFilters({ ...DEFAULT_FILTERS, ...roster.filters })
        else
          setFilters(DEFAULT_FILTERS)

        if (Array.isArray(roster.visibleCols) && roster.visibleCols.length) {
          const valid = new Set(allColumnDefs.map(c => c.key))
          const next = roster.visibleCols.filter(k => valid.has(k))
          if (next.length) setVisibleCols(next)
        }
      } catch (e) {
        console.error('Failed to load roster preferences:', e)
      } finally {
        if (!cancelled) setPrefsReady(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.uid, allColumnDefs, selectedCohort])

  // Debounced save back to Firestore
  useEffect(() => {
    if (!user?.uid || !prefsReady || !visibleCols.length) return
    const t = setTimeout(() => {
      setDoc(doc(db, 'userPrefs', user.uid), {
        roster: {
          [selectedCohort]: { sortCol, sortDir, visibleCols, filters, updatedAt: serverTimestamp() },
        },
      }, { merge: true }).catch(e => console.error('Failed to save roster preferences:', e))
    }, 250)
    return () => clearTimeout(t)
  }, [user?.uid, prefsReady, sortCol, sortDir, visibleCols, filters, selectedCohort])

  const toggleColumn = key => {
    setVisibleCols(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev
        return prev.filter(k => k !== key)
      }
      const nextSet = new Set([...prev, key])
      return allColumnDefs.filter(c => nextSet.has(c.key)).map(c => c.key)
    })
  }

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const clearFilters = (setSearchTerm) => { setFilters(DEFAULT_FILTERS); setSearchTerm?.('') }

  return {
    sortCol, setSortCol,
    sortDir, setSortDir,
    filters, setF, clearFilters,
    visibleCols, setVisibleCols, toggleColumn,
    prefsReady,
  }
}
