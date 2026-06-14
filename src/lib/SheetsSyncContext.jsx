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

  // Subscribe to playground URL from Firestore so all users see it live
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'playground'), snap => {
      if (snap.exists()) setPlaygroundUrl(snap.data().sheetUrl || null)
    }, () => {})
    return unsub
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

  // pushToPlayground — now uses Cloud Function + service account (no OAuth needed)
  // rows/headers are passed in from the caller (filtered roster view)
  const pushToPlayground = useCallback(async ({ rows, headers, label }) => {
    setPlaygroundPushing(true)
    try {
      const result = await callPushFilteredToSheet({ rows, headers, label })
      const { tabName, sheetUrl, rowCount } = result.data
      await setDoc(doc(db, 'config', 'playground'), {
        sheetUrl,
        tabName,
        pushedAt: new Date().toISOString(),
        count: rowCount,
      })
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
