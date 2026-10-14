import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { db, auth, callEnrichContacts, callSearchPeople } from './firebase'

// Live feed of enriched outreach contacts. Phone fields update in place when
// the Apollo webhook resolves them (phoneStatus: pending → done/none).
export function useOutreachContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = null
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsub) { unsub(); unsub = null }
      if (!u) { setContacts([]); setLoading(false); return }
      const q = query(collection(db, 'outreachContacts'), orderBy('enrichedAt', 'desc'))
      unsub = onSnapshot(q, snap => {
        setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }, () => setLoading(false))
    })
    return () => { unsubAuth(); if (unsub) unsub() }
  }, [])

  return { contacts, loading }
}

// Live Apollo usage counters for the tracker UI.
export function useApolloUsage() {
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    let unsub = null
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsub) { unsub(); unsub = null }
      if (!u) { setUsage(null); return }
      unsub = onSnapshot(doc(db, 'config', 'apolloUsage'), snap => {
        setUsage(snap.exists() ? snap.data() : {})
      }, () => setUsage({}))
    })
    return () => { unsubAuth(); if (unsub) unsub() }
  }, [])

  return usage
}

// Asia/Kolkata YYYY-MM-DD — matches the server's day key for the daily budget.
export function todayKeyIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Thin wrapper around the callable. Returns the function's result data.
export async function enrichContacts(urls, wantPhone) {
  const res = await callEnrichContacts({ urls, wantPhone })
  return res.data
}

// People search (no credits). Returns { results, page, totalPages, totalEntries }.
export async function searchPeople({ titles, company, page }) {
  const res = await callSearchPeople({ titles, company, page })
  return res.data
}
