import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from './firebase'
import { ADMIN_EMAILS, MASTER_ADMIN_EMAIL } from './roleConfig'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading
  const [role, setRole] = useState(null)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        if (!u) {
          if (!cancelled) { setUser(null); setRole(null) }
          return
        }
        try {
          const roleRef = doc(db, 'roles', u.uid)
          const roleSnap = await getDoc(roleRef)

          let assignedRole
          if (!roleSnap.exists()) {
            assignedRole = ADMIN_EMAILS.includes(u.email) ? 'admin' : 'viewer'
            await setDoc(roleRef, {
              role: assignedRole,
              isMasterAdmin: u.email === MASTER_ADMIN_EMAIL,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              addedAt: serverTimestamp(),
              addedBy: 'system',
            })
          } else {
            assignedRole = roleSnap.data().role
          }

          const isMaster = u.email === MASTER_ADMIN_EMAIL
          if (!cancelled) { setUser(u); setRole(assignedRole); setIsMasterAdmin(isMaster) }
        } catch (err) {
          console.error('Role load error:', err)
          if (!cancelled) { setUser(u); setRole('viewer'); setIsMasterAdmin(false) }
        }
      },
      err => {
        console.error('Auth error:', err)
        if (!cancelled) { setAuthError(err.message); setUser(null) }
      }
    )

    return () => { cancelled = true; unsub() }
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
    <AuthContext.Provider value={{ user, role, isAdmin: role === 'admin', isMasterAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
