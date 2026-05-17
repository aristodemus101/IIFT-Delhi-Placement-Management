import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db, auth } from './firebase'
import { cohortLabel, cohortCampus, cohortProgramme, CAMPUSES, PROGRAMMES } from './batch'

const SEASON_KEY    = 'placement.selectedSeason'
const PROGRAMME_KEY = 'placement.selectedProgramme'  // '' = All
const CAMPUSES_KEY  = 'placement.selectedCampuses'   // JSON array, [] = All

const BatchContext = createContext(null)

export function BatchProvider({ children }) {
  const [batches, setBatches]           = useState([])
  const [batchesLoading, setBatchesLoading] = useState(true)

  const [selectedSeason, setSelectedSeasonRaw] = useState(
    () => localStorage.getItem(SEASON_KEY) || 'summer'
  )
  const [selectedProgramme, setSelectedProgrammeRaw] = useState(
    () => localStorage.getItem(PROGRAMME_KEY) || ''
  )
  const [selectedCampuses, setSelectedCampusesRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CAMPUSES_KEY)) || [] }
    catch { return [] }
  })

  // Auth-gated Firestore listener
  useEffect(() => {
    let unsubSnap = null
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsubSnap) { unsubSnap(); unsubSnap = null }
      if (!u) { setBatches([]); setBatchesLoading(false); return }
      const q = query(collection(db, 'batches'), orderBy('year', 'desc'))
      unsubSnap = onSnapshot(q, snap => {
        setBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setBatchesLoading(false)
      }, () => setBatchesLoading(false))
    })
    return () => { unsubAuth(); if (unsubSnap) unsubSnap() }
  }, [])

  const setSelectedSeason = (s) => {
    setSelectedSeasonRaw(s)
    localStorage.setItem(SEASON_KEY, s)
  }

  const setSelectedProgramme = (p) => {
    setSelectedProgrammeRaw(p)
    localStorage.setItem(PROGRAMME_KEY, p)
  }

  const setSelectedCampuses = (arr) => {
    setSelectedCampusesRaw(arr)
    localStorage.setItem(CAMPUSES_KEY, JSON.stringify(arr))
  }

  const activeBatches  = useMemo(() => batches.filter(b => b.status === 'active'),   [batches])
  const archivedBatches = useMemo(() => batches.filter(b => b.status === 'archived'), [batches])

  // Campuses that actually have ≥1 active cohort in the DB
  const availableCampuses = useMemo(() => {
    const set = new Set(activeBatches.map(b => b.campus || cohortCampus(b.id)).filter(Boolean))
    return CAMPUSES.filter(c => set.has(c))
  }, [activeBatches])

  // Programmes that actually have ≥1 active cohort in the DB
  const availableProgrammes = useMemo(() => {
    const set = new Set(activeBatches.map(b => b.programme || cohortProgramme(b.id)).filter(Boolean))
    return PROGRAMMES.filter(p => set.has(p))
  }, [activeBatches])

  // The cohort IDs that match current programme + campus filters
  const scopedCohorts = useMemo(() => {
    return activeBatches
      .filter(b => {
        const campus    = b.campus    || cohortCampus(b.id)
        const programme = b.programme || cohortProgramme(b.id)
        const campusOk  = selectedCampuses.length === 0 || selectedCampuses.includes(campus)
        const progOk    = !selectedProgramme || programme === selectedProgramme
        return campusOk && progOk
      })
      .map(b => b.id)
  }, [activeBatches, selectedCampuses, selectedProgramme])

  // Single-cohort alias: first scoped cohort (for pages that need exactly one — schema, remapper, import)
  const selectedCohort = scopedCohorts[0] ?? null

  const value = useMemo(() => ({
    batches, activeBatches, archivedBatches, batchesLoading,
    availableCampuses, availableProgrammes,

    // Multi-cohort filter state
    selectedProgramme, setSelectedProgramme,
    selectedCampuses,  setSelectedCampuses,
    scopedCohorts,

    // Season
    selectedSeason, setSelectedSeason,

    // Single-cohort alias (first of scopedCohorts) — for schema, import, remapper
    selectedCohort,

    // Legacy compat aliases
    selectedBatch:    selectedCohort,
    setSelectedBatch: () => {},
    options: activeBatches.map(b => ({
      value: b.id,
      label: b.label || cohortLabel(b.id),
      short: b.id,
      accent: 'var(--accent)',
    })),
  }), [
    batches, activeBatches, archivedBatches, batchesLoading,
    availableCampuses, availableProgrammes,
    selectedProgramme, selectedCampuses, scopedCohorts,
    selectedSeason, selectedCohort,
  ])

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>
}

export function useBatch() {
  const ctx = useContext(BatchContext)
  if (!ctx) throw new Error('useBatch must be used within BatchProvider')
  return ctx
}
