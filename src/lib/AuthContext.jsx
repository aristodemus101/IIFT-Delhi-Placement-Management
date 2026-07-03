import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from './firebase'
import { MASTER_ADMIN_EMAILS } from './roleConfig'

// Installed PWAs on iOS block popups entirely; Android standalone also prefers redirect.
// Use redirect when running as a standalone installed app.
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

// Creates the tpoProfile doc on first TPO login so the admin All-TPOs view
// can show the TPO's name even before they visit their own page.
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

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)       // undefined = still loading
  const [role, setRole] = useState(null)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)
  const [authStatus, setAuthStatus] = useState('loading')
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let unsubRole = null
    let unsubAuth = null
    let cancelled = false

    function subscribeAuth() {
      unsubAuth = onAuthStateChanged(
        auth,
        async (u) => {
          if (cancelled) return
          if (unsubRole) { unsubRole(); unsubRole = null }

          if (!u) {
            setUser(null); setRole(null); setIsMasterAdmin(false)
            setAuthStatus(prev => prev === 'unauthorized' ? 'unauthorized' : 'unauthenticated')
            return
          }

          try {
            const isMasterAdminEmail = MASTER_ADMIN_EMAILS.includes(u.email)

            if (!isMasterAdminEmail) {
              const authUsersSnap = await getDoc(doc(db, 'config', 'authorizedUsers'))
              const allowed = authUsersSnap.exists()
                ? (authUsersSnap.data()?.emails || []).includes(u.email)
                : false
              if (!allowed) {
                setUser(null); setRole(null); setIsMasterAdmin(false)
                setAuthStatus('unauthorized')
                await signOut(auth)
                return
              }
            }

            const roleRef = doc(db, 'roles', u.uid)
            const roleSnap = await getDoc(roleRef)

            if (!roleSnap.exists()) {
              if (isMasterAdminEmail) {
                await setDoc(roleRef, {
                  role: 'admin',
                  isMasterAdmin: true,
                  email: u.email,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  addedAt: serverTimestamp(),
                  addedBy: 'system',
                })
              } else {
                const authUsersSnap2 = await getDoc(doc(db, 'config', 'authorizedUsers'))
                const roleMap = authUsersSnap2.exists() ? (authUsersSnap2.data()?.roleMap || {}) : {}
                const safeKey = u.email.replace(/\./g, '_')
                const assignedRole = roleMap[safeKey] || null
                if (!assignedRole) {
                  setUser(null); setRole(null); setIsMasterAdmin(false)
                  setAuthStatus('unauthorized')
                  await signOut(auth)
                  return
                }
                await setDoc(roleRef, {
                  role: assignedRole,
                  isMasterAdmin: false,
                  email: u.email,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  addedAt: serverTimestamp(),
                  addedBy: 'admin',
                })
              }
            } else if (isMasterAdminEmail) {
              const data = roleSnap.data()
              if (!data.isMasterAdmin || data.role !== 'admin') {
                await updateDoc(roleRef, { role: 'admin', isMasterAdmin: true })
              }
            }

            if (cancelled) return

            unsubRole = onSnapshot(roleRef, snap => {
              if (!snap.exists()) return
              const data = snap.data()
              setUser(u)
              setRole(data.role || null)
              setIsMasterAdmin(data.isMasterAdmin === true)
              setAuthStatus('authenticated')
              if (data.role === 'tpo') ensureTpoProfileOnLogin(u)
            }, err => {
              console.error('Role listener error:', err)
              setUser(null); setRole(null); setIsMasterAdmin(false)
              setAuthStatus('unauthorized')
              signOut(auth)
            })
          } catch (err) {
            console.error('Role load error:', err)
            setUser(null); setRole(null); setIsMasterAdmin(false)
            setAuthStatus('unauthorized')
            signOut(auth)
          }
        },
        err => {
          console.error('Auth error:', err)
          setAuthError(err.message); setUser(null)
          setAuthStatus('unauthenticated')
        }
      )
    }

    // On PWA standalone, getRedirectResult must resolve before we subscribe
    // onAuthStateChanged — otherwise it fires with null before the redirect
    // credential has landed, sending the user back to /login.
    // On web (non-standalone), getRedirectResult resolves immediately with null
    // so this adds no latency.
    getRedirectResult(auth).catch(() => {}).finally(() => {
      if (!cancelled) subscribeAuth()
    })

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
