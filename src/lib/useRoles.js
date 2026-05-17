import { useState, useEffect } from 'react'
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { db, auth } from './firebase'

export function useRoles() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubSnap = null

    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsubSnap) { unsubSnap(); unsubSnap = null }
      if (!u) { setRoles([]); setLoading(false); return }
      unsubSnap = onSnapshot(
        collection(db, 'roles'),
        snap => { setRoles(snap.docs.map(d => ({ uid: d.id, ...d.data() }))); setLoading(false) },
        err => { console.error('roles error:', err); setLoading(false) }
      )
    })

    return () => { unsubAuth(); if (unsubSnap) unsubSnap() }
  }, [])

  const setRole = async (uid, newRole) => {
    await updateDoc(doc(db, 'roles', uid), { role: newRole })
  }

  const adminCount = roles.filter(r => r.role === 'admin').length
  const adminUsers = roles.filter(r => r.role === 'admin')

  return { roles, loading, setRole, adminCount, adminUsers }
}
