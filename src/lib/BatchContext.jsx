import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { BATCH_OPTIONS, BATCH_VALUES, normalizeBatch } from './batch'

const STORAGE_KEY = 'placement.selectedBatch'

const BatchContext = createContext(null)

export function BatchProvider({ children }) {
  const [selectedBatch, setSelectedBatch] = useState(BATCH_VALUES.FINAL)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setSelectedBatch(normalizeBatch(stored))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, normalizeBatch(selectedBatch))
    document.documentElement.setAttribute('data-batch', normalizeBatch(selectedBatch))
  }, [selectedBatch])

  const value = useMemo(() => ({
    selectedBatch,
    setSelectedBatch: (next) => setSelectedBatch(normalizeBatch(next)),
    options: BATCH_OPTIONS,
  }), [selectedBatch])

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>
}

export function useBatch() {
  const ctx = useContext(BatchContext)
  if (!ctx) throw new Error('useBatch must be used within BatchProvider')
  return ctx
}
