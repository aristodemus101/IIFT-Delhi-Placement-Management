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
  const [authStatus, setAuthStatus] = useState('loading') // 'loading' | 'unauthorized' | 'authenticated'
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
          // Clean up any previous role listener when auth state changes
          if (unsubRole) { unsubRole(); unsubRole = null }

          if (!u) {
            setUser(null); setRole(null); setIsMasterAdmin(false)
            // Keep 'unauthorized' sticky; anything else becomes 'unauthenticated'
            setAuthStatus(prev => prev === 'unauthorized' ? 'unauthorized' : 'unauthenticated')
            return
          }

          try {
            const isMasterAdminEmail = MASTER_ADMIN_EMAILS.includes(u.email)

            // ── Allowlist check ──────────────────────────────────────────────
            // Master admin emails are always allowed (bootstrap escape hatch).
            // For everyone else, check /config/authorizedUsers.
            if (!isMasterAdminEmail) {
              const authUsersSnap = await getDoc(doc(db, 'config', 'authorizedUsers'))
              const allowed = authUsersSnap.exists()
                ? (authUsersSnap.data()?.emails || []).includes(u.email)
                : false
              if (!allowed) {
                // Set state BEFORE signOut so the 'unauthorized' sticky check sees it
                setUser(null); setRole(null); setIsMasterAdmin(false)
                setAuthStatus('unauthorized')
                await signOut(auth)
                return
              }
            }

            // ── Role loading ─────────────────────────────────────────────────
            const roleRef = doc(db, 'roles', u.uid)
            const roleSnap = await getDoc(roleRef)

            if (!roleSnap.exists()) {
              if (isMasterAdminEmail) {
                // Bootstrap: create master admin role doc on first login
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
                // Non-master-admin first login: look up their pre-assigned role from authorizedUsers roleMap
                const authUsersSnap2 = await getDoc(doc(db, 'config', 'authorizedUsers'))
                const roleMap = authUsersSnap2.exists() ? (authUsersSnap2.data()?.roleMap || {}) : {}
                const safeKey = u.email.replace(/\./g, '_')
                const assignedRole = roleMap[safeKey] || null
                if (!assignedRole) {
                  // No role pre-assigned — they're in the allowlist but no role was set yet. Block.
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
              // Returning master admin: ensure their doc reflects master admin status
              const data = roleSnap.data()
              if (!data.isMasterAdmin || data.role !== 'admin') {
                await updateDoc(roleRef, { role: 'admin', isMasterAdmin: true })
              }
            }

            if (cancelled) return

            // Live listener on this user's role doc — picks up changes immediately
            unsubRole = onSnapshot(roleRef, snap => {
              if (!snap.exists()) return
              const data = snap.data()
              setUser(u)
              setRole(data.role || null)
              setIsMasterAdmin(data.isMasterAdmin === true)
              setAuthStatus('authenticated')
              // Ensure TPO profile doc exists so the admin All-TPOs analytics view
              // can display the TPO name even before they visit their own page.
              if (data.role === 'tpo') ensureTpoProfileOnLogin(u)
            }, err => {
              // Role listener error — fail closed: treat as unauthorized
              console.error('Role listener error:', err)
              setUser(null); setRole(null); setIsMasterAdmin(false)
              setAuthStatus('unauthorized')
              signOut(auth)
            })
          } catch (err) {
            // Any error during auth/allowlist check — fail closed: treat as unauthorized
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

    // On PWA (iOS/Android standalone), signInWithRedirect returns to the app
    // after the Google OAuth flow completes. We must await getRedirectResult
    // BEFORE subscribing onAuthStateChanged — otherwise onAuthStateChanged fires
    // with no user (localStorage not yet hydrated by the redirect credential)
    // and routes the user back to /login before the sign-in lands.
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
