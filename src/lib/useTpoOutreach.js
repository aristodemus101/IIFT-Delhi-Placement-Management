import { useState, useEffect } from 'react'
import {
  collection, collectionGroup, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { db, auth } from './firebase'

// Outreach status options
export const OUTREACH_STATUSES = [
  { value: 'reached_out',  label: 'Reached Out' },
  { value: 'shortlisted',  label: 'Shortlisted' },
  { value: 'offer_made',   label: 'Offer Made' },
  { value: 'declined',     label: 'Declined' },
]

// Ensure the TPO's profile doc exists (creates it on first load if absent)
async function ensureTpoProfile(u) {
  const ref = doc(db, 'tpoProfiles', u.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: u.displayName || '',
      email:       u.email || '',
      photoURL:    u.photoURL || '',
      addedAt:     serverTimestamp(),
    })
  }
}

// Hook: own TPO's outreach entries (used on TpoPage when role === 'tpo')
export function useMyTpoOutreach() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = null
    const unsubAuth = auth.onAuthStateChanged(async u => {
      if (unsub) { unsub(); unsub = null }
      if (!u) { setEntries([]); setLoading(false); return }

      await ensureTpoProfile(u)

      const q = query(
        collection(db, 'tpoProfiles', u.uid, 'outreach'),
        orderBy('createdAt', 'desc'),
      )
      unsub = onSnapshot(q, snap => {
        setEntries(snap.docs.map(d => ({ id: d.id, tpoUid: u.uid, ...d.data() })))
        setLoading(false)
      }, () => setLoading(false))
    })
    return () => { unsubAuth(); if (unsub) unsub() }
  }, [])

  const addEntry = async (data) => {
    const u = auth.currentUser
    if (!u) throw new Error('Not authenticated')
    await addDoc(collection(db, 'tpoProfiles', u.uid, 'outreach'), {
      ...data,
      createdBy:  u.uid,
      createdAt:  serverTimestamp(),
      updatedAt:  serverTimestamp(),
    })
  }

  const updateEntry = async (entryId, data) => {
    const u = auth.currentUser
    if (!u) throw new Error('Not authenticated')
    await updateDoc(doc(db, 'tpoProfiles', u.uid, 'outreach', entryId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteEntry = async (entryId) => {
    const u = auth.currentUser
    if (!u) throw new Error('Not authenticated')
    await deleteDoc(doc(db, 'tpoProfiles', u.uid, 'outreach', entryId))
  }

  return { entries, loading, addEntry, updateEntry, deleteEntry }
}

// Hook: all TPO outreach entries across all TPOs (used by admin / faculty_coordinator)
export function useAllTpoOutreach() {
  const [entries, setEntries] = useState([])
  const [profiles, setProfiles] = useState({})  // tpoUid → profile data
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubEntries = null
    let unsubProfiles = null

    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsubEntries) { unsubEntries(); unsubEntries = null }
      if (unsubProfiles) { unsubProfiles(); unsubProfiles = null }
      if (!u) { setEntries([]); setProfiles({}); setLoading(false); return }

      // Listen to all tpoProfiles for display names
      unsubProfiles = onSnapshot(collection(db, 'tpoProfiles'), snap => {
        const map = {}
        snap.docs.forEach(d => { map[d.id] = d.data() })
        setProfiles(map)
      }, () => {})

      // collectionGroup query reads every outreach subcollection at once
      unsubEntries = onSnapshot(
        collectionGroup(db, 'outreach'),
        snap => {
          setEntries(snap.docs.map(d => ({
            id:     d.id,
            tpoUid: d.ref.parent.parent.id,
            ...d.data(),
          })))
          setLoading(false)
        },
        () => setLoading(false),
      )
    })

    return () => { unsubAuth(); if (unsubEntries) unsubEntries(); if (unsubProfiles) unsubProfiles() }
  }, [])

  return { entries, profiles, loading }
}
