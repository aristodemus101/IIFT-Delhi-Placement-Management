import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from './firebase'
import { ADMIN_EMAILS, MASTER_ADMIN_EMAIL } from './roleConfig'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading
  const [role, setRole] = useState(null)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let unsubRole = null

    const unsubAuth = onAuthStateChanged(
      auth,
      async (u) => {
        // Clean up any previous role listener when auth state changes
        if (unsubRole) { unsubRole(); unsubRole = null }

        if (!u) {
          setUser(null); setRole(null); setIsMasterAdmin(false)
          return
        }

        try {
          const roleRef = doc(db, 'roles', u.uid)
          const roleSnap = await getDoc(roleRef)

          // First login: seed the role doc
          if (!roleSnap.exists()) {
            const assignedRole = ADMIN_EMAILS.includes(u.email) ? 'admin' : 'viewer'
            await setDoc(roleRef, {
              role: assignedRole,
              isMasterAdmin: u.email === MASTER_ADMIN_EMAIL,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              addedAt: serverTimestamp(),
              addedBy: 'system',
            })
          }

          // Live listener on this user's role doc — picks up master admin transfers immediately
          unsubRole = onSnapshot(roleRef, snap => {
            if (!snap.exists()) return
            const data = snap.data()
            setUser(u)
            setRole(data.role || 'viewer')
            setIsMasterAdmin(data.isMasterAdmin === true)
          }, err => {
            console.error('Role listener error:', err)
            setUser(u); setRole('viewer'); setIsMasterAdmin(false)
          })
        } catch (err) {
          console.error('Role load error:', err)
          setUser(u); setRole('viewer'); setIsMasterAdmin(false)
        }
      },
      err => {
        console.error('Auth error:', err)
        setAuthError(err.message); setUser(null)
      }
    )

    return () => { unsubAuth(); if (unsubRole) unsubRole() }
  }, [])

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  if (authError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
      <strong style={{ color: '#c0392b' }}>Firebase Auth Error</strong>
      <p style={{ color: '#555', maxWidth: 480, fontSize: 14 }}>{authError}</p>
      <p style={{ color: '#888', fontSize: 13 }}>Go to <strong>Firebase Console → Authentication → Get started</strong> and enable <strong>Google</strong> as a sign-in provider.</p>
    </div>
  )

  return (
    <AuthContext.Provider value={{
      user, role, isMasterAdmin, login, logout,
      isAdmin:     role === 'admin',
      isCommittee: role === 'committee',
      isViewer:    role === 'viewer',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
