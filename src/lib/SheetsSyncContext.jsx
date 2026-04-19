import React, { createContext, useContext, useState, useCallback } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from './firebase'
import { getOrCreateSpreadsheet, appendChangeLog, syncFullSnapshot } from './sheetsSync'

const SheetsSyncContext = createContext(null)

export function SheetsSyncProvider({ children }) {
  const [token, setToken]       = useState(null)
  const [sheetId, setSheetId]   = useState(() => localStorage.getItem('placementos_sheet_id'))
  const [lastSync, setLastSync] = useState(() => {
    const s = localStorage.getItem('placementos_last_sync')
    return s ? new Date(s) : null
  })
  const [syncing, setSyncing] = useState(false)

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

  return (
    <SheetsSyncContext.Provider value={{
      connected: !!token,
      sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null,
      lastSync,
      syncing,
      authorize,
      appendChange,
      syncNow,
    }}>
      {children}
    </SheetsSyncContext.Provider>
  )
}

export const useSheetsSync = () => useContext(SheetsSyncContext)
