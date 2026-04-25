import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  writeBatch, serverTimestamp, query, orderBy, getDoc, setDoc, getDocs
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './AuthContext'
import { useSheetsSync } from './SheetsSyncContext'
import { normalizeBatch, schemaDocIdForBatch } from './batch'

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

    if (changeData.type === 'clearAll') {
      if (!Array.isArray(changeData.studentIds) || !changeData.studentIds.length || !changeData.studentCount) {
        throw new Error('No students available to clear')
      }
    }

    if (changeData.type === 'place' || changeData.type === 'unplace' || changeData.type === 'delete') {
      if (!changeData.studentId) throw new Error('Student no longer exists')
    }

    if (changeData.type === 'import' && Array.isArray(changeData.rows)) {
      if (!changeData.rows.length) throw new Error('Import file has no rows')
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
        batch: changeData.batch || 'final',
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
    if (!change) throw new Error('Change not found')
    if (change.status !== 'pending') throw new Error('Only pending changes can be reviewed')
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
    if (change.status !== 'pending') throw new Error('Only pending changes can be reviewed')
    if (change.proposedBy === user.uid) throw new Error('Cannot approve your own proposal')
    if (change.applied) throw new Error('Already applied')

    if (change.type === 'import') {
      await approveImport(changeId, change, note)
      appendChange({ ...change, reviewedByName: user.displayName, note })
      return
    }

    const batch = writeBatch(db)
    const schemaRef = doc(db, 'config', schemaDocIdForBatch(normalizeBatch(change.batch)))

    // Apply the actual change to students
    if (change.type === 'place') {
      const snap = await getDoc(doc(db, 'students', change.studentId))
      if (!snap.exists()) throw new Error('Student no longer exists')
      const placement = normalizePlacementDetails(change)
      batch.update(doc(db, 'students', change.studentId), {
        _placed: true,
        _placedCompany: placement.company || change.company || null,
        _placedAt: placement.placedAtIso || new Date().toISOString(),
        _placement: placement,
      })
    } else if (change.type === 'unplace') {
      const snap = await getDoc(doc(db, 'students', change.studentId))
      if (!snap.exists()) throw new Error('Student no longer exists')
      batch.update(doc(db, 'students', change.studentId), {
        _placed: false,
        _placedCompany: null,
        _placedAt: null,
        _placement: null,
      })
    } else if (change.type === 'delete') {
      const snap = await getDoc(doc(db, 'students', change.studentId))
      if (!snap.exists()) throw new Error('Student no longer exists')
      batch.delete(doc(db, 'students', change.studentId))
    } else if (change.type === 'import') {
      change.rows.forEach(row => {
        const ref = doc(collection(db, 'students'))
        batch.set(ref, { ...row, _batch: change.batch || 'final', _placed: false, _placedCompany: null, _placedAt: null, _createdAt: serverTimestamp() })
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
      if (!Array.isArray(change.studentIds) || !change.studentIds.length || !change.studentCount) {
        throw new Error('No students available to clear')
      }
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

  // Withdraw your own pending change
  const withdraw = async (changeId, note = '') => {
    if (!isAdmin) throw new Error('Not authorized')
    const change = changes.find(c => c._id === changeId)
    if (!change) throw new Error('Change not found')
    if (change.status !== 'pending') throw new Error('Only pending changes can be withdrawn')
    if (change.proposedBy !== user.uid) throw new Error('You can only withdraw your own proposals')

    if (change.type === 'import' && change.importId && change.chunkCount) {
      await cleanupImportPayload(change.importId, change.chunkCount)
    }

    await updateDoc(doc(db, 'pendingChanges', changeId), {
      status: 'withdrawn',
      withdrawnBy: user.uid,
      withdrawnByName: user.displayName,
      withdrawnAt: serverTimestamp(),
      note,
    })
  }

  const approveImport = async (changeId, change, note) => {
    const schemaRef = doc(db, 'config', schemaDocIdForBatch(normalizeBatch(change.batch)))
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
      const ids = allStudents.docs
        .filter(d => (d.data()?._batch || 'final') === (change.batch || 'final'))
        .map(d => d.id)
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
        batch.set(ref, { ...row, _batch: change.batch || 'final', _placed: false, _placedCompany: null, _placedAt: null, _createdAt: serverTimestamp() })
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
    <PendingChangesContext.Provider value={{ changes, loading, pendingCount, propose, approve, reject, withdraw }}>
      {children}
    </PendingChangesContext.Provider>
  )
}

export const usePendingChanges = () => useContext(PendingChangesContext)

function describeChange(c) {
  const batchPart = c.batch ? ` [${c.batch}]` : ''
  switch (c.type) {
    case 'place': {
      const company = c.placementDetails?.company || c.company || 'Unknown company'
      const via = c.placementDetails?.via ? ` via ${c.placementDetails.via}` : ''
      return `Placed${batchPart} ${c.studentName} (${c.studentRoll}) at ${company}${via}`
    }
    case 'unplace':  return `Unplaced${batchPart} ${c.studentName} (${c.studentRoll}) from ${c.currentCompany}`
    case 'delete':   return `Deleted${batchPart} ${c.studentName} (${c.studentRoll})`
    case 'import':   return `${c.replaceExisting ? 'Replaced and imported' : 'Imported'}${batchPart} ${c.rowCount} student${c.rowCount !== 1 ? 's' : ''}${c.headers?.length ? ` (${c.headers.length} columns)` : ''}`
    case 'clearAll': return `Cleared${batchPart} all ${c.studentCount} students`
    default:         return `Action: ${c.type}`
  }
}

function normalizePlacementDetails(change) {
  const raw = change?.placementDetails || {}
  const date = typeof raw.date === 'string' && raw.date.trim()
    ? raw.date.trim()
    : new Date().toISOString().slice(0, 10)
  const placedAtIso = typeof raw.placedAtIso === 'string' && raw.placedAtIso.trim()
    ? raw.placedAtIso.trim()
    : new Date(`${date}T00:00:00`).toISOString()

  return {
    date,
    company: String(raw.company || change?.company || '').trim(),
    role: String(raw.role || '').trim(),
    sector: String(raw.sector || '').trim(),
    package: String(raw.package || '').trim(),
    ctcNotes: String(raw.ctcNotes || '').trim(),
    via: String(raw.via || '').trim(),
    placedAtIso,
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
