import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from './firebase'
import { MASTER_ADMIN_EMAILS } from './roleConfig'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

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
  } catch (_) {}
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(undefined)
  const [role, setRole]               = useState(null)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)
  const [authStatus, setAuthStatus]   = useState('loading')

  useEffect(() => {
    let unsubRole = null
    let cancelled = false

    function subscribeAuth() {
      const unsubAuth = onAuthStateChanged(auth, async (u) => {
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
                role: 'admin', isMasterAdmin: true,
                email: u.email, displayName: u.displayName, photoURL: u.photoURL,
                addedAt: serverTimestamp(), addedBy: 'system',
              })
            } else {
              const authUsersSnap2 = await getDoc(doc(db, 'config', 'authorizedUsers'))
              const roleMap = authUsersSnap2.exists() ? (authUsersSnap2.data()?.roleMap || {}) : {}
              const assignedRole = roleMap[u.email.replace(/\./g, '_')] || null
              if (!assignedRole) {
                setUser(null); setRole(null); setIsMasterAdmin(false)
                setAuthStatus('unauthorized')
                await signOut(auth)
                return
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
            setAuthStatus('unauthenticated')
          })
        } catch (err) {
          console.error('Auth flow error:', err)
          // Don't sign out on transient errors — just go unauthenticated
          // so the user can retry. Signing out on network errors is destructive.
          setUser(null); setRole(null); setIsMasterAdmin(false)
          setAuthStatus('unauthenticated')
        }
      })

      return unsubAuth
    }

    let unsubAuth = null

    if (isStandalone()) {
      // PWA redirect flow: must consume getRedirectResult before subscribing
      // onAuthStateChanged, otherwise it fires null before credential lands.
      getRedirectResult(auth).catch(() => {}).finally(() => {
        if (!cancelled) unsubAuth = subscribeAuth()
      })
    } else {
      // Web: skip getRedirectResult entirely — it adds a network round-trip
      // on every page load for no benefit (we use signInWithPopup on web).
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
