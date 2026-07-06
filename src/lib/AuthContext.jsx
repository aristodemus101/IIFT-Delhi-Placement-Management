import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from './firebase'
import { MASTER_ADMIN_EMAILS } from './roleConfig'

// Installed PWAs use redirect sign-in because popups are blocked on iOS standalone
// and unreliable on Android standalone. Web always uses popup.
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

async function ensureTpoProfile(u) {
  try {
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
  } catch (_) {}
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // user: undefined = Firebase hasn't told us yet (show nothing)
  //       null      = definitely signed out
  //       object    = signed in
  const [user, setUser]               = useState(undefined)

  // role: null = not yet loaded or not signed in
  const [role, setRole]               = useState(null)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)

  // authStatus drives what the UI shows:
  //   'loading'        — Firebase hasn't resolved yet (spinner at app root)
  //   'authenticated'  — signed in + role loaded
  //   'unauthenticated'— signed out, go to /login
  //   'unauthorized'   — signed in but not on allowlist
  const [authStatus, setAuthStatus]   = useState('loading')

  useEffect(() => {
    let unsubRole = null
    let cancelled = false

    // ── Role loader ──────────────────────────────────────────────────────────
    // Called once Firebase confirms the user is signed in.
    // Runs allowlist check + role bootstrap on first login; on subsequent loads
    // the role doc already exists so it's just one Firestore read + snapshot.
    async function loadRole(u) {
      try {
        const isMaster = MASTER_ADMIN_EMAILS.includes(u.email)

        // Allowlist check — only for non-master-admin users
        if (!isMaster) {
          const authSnap = await getDoc(doc(db, 'config', 'authorizedUsers'))
          const emails = authSnap.exists() ? (authSnap.data()?.emails || []) : []
          if (!emails.includes(u.email)) {
            // Not on the allowlist — sign them out immediately
            setUser(null); setRole(null); setIsMasterAdmin(false)
            setAuthStatus('unauthorized')
            await signOut(auth)
            return
          }
        }

        const roleRef = doc(db, 'roles', u.uid)
        const roleSnap = await getDoc(roleRef)

        if (!roleSnap.exists()) {
          // First login: bootstrap the role doc
          if (isMaster) {
            await setDoc(roleRef, {
              role: 'admin', isMasterAdmin: true,
              email: u.email, displayName: u.displayName, photoURL: u.photoURL,
              addedAt: serverTimestamp(), addedBy: 'system',
            })
          } else {
            // Pull assigned role from the roleMap in authorizedUsers
            const authSnap2 = await getDoc(doc(db, 'config', 'authorizedUsers'))
            const roleMap   = authSnap2.exists() ? (authSnap2.data()?.roleMap || {}) : {}
            const assigned  = roleMap[u.email.replace(/\./g, '_')] || null
            if (!assigned) {
              setUser(null); setRole(null); setIsMasterAdmin(false)
              setAuthStatus('unauthorized')
              await signOut(auth)
              return
            }
            await setDoc(roleRef, {
              role: assigned, isMasterAdmin: false,
              email: u.email, displayName: u.displayName, photoURL: u.photoURL,
              addedAt: serverTimestamp(), addedBy: 'admin',
            })
          }
        } else if (isMaster) {
          // Ensure master admin flag is always correct even if manually changed
          const data = roleSnap.data()
          if (!data.isMasterAdmin || data.role !== 'admin') {
            await updateDoc(roleRef, { role: 'admin', isMasterAdmin: true })
          }
        }

        if (cancelled) return

        // Live role listener — picks up admin permission changes in real time
        unsubRole = onSnapshot(roleRef, snap => {
          if (cancelled || !snap.exists()) return
          const data = snap.data()
          setUser(u)
          setRole(data.role || null)
          setIsMasterAdmin(data.isMasterAdmin === true)
          setAuthStatus('authenticated')
          if (data.role === 'tpo') ensureTpoProfile(u)
        }, err => {
          // Role listener dropped — treat as signed out so user sees /login,
          // not a broken authenticated state. Does NOT sign out of Firebase
          // because this might be a transient network issue.
          console.error('Role snapshot error:', err)
          setRole(null); setIsMasterAdmin(false)
          setAuthStatus('unauthenticated')
        })
      } catch (err) {
        console.error('Role load error:', err)
        // Transient Firestore error — don't sign out, just go unauthenticated
        // so the user can reload and retry without losing their Firebase session.
        setUser(null); setRole(null); setIsMasterAdmin(false)
        setAuthStatus('unauthenticated')
      }
    }

    // ── Auth subscriber ──────────────────────────────────────────────────────
    // onAuthStateChanged resolves from the local IndexedDB cache (~50ms).
    // It does NOT make a network request for returning users.
    function subscribeAuth() {
      return onAuthStateChanged(auth, u => {
        if (cancelled) return

        // Tear down previous role listener whenever auth state changes
        if (unsubRole) { unsubRole(); unsubRole = null }

        if (!u) {
          setUser(null); setRole(null); setIsMasterAdmin(false)
          // Preserve 'unauthorized' status if we already set it — don't
          // downgrade it to 'unauthenticated' after signOut(auth) above.
          setAuthStatus(prev => prev === 'unauthorized' ? 'unauthorized' : 'unauthenticated')
          return
        }

        // Set user immediately so AuthGate unblocks and the app shell renders.
        // Role and authStatus will be updated by loadRole in the background.
        // PageGate handles per-page blocking until role arrives.
        setUser(u)
        loadRole(u)
      })
    }

    let unsubAuth = null

    if (isStandalone()) {
      // PWA redirect flow: consume getRedirectResult BEFORE subscribing
      // onAuthStateChanged. If we subscribe first, it fires null (no user yet)
      // because the credential from the redirect hasn't been processed yet,
      // and the user gets bounced to /login.
      getRedirectResult(auth).catch(() => {}).finally(() => {
        if (!cancelled) unsubAuth = subscribeAuth()
      })
    } else {
      // Web: subscribe immediately. onAuthStateChanged resolves from local
      // cache in ~50ms — no network round-trip.
      unsubAuth = subscribeAuth()
    }

    return () => {
      cancelled = true
      if (unsubAuth) unsubAuth()
      if (unsubRole) unsubRole()
    }
  }, [])

  const login = () =>
    isStandalone()
      ? signInWithRedirect(auth, googleProvider)
      : signInWithPopup(auth, googleProvider)

  const logout = () => signOut(auth)

  const toggleMasterAdmin = async (uid, value) => {
    await updateDoc(doc(db, 'roles', uid), { isMasterAdmin: value })
  }

  return (
    <AuthContext.Provider value={{
      user, role, isMasterAdmin, authStatus,
      login, logout, toggleMasterAdmin,
      isAdmin:              role === 'admin',
      isCommittee:          role === 'committee',
      isTpo:                role === 'tpo',
      isFacultyCoordinator: role === 'faculty_coordinator',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
