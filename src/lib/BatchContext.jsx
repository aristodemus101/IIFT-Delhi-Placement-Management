import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase'
import { cohortLabel, CAMPUSES, PROGRAMMES } from './batch'

const YEAR_KEY      = 'placement.selectedYearCode'
const PROGRAMME_KEY = 'placement.selectedProgramme'
const CAMPUSES_KEY  = 'placement.selectedCampuses'
// Last-used season key — persisted so season-aware pages open on the right cycle.
const SEASON_KEY = 'placement.lastSeason'

const BatchContext = createContext(null)

export function BatchProvider({ children }) {
  const [batches, setBatches]               = useState([])
  const [batchesLoading, setBatchesLoading] = useState(true)

  // Scope filters — season is NOT a scope dimension
  const [selectedYearCode, setSelectedYearCodeRaw] = useState(
    () => localStorage.getItem(YEAR_KEY) || ''
  )
  const [selectedProgramme, setSelectedProgrammeRaw] = useState(
    () => localStorage.getItem(PROGRAMME_KEY) || ''
  )
  const [selectedCampuses, setSelectedCampusesRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CAMPUSES_KEY)) || [] }
    catch { return [] }
  })

  // Last-used season — a display preference for season-aware pages, not a scope filter
  const [lastSeason, setLastSeasonRaw] = useState(
    () => localStorage.getItem(SEASON_KEY) || 'final'
  )

  // Auth-gated Firestore listener
  useEffect(() => {
    let unsubSnap = null
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsubSnap) { unsubSnap(); unsubSnap = null }
      if (!u) { setBatches([]); setBatchesLoading(false); return }
      // No orderBy — avoids requiring a Firestore index on a tiny collection.
      // Sort client-side after fetch.
      unsubSnap = onSnapshot(collection(db, 'batches'), snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        docs.sort((a, b) => (b.year || 0) - (a.year || 0))
        setBatches(docs)
        setBatchesLoading(false)
      }, () => setBatchesLoading(false))
    })
    return () => { unsubAuth(); if (unsubSnap) unsubSnap() }
  }, [])

  const setSelectedYearCode = (yearCode) => {
    setSelectedYearCodeRaw(yearCode)
    localStorage.setItem(YEAR_KEY, yearCode)
  }
  const setSelectedProgramme = (p) => {
    setSelectedProgrammeRaw(p)
    localStorage.setItem(PROGRAMME_KEY, p)
  }
  const setSelectedCampuses = (arr) => {
    setSelectedCampusesRaw(arr)
    localStorage.setItem(CAMPUSES_KEY, JSON.stringify(arr))
  }
  const setLastSeason = (s) => {
    setLastSeasonRaw(s)
    localStorage.setItem(SEASON_KEY, s)
  }

  // All active batches — NOT filtered by season
  const activeBatches  = useMemo(() => batches.filter(b => b.status === 'active'),   [batches])
  const archivedBatches = useMemo(() => batches.filter(b => b.status === 'archived'), [batches])

  const availableYears = useMemo(() => {
    const seen = new Set()
    return activeBatches
      .map(b => b.year ? String(b.year).slice(-2) : '')
      .filter(Boolean)
      .filter(yearCode => { if (seen.has(yearCode)) return false; seen.add(yearCode); return true })
  }, [activeBatches])

  const availableCampuses = useMemo(() => {
    const set = new Set(activeBatches.map(b => b.campus).filter(Boolean))
    return CAMPUSES.filter(c => set.has(c))
  }, [activeBatches])

  const availableProgrammes = useMemo(() => {
    const set = new Set(activeBatches.map(b => b.programme).filter(Boolean))
    return PROGRAMMES.filter(p => set.has(p))
  }, [activeBatches])

  // Scoped cohorts: year / campus / programme only — no season filter
  const scopedCohorts = useMemo(() => {
    return activeBatches
      .filter(b => {
        const yearCode  = b.year ? String(b.year).slice(-2) : ''
        const yearOk    = !selectedYearCode || yearCode === selectedYearCode
        const campusOk  = selectedCampuses.length === 0 || selectedCampuses.includes(b.campus)
        const progOk    = !selectedProgramme || b.programme === selectedProgramme
        return yearOk && campusOk && progOk
      })
      .map(b => b.id)
  }, [activeBatches, selectedYearCode, selectedCampuses, selectedProgramme])

  // Single-cohort alias (first scoped cohort) — for schema, remapper, import
  const selectedCohort = scopedCohorts[0] ?? null

  // activeCycle for a given cohort id — falls back to 'final'
  const getCohortCycle = useMemo(() => {
    const map = {}
    batches.forEach(b => { map[b.id] = b.activeCycle || 'final' })
    return (cohortId) => map[cohortId] || 'final'
  }, [batches])

  // The active cycle of the currently selected (first scoped) cohort
  const selectedCohortCycle = selectedCohort ? getCohortCycle(selectedCohort) : 'final'

  // Update activeCycle on a cohort doc
  const setCohortCycle = async (cohortId, cycle) => {
    await updateDoc(doc(db, 'batches', cohortId), {
      activeCycle: cycle,
      updatedAt: serverTimestamp(),
    })
  }

  const value = useMemo(() => ({
    batches, activeBatches, archivedBatches, batchesLoading,
    availableCampuses, availableProgrammes, availableYears,

    // Scope filters
    selectedYearCode, setSelectedYearCode,
    selectedProgramme, setSelectedProgramme,
    selectedCampuses,  setSelectedCampuses,
    scopedCohorts,

    // Single-cohort alias
    selectedCohort,

    // activeCycle helpers
    getCohortCycle,
    selectedCohortCycle,
    setCohortCycle,

    // Last-used season preference (for Dashboard / Placed / Analytics default)
    lastSeason, setLastSeason,

    options: activeBatches.map(b => ({
      value: b.id,
      label: b.label || cohortLabel(b.id),
      short: b.id,
      accent: 'var(--accent)',
    })),
  }), [
    batches, activeBatches, archivedBatches, batchesLoading,
    availableCampuses, availableProgrammes, availableYears,
    selectedYearCode, selectedProgramme, selectedCampuses, scopedCohorts,
    selectedCohort, getCohortCycle, selectedCohortCycle,
    lastSeason,
  ])

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>
}

export function useBatch() {
  const ctx = useContext(BatchContext)
  if (!ctx) throw new Error('useBatch must be used within BatchProvider')
  return ctx
}
