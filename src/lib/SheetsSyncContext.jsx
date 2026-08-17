import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { auth, db, callPushFilteredToSheet } from './firebase'
import { getOrCreateSpreadsheet, appendChangeLog, syncFullSnapshot, createOpportunityTracker, addTrackerTab } from './sheetsSync'

const SheetsSyncContext = createContext(null)

export function SheetsSyncProvider({ children }) {
  const [token, setToken]           = useState(null)
  const [sheetId, setSheetId]       = useState(() => localStorage.getItem('placementos_sheet_id'))
  const [lastSync, setLastSync]     = useState(() => {
    const s = localStorage.getItem('placementos_last_sync')
    return s ? new Date(s) : null
  })
  const [syncing, setSyncing]       = useState(false)
  const [playgroundUrl, setPlaygroundUrl] = useState(null)
  const [playgroundPushing, setPlaygroundPushing] = useState(false)
  // Per-year playground URLs — keyed by yearCode (e.g. '27', '28')
  const [playgroundUrls, setPlaygroundUrls] = useState({})

  // Subscribe to all per-year playground docs so all users see live URLs
  useEffect(() => {
    const years = ['27', '28']
    const unsubs = years.map(yr =>
      onSnapshot(doc(db, 'config', `playground_${yr}`), snap => {
        if (snap.exists()) {
          setPlaygroundUrls(prev => ({ ...prev, [yr]: snap.data().sheetUrl || null }))
        }
      }, () => {})
    )
    return () => unsubs.forEach(u => u())
  }, [])

  // Pop a Google consent dialog requesting Sheets + Drive.file scopes.
  // This is separate from the main Firebase login so only the master admin needs it.
  const authorize = useCallback(async () => {
    const provider = new GoogleAuthProvider()
    provider.addScope('https://www.googleapis.com/auth/spreadsheets')
    provider.addScope('https://www.googleapis.com/auth/drive.file')
    provider.setCustomParameters({ prompt: 'select_account' })

    const result   = await signInWithPopup(auth, provider)
    const cred     = GoogleAuthProvider.credentialFromResult(result)
    const newToken = cred.accessToken

    const id = await getOrCreateSpreadsheet(newToken)
    setToken(newToken)
    setSheetId(id)
    localStorage.setItem('placementos_sheet_id', id)
    return { token: newToken, id }
  }, [])

  // Called automatically after every approved change
  const appendChange = useCallback(async (change) => {
    if (!token || !sheetId) return
    try {
      await appendChangeLog(token, sheetId, change)
    } catch {
      setToken(null) // token expired — force re-auth on next attempt
    }
  }, [token, sheetId])

  // Called manually from Admin page — full snapshot of all students
  const syncNow = useCallback(async (students) => {
    if (!token || !sheetId) throw new Error('Not connected to Google Sheets')
    setSyncing(true)
    try {
      const result = await syncFullSnapshot(token, sheetId, students)
      const now = new Date()
      setLastSync(now)
      localStorage.setItem('placementos_last_sync', now.toISOString())
      return result
    } finally {
      setSyncing(false)
    }
  }, [token, sheetId])

  // pushToPlayground — uses Cloud Function + service account (no OAuth needed)
  // yearCode: '27' | '28' — selects the right playground sheet
  const pushToPlayground = useCallback(async ({ rows, headers, label, yearCode }) => {
    setPlaygroundPushing(true)
    try {
      const result = await callPushFilteredToSheet({ rows, headers, label, yearCode })
      const { tabName, sheetUrl, rowCount, yearCode: resolvedYear } = result.data
      const yr = resolvedYear || yearCode || '27'
      await setDoc(doc(db, 'config', `playground_${yr}`), {
        sheetUrl,
        tabName,
        pushedAt: new Date().toISOString(),
        count: rowCount,
        yearCode: yr,
      })
      setPlaygroundUrls(prev => ({ ...prev, [yr]: sheetUrl }))
      setPlaygroundUrl(sheetUrl)
      return { sheetUrl, tabName, count: rowCount }
    } finally {
      setPlaygroundPushing(false)
    }
  }, [])

  // Creates a new Google Sheet for an opportunity with one tracker tab.
  // stageConfig: { sheetTitle: 'EOI', colHeader: 'Filled EOI' }
  // students: array of student objects
  const createTracker = useCallback(async (oppTitle, students, stageConfig) => {
    if (!token) throw new Error('Not connected to Google Sheets — reconnect in Team Access first.')
    return createOpportunityTracker(token, oppTitle, students, stageConfig)
  }, [token])

  // Adds a new tab to an existing tracker sheet (for subsequent stages).
  const addStageTab = useCallback(async (spreadsheetId, stageConfig, students) => {
    if (!token) throw new Error('Not connected to Google Sheets — reconnect in Team Access first.')
    return addTrackerTab(token, spreadsheetId, stageConfig, students)
  }, [token])

  return (
    <SheetsSyncContext.Provider value={{
      connected: !!token, // still used for change-log sheet connection
      sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null,
      lastSync,
      syncing,
      playgroundUrl,
      playgroundUrls, // per-year: { '27': url, '28': url }
      playgroundPushing,
      authorize,
      appendChange,
      syncNow,
      pushToPlayground,
      createTracker,
      addStageTab,
    }}>
      {children}
    </SheetsSyncContext.Provider>
  )
}

export const useSheetsSync = () => useContext(SheetsSyncContext)
