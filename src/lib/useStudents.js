import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, setDoc, getDoc
} from 'firebase/firestore'
import { db, auth } from './firebase'
import { schemaDocIdForBatch } from './batch'

// Read-only hook for student data.
// All write operations (place, delete, import, etc.) go through PendingChangesContext.
export function useStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  const [uid, setUid] = useState(undefined)
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUid(u ? u.uid : null))
    return unsub
  }, [])

  useEffect(() => {
    if (uid === undefined) return
    if (uid === null) { setStudents([]); setLoading(false); return }

    const q = query(collection(db, 'students'), orderBy('_createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setStudents(snap.docs.map(d => ({ _id: d.id, ...d.data() }))); setLoading(false) },
      err => { console.error('Firestore error:', err); setLoading(false) }
    )
    return unsub
  }, [uid])

  return { students, loading }
}

// Templates are non-sensitive configuration — no approval workflow needed.
export function useTemplates() {
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'templates'),
      snap => setTemplates(snap.docs.map(d => ({ _id: d.id, ...d.data() }))),
      err => console.error('templates error:', err)
    )
    return unsub
  }, [])

  const saveTemplate = async (name, mappings) => {
    await addDoc(collection(db, 'templates'), { name, mappings, createdAt: serverTimestamp() })
  }

  const deleteTemplate = async (id) => {
    await deleteDoc(doc(db, 'templates', id))
  }

  return { templates, saveTemplate, deleteTemplate }
}

export function useColumnSchema(batch = 'final') {
  const [schemaHeaders, setSchemaHeadersState] = useState([])
  const [loading, setLoading] = useState(true)
  const schemaDocId = schemaDocIdForBatch(batch)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', schemaDocId),
      async snap => {
        if (snap.exists()) {
          setSchemaHeadersState(Array.isArray(snap.data().headers) ? snap.data().headers : [])
          setLoading(false)
          return
        }

        setSchemaHeadersState([])
        setLoading(false)
      },
      err => {
        console.error('columnSchema error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [schemaDocId])

  const setSchemaHeaders = async (headers, updatedBy) => {
    await setDoc(doc(db, 'config', schemaDocId), {
      headers,
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy?.uid || null,
      updatedByName: updatedBy?.displayName || null,
      source: 'manual',
      batch,
    }, { merge: true })
  }

  return { schemaHeaders, loading, setSchemaHeaders }
}
