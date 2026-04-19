import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  writeBatch, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './AuthContext'
import { useSheetsSync } from './SheetsSyncContext'

const PendingChangesContext = createContext(null)

export function PendingChangesProvider({ children }) {
  const { user, isAdmin } = useAuth()
  const { appendChange } = useSheetsSync()
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setChanges([]); setLoading(false); return }
    const q = query(collection(db, 'pendingChanges'), orderBy('proposedAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setChanges(snap.docs.map(d => ({ _id: d.id, ...d.data() }))); setLoading(false) },
      err => { console.error('pendingChanges error:', err); setLoading(false) }
    )
    return unsub
  }, [user])

  const pendingCount = changes.filter(c => c.status === 'pending').length

  // Create a proposal — any admin action goes here first
  const propose = async (changeData) => {
    if (!isAdmin) throw new Error('Not authorized')
    await addDoc(collection(db, 'pendingChanges'), {
      ...changeData,
      proposedBy: user.uid,
      proposedByName: user.displayName,
      proposedAt: serverTimestamp(),
      status: 'pending',
      applied: false,
    })
  }

  // Reject a pending change
  const reject = async (changeId, note = '') => {
    if (!isAdmin) throw new Error('Not authorized')
    const change = changes.find(c => c._id === changeId)
    if (change?.proposedBy === user.uid) throw new Error('Cannot review your own proposal')
    await updateDoc(doc(db, 'pendingChanges', changeId), {
      status: 'rejected',
      reviewedBy: user.uid,
      reviewedByName: user.displayName,
      reviewedAt: serverTimestamp(),
      note,
    })
  }

  // Approve and atomically apply the change in one batch write
  const approve = async (changeId, note = '') => {
    if (!isAdmin) throw new Error('Not authorized')
    const change = changes.find(c => c._id === changeId)
    if (!change) throw new Error('Change not found')
    if (change.proposedBy === user.uid) throw new Error('Cannot approve your own proposal')
    if (change.applied) throw new Error('Already applied')

    const batch = writeBatch(db)

    // Apply the actual change to students
    if (change.type === 'place') {
      batch.update(doc(db, 'students', change.studentId), {
        _placed: true,
        _placedCompany: change.company,
        _placedAt: new Date().toISOString(),
      })
    } else if (change.type === 'unplace') {
      batch.update(doc(db, 'students', change.studentId), {
        _placed: false,
        _placedCompany: null,
        _placedAt: null,
      })
    } else if (change.type === 'delete') {
      batch.delete(doc(db, 'students', change.studentId))
    } else if (change.type === 'import') {
      change.rows.forEach(row => {
        const ref = doc(collection(db, 'students'))
        batch.set(ref, { ...row, _placed: false, _placedCompany: null, _placedAt: null, _createdAt: serverTimestamp() })
      })
    } else if (change.type === 'clearAll') {
      ;(change.studentIds || []).forEach(id => batch.delete(doc(db, 'students', id)))
    }

    // Mark pendingChange as approved + applied
    batch.update(doc(db, 'pendingChanges', changeId), {
      status: 'approved',
      reviewedBy: user.uid,
      reviewedByName: user.displayName,
      reviewedAt: serverTimestamp(),
      applied: true,
      note,
    })

    // Append-only audit log entry
    batch.set(doc(collection(db, 'auditLog')), {
      type: change.type,
      changeId,
      description: describeChange(change),
      proposedBy: change.proposedBy,
      proposedByName: change.proposedByName,
      approvedBy: user.uid,
      approvedByName: user.displayName,
      appliedAt: serverTimestamp(),
    })

    await batch.commit()

    // Auto-append to Google Sheets change log (silently, non-blocking)
    appendChange({ ...change, reviewedByName: user.displayName, note })
  }

  return (
    <PendingChangesContext.Provider value={{ changes, loading, pendingCount, propose, approve, reject }}>
      {children}
    </PendingChangesContext.Provider>
  )
}

export const usePendingChanges = () => useContext(PendingChangesContext)

function describeChange(c) {
  switch (c.type) {
    case 'place':    return `Placed ${c.studentName} (${c.studentRoll}) at ${c.company}`
    case 'unplace':  return `Unplaced ${c.studentName} (${c.studentRoll}) from ${c.currentCompany}`
    case 'delete':   return `Deleted ${c.studentName} (${c.studentRoll})`
    case 'import':   return `Imported ${c.rowCount} student${c.rowCount !== 1 ? 's' : ''}`
    case 'clearAll': return `Cleared all ${c.studentCount} students`
    default:         return `Action: ${c.type}`
  }
}
