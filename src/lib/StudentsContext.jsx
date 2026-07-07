import React, { createContext, useContext } from 'react'
import { useStudents } from './useStudents'

const StudentsContext = createContext(null)

// Single Firestore listener for the entire /students collection.
// Wrap this around the authenticated shell once — all pages share the same snapshot.
export function StudentsProvider({ children }) {
  const value = useStudents()
  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>
}

export function useStudentsContext() {
  const ctx = useContext(StudentsContext)
  if (!ctx) throw new Error('useStudentsContext must be used inside StudentsProvider')
  return ctx
}
