import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  writeBatch, serverTimestamp, query, orderBy, getDoc, setDoc, getDocs
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

    if (changeData.type === 'import' && Array.isArray(changeData.rows)) {
      const importId = `${Date.now()}_${user.uid}`
      const chunks = chunkRowsBySize(changeData.rows)

      for (let i = 0; i < chunks.length; i += 1) {
        await setDoc(doc(db, 'config', `importPayload_${importId}_${i}`), {
          importId,
          idx: i,
          rows: chunks[i],
          createdAt: serverTimestamp(),
          proposedBy: user.uid,
          type: 'importPayload',
        })
      }

      await addDoc(collection(db, 'pendingChanges'), {
        type: 'import',
        rowCount: changeData.rows.length,
        headers: Array.isArray(changeData.headers) ? changeData.headers : [],
        updateSchema: !!changeData.updateSchema,
        replaceExisting: !!changeData.replaceExisting,
        importId,
        chunkCount: chunks.length,
        proposedBy: user.uid,
        proposedByName: user.displayName,
        proposedAt: serverTimestamp(),
        status: 'pending',
        applied: false,
      })
      return
    }

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

    if (change?.type === 'import' && change.importId && change.chunkCount) {
      await cleanupImportPayload(change.importId, change.chunkCount)
    }

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

    if (change.type === 'import') {
      await approveImport(changeId, change, note)
      appendChange({ ...change, reviewedByName: user.displayName, note })
      return
    }

    const batch = writeBatch(db)
    const schemaRef = doc(db, 'config', 'columnSchema')

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

      if (Array.isArray(change.headers) && change.headers.length) {
        const schemaSnap = await getDoc(schemaRef)
        if (!schemaSnap.exists() || change.updateSchema === true) {
          batch.set(schemaRef, {
            headers: change.headers,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName,
            source: 'import',
          }, { merge: true })
        }
      }
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

  const approveImport = async (changeId, change, note) => {
    const schemaRef = doc(db, 'config', 'columnSchema')
    let rows = []

    if (change.importId && change.chunkCount) {
      for (let i = 0; i < change.chunkCount; i += 1) {
        const snap = await getDoc(doc(db, 'config', `importPayload_${change.importId}_${i}`))
        if (snap.exists()) {
          const data = snap.data()
          if (Array.isArray(data.rows)) rows = rows.concat(data.rows)
        }
      }
    } else {
      rows = Array.isArray(change.rows) ? change.rows : []
    }

    if (!rows.length) throw new Error('Import payload is empty or missing')

    if (change.replaceExisting) {
      const allStudents = await getDocs(collection(db, 'students'))
      const ids = allStudents.docs.map(d => d.id)
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db)
        ids.slice(i, i + 400).forEach(id => batch.delete(doc(db, 'students', id)))
        await batch.commit()
      }
    }

    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400)
      const batch = writeBatch(db)
      chunk.forEach(row => {
        const ref = doc(collection(db, 'students'))
        batch.set(ref, { ...row, _placed: false, _placedCompany: null, _placedAt: null, _createdAt: serverTimestamp() })
      })
      await batch.commit()
    }

    if (Array.isArray(change.headers) && change.headers.length) {
      const schemaSnap = await getDoc(schemaRef)
      if (!schemaSnap.exists() || change.updateSchema === true) {
        await setDoc(schemaRef, {
          headers: change.headers,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          updatedByName: user.displayName,
          source: 'import',
        }, { merge: true })
      }
    }

    await updateDoc(doc(db, 'pendingChanges', changeId), {
      status: 'approved',
      reviewedBy: user.uid,
      reviewedByName: user.displayName,
      reviewedAt: serverTimestamp(),
      applied: true,
      note,
    })

    await addDoc(collection(db, 'auditLog'), {
      type: change.type,
      changeId,
      description: describeChange(change),
      proposedBy: change.proposedBy,
      proposedByName: change.proposedByName,
      approvedBy: user.uid,
      approvedByName: user.displayName,
      appliedAt: serverTimestamp(),
    })

    if (change.importId && change.chunkCount) {
      await cleanupImportPayload(change.importId, change.chunkCount)
    }
  }

  const cleanupImportPayload = async (importId, chunkCount) => {
    for (let i = 0; i < chunkCount; i += 350) {
      const batch = writeBatch(db)
      for (let j = i; j < Math.min(i + 350, chunkCount); j += 1) {
        batch.delete(doc(db, 'config', `importPayload_${importId}_${j}`))
      }
      await batch.commit()
    }
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
    case 'import':   return `${c.replaceExisting ? 'Replaced and imported' : 'Imported'} ${c.rowCount} student${c.rowCount !== 1 ? 's' : ''}${c.headers?.length ? ` (${c.headers.length} columns)` : ''}`
    case 'clearAll': return `Cleared all ${c.studentCount} students`
    default:         return `Action: ${c.type}`
  }
}

function chunkRowsBySize(rows, maxBytes = 700000) {
  const chunks = []
  let current = []
  let size = 0

  rows.forEach(row => {
    const rowSize = JSON.stringify(row).length + 2
    if (current.length > 0 && size + rowSize > maxBytes) {
      chunks.push(current)
      current = [row]
      size = rowSize
    } else {
      current.push(row)
      size += rowSize
    }
  })

  if (current.length) chunks.push(current)
  return chunks
}
