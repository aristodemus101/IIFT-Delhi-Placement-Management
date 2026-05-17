import { useState, useEffect, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, auth } from './firebase'
import { useAuth } from './AuthContext'
import { PAGE_ACCESS, ACTION_ACCESS, FIELD_DEFAULTS, canAccess, canDo } from './permissions'

// Reads the live rolePermissions config doc and merges with hardcoded defaults.
// The config doc can only further restrict visibility — it can never grant more
// than the FIELD_DEFAULTS allow.
export function usePermissions() {
  const { role } = useAuth()
  const [config, setConfig] = useState(null)

  useEffect(() => {
    let unsub = null
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsub) { unsub(); unsub = null }
      if (!u) { setConfig(null); return }
      unsub = onSnapshot(
        doc(db, 'config', 'rolePermissions'),
        snap => setConfig(snap.exists() ? snap.data() : {}),
        () => setConfig({})
      )
    })
    return () => { unsubAuth(); if (unsub) unsub() }
  }, [])

  return useMemo(() => {
    // Field visibility: merge hardcoded defaults with admin overrides
    const fieldVisible = (fieldKey) => {
      if (!role) return false
      if (role === 'admin') return true   // admins always see everything

      // Check if admin has configured an override for this field
      const overrideRoles = config?.[fieldKey]
      if (overrideRoles !== undefined) {
        return Array.isArray(overrideRoles) ? overrideRoles.includes(role) : false
      }

      // Fall back to hardcoded defaults
      const defaultRoles = FIELD_DEFAULTS[fieldKey]
      if (defaultRoles !== undefined) return defaultRoles.includes(role)

      return true  // fields not listed in FIELD_DEFAULTS are visible to all
    }

    return {
      // Page-level gate
      canAccessPage: (page) => canAccess(page, role),

      // Action gate
      canDo: (action) => canDo(action, role),

      // Field-level visibility
      fieldVisible,

      // Convenience: true if the user can see any placement financial details
      canSeeFinancials: role === 'admin' || (config?.ctc || []).includes(role),
    }
  }, [role, config])
}
