// src/lib/useStudents.js
import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, writeBatch, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

export function useStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('_createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setStudents(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => {
        console.error('Firestore error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  const addStudents = async (rows) => {
    // Batch import — Firestore limit is 500 per batch
    const chunks = []
    for (let i = 0; i < rows.length; i += 400) chunks.push(rows.slice(i, i + 400))
    for (const chunk of chunks) {
      const batch = writeBatch(db)
      chunk.forEach(row => {
        const ref = doc(collection(db, 'students'))
        batch.set(ref, { ...row, _placed: false, _placedCompany: null, _placedAt: null, _createdAt: serverTimestamp() })
      })
      await batch.commit()
    }
  }

  const markPlaced = async (id, company) => {
    await updateDoc(doc(db, 'students', id), {
      _placed: true,
      _placedCompany: company,
      _placedAt: new Date().toISOString()
    })
  }

  const unplace = async (id) => {
    await updateDoc(doc(db, 'students', id), {
      _placed: false, _placedCompany: null, _placedAt: null
    })
  }

  const deleteStudent = async (id) => {
    await deleteDoc(doc(db, 'students', id))
  }

  const clearAll = async () => {
    const batch = writeBatch(db)
    students.forEach(s => batch.delete(doc(db, 'students', s._id)))
    await batch.commit()
  }

  return { students, loading, addStudents, markPlaced, unplace, deleteStudent, clearAll }
}

export function useTemplates() {
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'templates'), snap => {
      setTemplates(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    })
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
