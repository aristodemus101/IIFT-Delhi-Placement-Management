import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, setDoc
} from 'firebase/firestore'
import { db } from './firebase'

// Read-only hook for student data.
// All write operations (place, delete, import, etc.) go through PendingChangesContext.
export function useStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('_createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setStudents(snap.docs.map(d => ({ _id: d.id, ...d.data() }))); setLoading(false) },
      err => { console.error('Firestore error:', err); setLoading(false) }
    )
    return unsub
  }, [])

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

export function useColumnSchema() {
  const [schemaHeaders, setSchemaHeadersState] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'columnSchema'),
      snap => {
        if (snap.exists()) setSchemaHeadersState(Array.isArray(snap.data().headers) ? snap.data().headers : [])
        else setSchemaHeadersState([])
        setLoading(false)
      },
      err => {
        console.error('columnSchema error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  const setSchemaHeaders = async (headers, updatedBy) => {
    await setDoc(doc(db, 'config', 'columnSchema'), {
      headers,
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy?.uid || null,
      updatedByName: updatedBy?.displayName || null,
      source: 'manual',
    }, { merge: true })
  }

  return { schemaHeaders, loading, setSchemaHeaders }
}
