import { useState, useEffect, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, auth } from './firebase'
import { useAuth } from './AuthContext'
import { PAGE_ACCESS, ACTION_ACCESS, FIELD_DEFAULTS } from './permissions'

// Loads three config docs and merges with hardcoded defaults:
//   /config/rolePermissions  — field-level visibility overrides
//   /config/pageAccess       — page-level access overrides
//   /config/actionAccess     — action-level access overrides
//
// Security model:
//   - Hardcoded values in permissions.js are the FLOOR — Firestore config can only
//     grant access UP TO but never BEYOND what the Firestore security rules allow.
//   - 'admin' always has full access regardless of config (enforced here AND in rules).
//   - Config can expand access for committee/tpo/faculty_coordinator within the bounds
//     that Firestore rules permit for those roles.
export function usePermissions() {
  const { role } = useAuth()
  const [fieldConfig, setFieldConfig]   = useState(null)
  const [pageConfig, setPageConfig]     = useState(null)
  const [actionConfig, setActionConfig] = useState(null)

  useEffect(() => {
    const subs = []
    const unsubAuth = auth.onAuthStateChanged(u => {
      subs.forEach(fn => fn())
      subs.length = 0
      if (!u) { setFieldConfig(null); setPageConfig(null); setActionConfig(null); return }

      subs.push(onSnapshot(
        doc(db, 'config', 'rolePermissions'),
        snap => setFieldConfig(snap.exists() ? snap.data() : {}),
        () => setFieldConfig({})
      ))
      subs.push(onSnapshot(
        doc(db, 'config', 'pageAccess'),
        snap => setPageConfig(snap.exists() ? snap.data() : {}),
        () => setPageConfig({})
      ))
      subs.push(onSnapshot(
        doc(db, 'config', 'actionAccess'),
        snap => setActionConfig(snap.exists() ? snap.data() : {}),
        () => setActionConfig({})
      ))
    })
    return () => { unsubAuth(); subs.forEach(fn => fn()) }
  }, [])

  return useMemo(() => {
    // ── Page access ──────────────────────────────────────────────────────────
    // Admin always has access. For others: check Firestore override first,
    // fall back to hardcoded PAGE_ACCESS.
    const canAccessPage = (page) => {
      if (!role) return false
      if (role === 'admin') return true
      const override = pageConfig?.[page]
      const allowed = Array.isArray(override) ? override : (PAGE_ACCESS[page] || [])
      return allowed.includes(role)
    }

    // ── Action access ────────────────────────────────────────────────────────
    const canDo = (action) => {
      if (!role) return false
      if (role === 'admin') return true
      const override = actionConfig?.[action]
      const allowed = Array.isArray(override) ? override : (ACTION_ACCESS[action] || [])
      return allowed.includes(role)
    }

    // ── Field visibility ─────────────────────────────────────────────────────
    const fieldVisible = (fieldKey) => {
      if (!role) return false
      if (role === 'admin') return true
      const override = fieldConfig?.[fieldKey]
      if (override !== undefined) return Array.isArray(override) ? override.includes(role) : false
      const defaults = FIELD_DEFAULTS[fieldKey]
      if (defaults !== undefined) return defaults.includes(role)
      return true
    }

    return {
      canAccessPage,
      canDo,
      fieldVisible,
      canSeeFinancials: role === 'admin' || (fieldConfig?.ctc || []).includes(role),
      // Raw config exposed so AdminPage can read current state
      pageConfig:   pageConfig   || {},
      actionConfig: actionConfig || {},
      fieldConfig:  fieldConfig  || {},
    }
  }, [role, fieldConfig, pageConfig, actionConfig])
}
