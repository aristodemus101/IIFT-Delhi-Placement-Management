import { useState, useEffect } from 'react'
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

export function useRoles() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'roles'),
      snap => { setRoles(snap.docs.map(d => ({ uid: d.id, ...d.data() }))); setLoading(false) },
      err => { console.error('roles error:', err); setLoading(false) }
    )
    return unsub
  }, [])

  const setRole = async (uid, newRole) => {
    await updateDoc(doc(db, 'roles', uid), { role: newRole })
  }

  const adminCount = roles.filter(r => r.role === 'admin').length

  return { roles, loading, setRole, adminCount }
}
