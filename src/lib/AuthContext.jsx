import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from './firebase'
import { MASTER_ADMIN_EMAILS } from './roleConfig'

// ── Platform detection ────────────────────────────────────────────────────────
// Use redirect on mobile browsers (popup blocked by default) and installed PWAs.
// Check once at module load so the value is stable for the session.
const isMobile = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

const useRedirect = isMobile() || isStandalone()

// Key used to signal to the next page load that we're returning from a redirect.
const REDIRECT_PENDING_KEY = 'pos_redirect_pending'

// ── TPO profile bootstrap ─────────────────────────────────────────────────────
async function ensureTpoProfileOnLogin(u) {
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
  } catch (_) {
    // Non-critical — profile will be created when they visit TpoPage
  }
}

// ── Role loading ─────────────────────────────────────────────────────────────
// Extracted so it can be called from both the normal auth observer and after
// a redirect result lands. Returns an unsubscribe function for the role listener.
async function loadRoleAndSubscribe(u, { onState, onRoleUnsub, cancelled }) {
  try {
    const isMasterAdminEmail = MASTER_ADMIN_EMAILS.includes(u.email)

    if (!isMasterAdminEmail) {
      const authUsersSnap = await getDoc(doc(db, 'config', 'authorizedUsers'))
      const allowed = authUsersSnap.exists()
        ? (authUsersSnap.data()?.emails || []).includes(u.email)
        : false
      if (!allowed) {
        onState({ user: null, role: null, isMasterAdmin: false, status: 'unauthorized' })
        await signOut(auth)
        return null
      }
    }

    const roleRef = doc(db, 'roles', u.uid)
    const roleSnap = await getDoc(roleRef)

    if (!roleSnap.exists()) {
      if (isMasterAdminEmail) {
        await setDoc(roleRef, {
          role: 'admin', isMasterAdmin: true,
          email: u.email, displayName: u.displayName, photoURL: u.photoURL,
          addedAt: serverTimestamp(), addedBy: 'system',
        })
      } else {
        const authUsersSnap2 = await getDoc(doc(db, 'config', 'authorizedUsers'))
        const roleMap = authUsersSnap2.exists() ? (authUsersSnap2.data()?.roleMap || {}) : {}
        const assignedRole = roleMap[u.email.replace(/\./g, '_')] || null
        if (!assignedRole) {
          onState({ user: null, role: null, isMasterAdmin: false, status: 'unauthorized' })
          await signOut(auth)
          return null
        }
        await setDoc(roleRef, {
          role: assignedRole, isMasterAdmin: false,
          email: u.email, displayName: u.displayName, photoURL: u.photoURL,
          addedAt: serverTimestamp(), addedBy: 'admin',
        })
      }
    } else if (isMasterAdminEmail) {
      const data = roleSnap.data()
      if (!data.isMasterAdmin || data.role !== 'admin') {
        await updateDoc(roleRef, { role: 'admin', isMasterAdmin: true })
      }
    }

    if (cancelled()) return null

    // Live listener — picks up role changes immediately
    const unsub = onSnapshot(roleRef, snap => {
      if (!snap.exists()) return
      const data = snap.data()
      onState({ user: u, role: data.role || null, isMasterAdmin: data.isMasterAdmin === true, status: 'authenticated' })
      if (data.role === 'tpo') ensureTpoProfileOnLogin(u)
    }, err => {
      console.error('Role listener error:', err)
      onState({ user: null, role: null, isMasterAdmin: false, status: 'unauthorized' })
      signOut(auth)
    })

    onRoleUnsub(unsub)
    return unsub
  } catch (err) {
    console.error('Role load error:', err)
    onState({ user: null, role: null, isMasterAdmin: false, status: 'unauthorized' })
    signOut(auth)
    return null
  }
}

// ── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(undefined)
  const [role, setRole]               = useState(null)
  const [isMasterAdmin, setIsMaster]  = useState(false)
  const [authStatus, setAuthStatus]   = useState('loading')
  const [authError, setAuthError]     = useState(null)

  useEffect(() => {
    let unsubRole = null
    let unsubAuth = null
    let destroyed = false

    function applyState({ user: u, role: r, isMasterAdmin: ma, status }) {
      if (destroyed) return
      setUser(u)
      setRole(r)
      setIsMaster(ma)
      setAuthStatus(status)
    }

    function setRoleUnsub(fn) {
      if (unsubRole) unsubRole()
      unsubRole = fn
    }

    // Subscribe to Firebase auth state changes.
    // This fires once immediately with the persisted session (or null if none).
    unsubAuth = onAuthStateChanged(auth, async u => {
      if (destroyed) return

      // Clean up previous role listener whenever auth user changes
      if (unsubRole) { unsubRole(); unsubRole = null }

      if (!u) {
        // Keep 'unauthorized' sticky so the denied screen persists across
        // the signOut-triggered null user event.
        setAuthStatus(prev => prev === 'unauthorized' ? 'unauthorized' : 'unauthenticated')
        setUser(null); setRole(null); setIsMaster(false)
        return
      }

      await loadRoleAndSubscribe(u, {
        onState: applyState,
        onRoleUnsub: setRoleUnsub,
        cancelled: () => destroyed,
      })
    }, err => {
      console.error('Auth observer error:', err)
      setAuthError(err.message)
      setUser(null)
      setAuthStatus('unauthenticated')
    })

    // Handle redirect sign-in return.
    // Only call getRedirectResult when we actually initiated a redirect —
    // guarded by a sessionStorage flag set in login() below.
    // This avoids the race where getRedirectResult resolves before
    // onAuthStateChanged has hydrated the persisted session.
    if (sessionStorage.getItem(REDIRECT_PENDING_KEY)) {
      sessionStorage.removeItem(REDIRECT_PENDING_KEY)
      getRedirectResult(auth).catch(err => {
        // Surface redirect errors (e.g. account mismatch, popup closed)
        if (err?.code && err.code !== 'auth/cancelled-popup-request') {
          console.error('Redirect sign-in error:', err)
          // onAuthStateChanged will fire with null — error shown via LoginPage
        }
      })
      // No need to do anything on success: onAuthStateChanged fires automatically
      // when the credential lands, exactly as it does for popup sign-in.
    }

    return () => {
      destroyed = true
      if (unsubAuth) unsubAuth()
      if (unsubRole) unsubRole()
    }
  }, [])

  const login = () => {
    if (useRedirect) {
      sessionStorage.setItem(REDIRECT_PENDING_KEY, '1')
      return signInWithRedirect(auth, googleProvider)
    }
    return signInWithPopup(auth, googleProvider)
  }

  const logout = () => signOut(auth)

  const toggleMasterAdmin = async (uid, value) => {
    await updateDoc(doc(db, 'roles', uid), { isMasterAdmin: value })
  }

  if (authError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
      <strong style={{ color: '#c0392b' }}>Firebase Auth Error</strong>
      <p style={{ color: '#555', maxWidth: 480, fontSize: 14 }}>{authError}</p>
      <p style={{ color: '#888', fontSize: 13 }}>Go to <strong>Firebase Console → Authentication → Get started</strong> and enable <strong>Google</strong> as a sign-in provider.</p>
    </div>
  )

  return (
    <AuthContext.Provider value={{
      user, role, isMasterAdmin, authStatus, login, logout, toggleMasterAdmin,
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
