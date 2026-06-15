import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  writeBatch, serverTimestamp, query, orderBy, getDoc, setDoc, getDocs
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'
import { parseDataFile } from './csv'
import { useAuth } from './AuthContext'
import { useSheetsSync } from './SheetsSyncContext'
import { cohortLabel, seasonLabel, schemaDocIdForBatch, parseCohortId, cohortYear } from './batch'

const PendingChangesContext = createContext(null)

export function PendingChangesProvider({ children }) {
  const { user, isAdmin, isCommittee } = useAuth()
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

  // Create a proposal — admin or committee members can propose changes.
  // Import and clearAll are admin-only.
  const propose = async (changeData) => {
    if (!isAdmin && !isCommittee) throw new Error('Not authorized')
    if (!isAdmin && (changeData.type === 'import' || changeData.type === 'clearAll')) {
      throw new Error('Not authorized')
    }

    if (changeData.type === 'clearAll') {
      if (!Array.isArray(changeData.studentIds) || !changeData.studentIds.length || !changeData.studentCount) {
        throw new Error('No students available to clear')
      }
    }

    if (changeData.type === 'place' || changeData.type === 'place_from_activity' || changeData.type === 'unplace' || changeData.type === 'delete') {
      if (!changeData.studentId) throw new Error('Student no longer exists')
    }

    if (changeData.type === 'import') {
      if (!changeData.file) throw new Error('Import file is required')
      if (!changeData.cohort) throw new Error('Import cohort is required')

      const importId = `${Date.now()}_${user.uid}`
      const storagePath = `imports/${importId}/${changeData.file.name}`
      const storageRef = ref(storage, storagePath)

      await uploadBytes(storageRef, changeData.file)

      // Create the batch doc now so the cohort appears in the sidebar immediately,
      // even before the import is approved. merge:true is safe — won't overwrite
      // an existing cohort's activeCycle or other fields.
      const cohortId = changeData.cohort
      const { yearCode, campus, programme } = parseCohortId(cohortId)
      await setDoc(doc(db, 'batches', cohortId), {
        id: cohortId,
        label: cohortLabel(cohortId),
        year: cohortYear(cohortId) || new Date().getFullYear(),
        campus: campus || '',
        programme: programme || '',
        activeCycle: changeData.activeCycle || 'final',
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: { uid: user.uid, name: user.displayName },
      }, { merge: true })

      await addDoc(collection(db, 'pendingChanges'), {
        type: 'import',
        rowCount: changeData.rowCount || 0,
        fileName: changeData.file.name,
        cohort: changeData.cohort,
        activeCycle: changeData.activeCycle || 'final',
        headers: Array.isArray(changeData.headers) ? changeData.headers.slice(0, 50) : [],
        updateSchema: !!changeData.updateSchema,
        replaceExisting: !!changeData.replaceExisting,
        storagePath,
        importId,
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

    if (change?.type === 'import' && change.storagePath) {
      await cleanupImportPayload(change.storagePath)
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
    const schemaKey = change.cohort || 'final'
    const schemaRef = doc(db, 'config', schemaDocIdForBatch(schemaKey))

    // Apply the actual change to students
    if (change.type === 'place' || change.type === 'place_from_activity') {
      const snap = await getDoc(doc(db, 'students', change.studentId))
      if (!snap.exists()) throw new Error('Student no longer exists')
      const placement = normalizePlacementDetails(change)
      const season = change.season || 'final'
      const updateData = {}
      if (season === 'summer') {
        updateData._placed_summer = true
        updateData._placement_summer = placement
      } else {
        updateData._placed_final = true
        updateData._placement_final = placement
      }
      batch.update(doc(db, 'students', change.studentId), updateData)
    } else if (change.type === 'unplace') {
      const snap = await getDoc(doc(db, 'students', change.studentId))
      if (!snap.exists()) throw new Error('Student no longer exists')
      const season = change.season || 'final'
      const updateData = {}
      if (season === 'summer') {
        updateData._placed_summer = false
        updateData._placement_summer = null
      } else {
        updateData._placed_final = false
        updateData._placement_final = null
      }
      batch.update(doc(db, 'students', change.studentId), updateData)
    } else if (change.type === 'delete') {
      const snap = await getDoc(doc(db, 'students', change.studentId))
      if (!snap.exists()) throw new Error('Student no longer exists')
      batch.delete(doc(db, 'students', change.studentId))
    } else if (change.type === 'import') {
      // Handled above by approveImport — should not reach here
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

  // Withdraw your own pending change (admin or committee can withdraw their own proposals)
  const withdraw = async (changeId, note = '') => {
    if (!isAdmin && !isCommittee) throw new Error('Not authorized')
    const change = changes.find(c => c._id === changeId)
    if (!change) throw new Error('Change not found')
    if (change.status !== 'pending') throw new Error('Only pending changes can be withdrawn')
    if (change.proposedBy !== user.uid) throw new Error('You can only withdraw your own proposals')

    if (change.type === 'import' && change.storagePath) {
      await cleanupImportPayload(change.storagePath)
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
    const cohortId = change.cohort || null
    if (!cohortId) throw new Error('Import cohort is missing')
    const schemaRef = doc(db, 'config', schemaDocIdForBatch(cohortId))
    const season = change.season || 'final'

    // Download file from Storage and parse it
    if (!change.storagePath) throw new Error('Import file reference missing')
    const downloadUrl = await getDownloadURL(ref(storage, change.storagePath))
    const response = await fetch(downloadUrl)
    const blob = await response.blob()
    const file = new File([blob], change.fileName || 'import.xlsx', { type: blob.type })
    const parsed = await parseDataFile(file, { cohort: cohortId })
    const rows = parsed.rows
    const headers = parsed.headers

    if (!rows.length) throw new Error('Import file is empty or could not be parsed')

    if (change.replaceExisting && cohortId) {
      const allStudents = await getDocs(collection(db, 'students'))
      const ids = allStudents.docs
        .filter(d => d.data()?.cohort === cohortId)
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
        batch.set(ref, {
          ...row,
          cohort: cohortId,
          _placed_summer: false,
          _placed_final: false,
          _placement_summer: null,
          _placement_final: null,
          _createdAt: serverTimestamp(),
        })
      })
      await batch.commit()
    }

    if (Array.isArray(headers) && headers.length) {
      const schemaSnap = await getDoc(schemaRef)
      if (!schemaSnap.exists() || change.updateSchema === true) {
        await setDoc(schemaRef, {
          headers,
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

    if (change.storagePath) {
      try { await deleteObject(ref(storage, change.storagePath)) } catch (_) {}
    }
  }

  const cleanupImportPayload = async (storagePath) => {
    if (!storagePath) return
    try { await deleteObject(ref(storage, storagePath)) } catch (_) {}
  }

  return (
    <PendingChangesContext.Provider value={{ changes, loading, pendingCount, propose, approve, reject, withdraw }}>
      {children}
    </PendingChangesContext.Provider>
  )
}

export const usePendingChanges = () => useContext(PendingChangesContext)

function describeChange(c) {
  const cohortPart = c.cohort ? ` [${c.cohort}]` : ''
  const seasonPart = c.season ? ` (${seasonLabel(c.season)})` : ''
  switch (c.type) {
    case 'place':
    case 'place_from_activity': {
      const company = c.placementDetails?.company || c.company || 'Unknown company'
      const via = c.placementDetails?.via ? ` via ${c.placementDetails.via}` : ''
      const opp = c.opportunityTitle ? ` [via ${c.opportunityTitle}]` : ''
      return `Placed${cohortPart}${seasonPart} ${c.studentName} (${c.studentRoll}) at ${company}${via}${opp}`
    }
    case 'unplace':  return `Unplaced${cohortPart}${seasonPart} ${c.studentName} (${c.studentRoll}) from ${c.currentCompany}`
    case 'delete':   return `Deleted${cohortPart} ${c.studentName} (${c.studentRoll})`
    case 'import': {
      const cohortStr = c.cohort ? cohortLabel(c.cohort) : ''
      return `${c.replaceExisting ? 'Replaced and imported' : 'Imported'} ${c.rowCount} student${c.rowCount !== 1 ? 's' : ''} into ${cohortStr}${c.headers?.length ? ` (${c.headers.length} columns)` : ''}`
    }
    case 'clearAll': {
      const cohortStr = c.cohort ? cohortLabel(c.cohort) : ''
      return `Cleared all ${c.studentCount} students from ${cohortStr}`
    }
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
    location: String(raw.location || '').trim(),
    package: String(raw.package || '').trim(),
    ctcNotes: String(raw.ctcNotes || '').trim(),
    via: String(raw.via || '').trim(),
    placedAtIso,
  }
}

