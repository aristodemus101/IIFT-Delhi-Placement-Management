// src/lib/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      u => setUser(u || null),
      err => { console.error('Auth error:', err); setAuthError(err.message); setUser(null) }
    )
    return unsub
  }, [])

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  if (authError) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12, fontFamily:'sans-serif', padding:24, textAlign:'center' }}>
      <strong style={{ color:'#c0392b' }}>Firebase Auth Error</strong>
      <p style={{ color:'#555', maxWidth:480, fontSize:14 }}>{authError}</p>
      <p style={{ color:'#888', fontSize:13 }}>Go to <strong>Firebase Console → Authentication → Get started</strong> and enable <strong>Google</strong> as a sign-in provider.</p>
    </div>
  )

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
