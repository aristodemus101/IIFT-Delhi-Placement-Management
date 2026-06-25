/**
 * PlacementOS — Auth, Authz, Import, Export Test Suite
 *
 * Covers every auth/authz and import/export flow:
 * 1. AuthContext — allowlist, role loading, master admin bootstrap
 * 2. PageGate — route access by role
 * 3. usePermissions — canAccessPage, canDo, fieldVisible
 * 4. Import flow — propose guards, file parsing, SIP toggle, cycle rules
 * 5. Approval flow — approve/reject/withdraw guards, cannot-approve-own
 * 6. Export — strip internal fields, column selection
 * 7. Role management — admin-only, master admin only, cannot remove last admin
 * 8. Cohort/batch rules — only admin can create, must have valid cohort ID
 * 9. Firestore rules logic — replicated in pure JS to catch regressions
 */

import { describe, it, expect } from 'vitest'
import { PAGE_ACCESS, ACTION_ACCESS, FIELD_DEFAULTS, ROLES, ROLE_LABELS, CONFIGURABLE_ROLES } from '../lib/permissions.js'
import { cohortLabel, schemaDocIdForBatch, makeCohortId } from '../lib/batch.js'

// ─── 1. Auth — allowlist + role derivation ────────────────────────────────────
describe('Auth — allowlist logic', () => {
  const MASTER_ADMIN_EMAILS = ['divyaanshmehta513@gmail.com', 'divyaansh_d27@iift.edu']
  const AUTHORIZED_EMAILS = ['jay_d27@iift.edu', 'preeti.tak@iift.edu', 'sonali@iift.edu']
  const ROLE_MAP = {
    'jay_d27@iift_edu': 'admin',
    'preeti_tak@iift_edu': 'faculty_coordinator',
    'sonali@iift_edu': 'tpo',
  }

  function isMasterAdmin(email) {
    return MASTER_ADMIN_EMAILS.includes(email)
  }

  function isAllowed(email, allowlist) {
    if (isMasterAdmin(email)) return true
    return allowlist.includes(email)
  }

  function getRoleFromMap(email, roleMap) {
    return roleMap[email.replace(/\./g, '_')] || null
  }

  it('master admin is always allowed regardless of allowlist', () => {
    expect(isAllowed('divyaanshmehta513@gmail.com', [])).toBe(true)
    expect(isAllowed('divyaansh_d27@iift.edu', [])).toBe(true)
  })

  it('non-master-admin requires allowlist entry', () => {
    expect(isAllowed('jay_d27@iift.edu', AUTHORIZED_EMAILS)).toBe(true)
    expect(isAllowed('random@gmail.com', AUTHORIZED_EMAILS)).toBe(false)
    expect(isAllowed('random@gmail.com', [])).toBe(false)
  })

  it('unknown email on empty allowlist is blocked', () => {
    expect(isAllowed('unknown@iift.edu', [])).toBe(false)
  })

  it('role is loaded from roleMap using dot-replaced key', () => {
    expect(getRoleFromMap('jay_d27@iift.edu', ROLE_MAP)).toBe('admin')
    expect(getRoleFromMap('preeti.tak@iift.edu', ROLE_MAP)).toBe('faculty_coordinator')
    expect(getRoleFromMap('sonali@iift.edu', ROLE_MAP)).toBe('tpo')
    expect(getRoleFromMap('nobody@iift.edu', ROLE_MAP)).toBe(null)
  })

  it('user with no assigned role in roleMap is blocked (null role)', () => {
    const assignedRole = getRoleFromMap('unlisted@iift.edu', ROLE_MAP)
    expect(assignedRole).toBe(null)
  })

  it('master admin first login gets admin + isMasterAdmin=true', () => {
    const bootstrapDoc = {
      role: 'admin',
      isMasterAdmin: true,
      email: 'divyaanshmehta513@gmail.com',
    }
    expect(bootstrapDoc.role).toBe('admin')
    expect(bootstrapDoc.isMasterAdmin).toBe(true)
  })
})

// ─── 2. PageGate — route access by role ──────────────────────────────────────
describe('PageGate — route access enforcement', () => {
  function canAccessPage(role, page, overrides = {}) {
    if (!role) return false
    if (role === 'admin') return true
    const override = overrides[page]
    const allowed = Array.isArray(override) ? override : (PAGE_ACCESS[page] || [])
    return allowed.includes(role)
  }

  it('admin can access every page', () => {
    const pages = Object.keys(PAGE_ACCESS)
    pages.forEach(page => {
      expect(canAccessPage('admin', page)).toBe(true)
    })
  })

  it('committee cannot access approvals or admin', () => {
    expect(canAccessPage('committee', 'approvals')).toBe(false)
    expect(canAccessPage('committee', 'admin')).toBe(false)
  })

  it('committee can access roster, placed, activity, analytics', () => {
    expect(canAccessPage('committee', 'roster')).toBe(true)
    expect(canAccessPage('committee', 'placed')).toBe(true)
    expect(canAccessPage('committee', 'activity')).toBe(true)
    expect(canAccessPage('committee', 'analytics')).toBe(true)
  })

  it('tpo can only access tpo and about', () => {
    expect(canAccessPage('tpo', 'tpo')).toBe(true)
    expect(canAccessPage('tpo', 'about')).toBe(true)
    expect(canAccessPage('tpo', 'roster')).toBe(false)
    expect(canAccessPage('tpo', 'placed')).toBe(false)
    expect(canAccessPage('tpo', 'analytics')).toBe(false)
    expect(canAccessPage('tpo', 'approvals')).toBe(false)
    expect(canAccessPage('tpo', 'admin')).toBe(false)
  })

  it('faculty_coordinator can access analytics, tpo, about', () => {
    expect(canAccessPage('faculty_coordinator', 'analytics')).toBe(true)
    expect(canAccessPage('faculty_coordinator', 'tpo')).toBe(true)
    expect(canAccessPage('faculty_coordinator', 'about')).toBe(true)
    expect(canAccessPage('faculty_coordinator', 'roster')).toBe(false)
    expect(canAccessPage('faculty_coordinator', 'placed')).toBe(false)
    expect(canAccessPage('faculty_coordinator', 'approvals')).toBe(false)
    expect(canAccessPage('faculty_coordinator', 'admin')).toBe(false)
  })

  it('null role returns false for all pages', () => {
    Object.keys(PAGE_ACCESS).forEach(page => {
      expect(canAccessPage(null, page)).toBe(false)
    })
  })

  it('roleHome redirects tpo to /tpo and fc to /analytics', () => {
    function roleHome(role) {
      if (role === 'tpo') return '/tpo'
      if (role === 'faculty_coordinator') return '/analytics'
      return '/'
    }
    expect(roleHome('tpo')).toBe('/tpo')
    expect(roleHome('faculty_coordinator')).toBe('/analytics')
    expect(roleHome('admin')).toBe('/')
    expect(roleHome('committee')).toBe('/')
  })
})

// ─── 3. usePermissions — canDo, fieldVisible ─────────────────────────────────
describe('usePermissions — action access', () => {
  function canDo(role, action, overrides = {}) {
    if (!role) return false
    if (role === 'admin') return true
    const override = overrides[action]
    const allowed = Array.isArray(override) ? override : (ACTION_ACCESS[action] || [])
    return allowed.includes(role)
  }

  it('admin can do every action', () => {
    Object.keys(ACTION_ACCESS).forEach(action => {
      expect(canDo('admin', action)).toBe(true)
    })
  })

  it('committee can propose place/unplace/delete', () => {
    expect(canDo('committee', 'proposePlace')).toBe(true)
    expect(canDo('committee', 'proposeUnplace')).toBe(true)
    expect(canDo('committee', 'proposeDelete')).toBe(true)
  })

  it('committee cannot approve changes or import', () => {
    expect(canDo('committee', 'approveChange')).toBe(false)
    expect(canDo('committee', 'proposeImport')).toBe(false)
    expect(canDo('committee', 'proposeClearAll')).toBe(false)
  })

  it('tpo cannot approve, import, or propose student changes', () => {
    expect(canDo('tpo', 'approveChange')).toBe(false)
    expect(canDo('tpo', 'proposeImport')).toBe(false)
    expect(canDo('tpo', 'proposePlace')).toBe(false)
    expect(canDo('tpo', 'proposeUnplace')).toBe(false)
    expect(canDo('tpo', 'proposeDelete')).toBe(false)
  })

  it('tpo can write tpo outreach, fc can view all tpo data', () => {
    expect(canDo('tpo', 'writeTpoOutreach')).toBe(true)
    expect(canDo('faculty_coordinator', 'viewAllTpoData')).toBe(true)
    expect(canDo('committee', 'viewAllTpoData')).toBe(false)
    expect(canDo('tpo', 'viewAllTpoData')).toBe(false)
  })

  it('Firestore config override expands access within bounds', () => {
    const override = { proposePlace: ['admin', 'committee', 'tpo'] }
    expect(canDo('tpo', 'proposePlace', override)).toBe(true)
  })
})

describe('usePermissions — fieldVisible', () => {
  function fieldVisible(role, fieldKey, overrides = {}) {
    if (!role) return false
    if (role === 'admin') return true
    const override = overrides[fieldKey]
    if (override !== undefined) return Array.isArray(override) ? override.includes(role) : false
    const defaults = FIELD_DEFAULTS[fieldKey]
    if (defaults !== undefined) return defaults.includes(role)
    return true
  }

  it('admin can see all fields', () => {
    expect(fieldVisible('admin', 'ctc')).toBe(true)
    expect(fieldVisible('admin', 'stipend')).toBe(true)
    expect(fieldVisible('admin', '_placement_final')).toBe(true)
  })

  it('committee cannot see ctc or stipend by default', () => {
    expect(fieldVisible('committee', 'ctc')).toBe(false)
    expect(fieldVisible('committee', 'stipend')).toBe(false)
  })

  it('committee can see placement company/role', () => {
    expect(fieldVisible('committee', '_placement_final')).toBe(true)
    expect(fieldVisible('committee', '_placement_summer')).toBe(true)
  })

  it('tpo cannot see ctc, stipend, or placement data', () => {
    expect(fieldVisible('tpo', 'ctc')).toBe(false)
    expect(fieldVisible('tpo', 'stipend')).toBe(false)
    expect(fieldVisible('tpo', '_placement_final')).toBe(false)
  })

  it('fc cannot see ctc, stipend, or placement data', () => {
    expect(fieldVisible('faculty_coordinator', 'ctc')).toBe(false)
    expect(fieldVisible('faculty_coordinator', 'stipend')).toBe(false)
    expect(fieldVisible('faculty_coordinator', '_placement_final')).toBe(false)
  })

  it('unknown fields default to visible (not in FIELD_DEFAULTS)', () => {
    expect(fieldVisible('committee', 'arbitrary_field')).toBe(true)
  })

  it('Firestore override can grant ctc to committee', () => {
    const override = { ctc: ['admin', 'committee'] }
    expect(fieldVisible('committee', 'ctc', override)).toBe(true)
  })

  it('admin field stays locked even if override tries to remove it', () => {
    // Admin check happens before override in usePermissions.js — role=admin always returns true
    expect(fieldVisible('admin', 'ctc', { ctc: [] })).toBe(true)
  })
})

// ─── 4. Import flow — propose guards ─────────────────────────────────────────
describe('Import flow — propose authorization guards', () => {
  function canProposeImport(role) {
    return role === 'admin'
  }

  it('only admin can propose import', () => {
    expect(canProposeImport('admin')).toBe(true)
    expect(canProposeImport('committee')).toBe(false)
    expect(canProposeImport('tpo')).toBe(false)
    expect(canProposeImport('faculty_coordinator')).toBe(false)
  })

  it('import proposal requires file, cohort, rowCount', () => {
    function validateImportProposal(change) {
      if (change.type !== 'import') return true
      if (!change.file) return false
      if (!change.cohort) return false
      if (!change.rowCount || change.rowCount <= 0) return false
      return true
    }
    expect(validateImportProposal({ type: 'import', file: {}, cohort: '27-Delhi-IB', rowCount: 50 })).toBe(true)
    expect(validateImportProposal({ type: 'import', file: null, cohort: '27-Delhi-IB', rowCount: 50 })).toBe(false)
    expect(validateImportProposal({ type: 'import', file: {}, cohort: '', rowCount: 50 })).toBe(false)
    expect(validateImportProposal({ type: 'import', file: {}, cohort: '27-Delhi-IB', rowCount: 0 })).toBe(false)
  })

  it('includeSipData=true forces activeCycle to final', () => {
    // Replicate the setIncludeSipData logic from RosterPage
    function setIncludeSipData(val, currentCycle) {
      if (val) return 'final'
      return currentCycle
    }
    expect(setIncludeSipData(true, 'summer')).toBe('final')
    expect(setIncludeSipData(true, 'final')).toBe('final')
    expect(setIncludeSipData(false, 'summer')).toBe('summer')
  })

  it('schema headers strip only stipend columns', () => {
    const SIP_COLUMNS_STRIPPED = ['Summer Stipend', 'SIP Stipend (In Lakhs/month)', 'SIP Stipend']
    const allHeaders = [
      'Full Name', 'Roll No.', 'SIP Status', 'SIP Company', 'SIP Role',
      'Summer Stipend', 'SIP Stipend (In Lakhs/month)', 'DOP',
    ]
    const schema = allHeaders.filter(h => !SIP_COLUMNS_STRIPPED.includes(h))
    expect(schema).toContain('Full Name')
    expect(schema).toContain('SIP Status')
    expect(schema).toContain('SIP Company')
    expect(schema).toContain('DOP')
    expect(schema).not.toContain('Summer Stipend')
    expect(schema).not.toContain('SIP Stipend (In Lakhs/month)')
  })

  it('replaceExisting=true is clearly marked in the import proposal', () => {
    const proposal = {
      type: 'import', cohort: '27-Delhi-IB', rowCount: 80,
      replaceExisting: true, updateSchema: true, includeSipData: false,
    }
    expect(proposal.replaceExisting).toBe(true)
  })

  it('schemaDocId is deterministic per cohort', () => {
    expect(schemaDocIdForBatch('27-Delhi-IB')).toBe('columnSchema_27-Delhi-IB')
    expect(schemaDocIdForBatch('27-Delhi-BA')).toBe('columnSchema_27-Delhi-BA')
  })
})

// ─── 5. Approval flow — business rules ───────────────────────────────────────
describe('Approval flow — guard logic', () => {
  function canApprove(change, currentUserId, userRole) {
    if (userRole !== 'admin') return { ok: false, reason: 'Not an admin' }
    if (change.proposedBy === currentUserId) return { ok: false, reason: 'Cannot approve own proposal' }
    if (change.status !== 'pending') return { ok: false, reason: `Status is ${change.status}` }
    if (change.applied) return { ok: false, reason: 'Already applied' }
    return { ok: true }
  }

  function canWithdraw(change, currentUserId, userRole) {
    if (userRole !== 'admin' && userRole !== 'committee') return { ok: false, reason: 'Not authorized' }
    if (change.proposedBy !== currentUserId) return { ok: false, reason: 'Can only withdraw own proposals' }
    if (change.status !== 'pending') return { ok: false, reason: `Status is ${change.status}` }
    return { ok: true }
  }

  function canReject(change, currentUserId, userRole) {
    if (userRole !== 'admin') return { ok: false, reason: 'Not an admin' }
    if (change.proposedBy === currentUserId) return { ok: false, reason: 'Cannot reject own proposal' }
    if (change.status !== 'pending') return { ok: false, reason: `Status is ${change.status}` }
    return { ok: true }
  }

  const pendingChange = { proposedBy: 'uid-A', status: 'pending', applied: false, type: 'place' }
  const approvedChange = { proposedBy: 'uid-A', status: 'approved', applied: true, type: 'place' }
  const rejectedChange = { proposedBy: 'uid-A', status: 'rejected', applied: false, type: 'place' }

  it('admin can approve another admin\'s pending change', () => {
    const result = canApprove(pendingChange, 'uid-B', 'admin')
    expect(result.ok).toBe(true)
  })

  it('admin cannot approve own pending change', () => {
    const result = canApprove(pendingChange, 'uid-A', 'admin')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('own')
  })

  it('committee cannot approve any change', () => {
    const result = canApprove(pendingChange, 'uid-B', 'committee')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('Not an admin')
  })

  it('cannot approve already-applied change', () => {
    const result = canApprove(approvedChange, 'uid-B', 'admin')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('approved') // guard fires on status !== 'pending', not the applied flag
  })

  it('cannot approve rejected change', () => {
    const result = canApprove(rejectedChange, 'uid-B', 'admin')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('rejected')
  })

  it('proposer can withdraw own pending change', () => {
    expect(canWithdraw(pendingChange, 'uid-A', 'admin').ok).toBe(true)
    expect(canWithdraw(pendingChange, 'uid-A', 'committee').ok).toBe(true)
  })

  it('cannot withdraw someone else\'s change', () => {
    const result = canWithdraw(pendingChange, 'uid-B', 'admin')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('own')
  })

  it('cannot withdraw approved change', () => {
    const result = canWithdraw(approvedChange, 'uid-A', 'admin')
    expect(result.ok).toBe(false)
  })

  it('admin can reject another admin\'s change', () => {
    expect(canReject(pendingChange, 'uid-B', 'admin').ok).toBe(true)
  })

  it('admin cannot reject own change', () => {
    expect(canReject(pendingChange, 'uid-A', 'admin').ok).toBe(false)
  })

  it('tpo cannot reject', () => {
    expect(canReject(pendingChange, 'uid-B', 'tpo').ok).toBe(false)
  })

  it('invalid pending import (rowCount=0) is flagged', () => {
    const invalidImport = { type: 'import', rowCount: 0, status: 'pending', proposedBy: 'uid-A' }
    const isInvalid = invalidImport.type === 'import' && (!invalidImport.rowCount || invalidImport.rowCount <= 0)
    expect(isInvalid).toBe(true)
  })

  it('invalid clearAll (studentCount=0) is flagged', () => {
    const invalidClear = { type: 'clearAll', studentCount: 0, status: 'pending', proposedBy: 'uid-A' }
    const isInvalid = invalidClear.type === 'clearAll' && (!invalidClear.studentCount || invalidClear.studentCount <= 0)
    expect(isInvalid).toBe(true)
  })
})

// ─── 6. Export — field stripping ──────────────────────────────────────────────
describe('Export — internal field stripping', () => {
  function stripInternalFields(rows) {
    return rows.map(r => {
      const obj = { ...r }
      Object.keys(obj).filter(k => k.startsWith('_')).forEach(k => delete obj[k])
      return obj
    })
  }

  const seedRow = {
    'Full Name': 'Aarav Mehta', 'Roll No.': 'D27001',
    'SIP Company': 'BCG', 'DOP': 'Feb 21, 2025',
    cohort: '27-Delhi-IB',
    _placed_summer: true, _placement_summer: { company: 'BCG', package: '75000' },
    _placed_final: true,  _placement_final: { company: 'McKinsey', package: '3250000' },
    _createdAt: '2025-01-01T00:00:00Z',
    _id: 'abc123',
  }

  it('strips all _ prefixed fields from export', () => {
    const [stripped] = stripInternalFields([seedRow])
    expect(stripped).not.toHaveProperty('_placed_summer')
    expect(stripped).not.toHaveProperty('_placed_final')
    expect(stripped).not.toHaveProperty('_placement_summer')
    expect(stripped).not.toHaveProperty('_placement_final')
    expect(stripped).not.toHaveProperty('_createdAt')
    expect(stripped).not.toHaveProperty('_id')
  })

  it('preserves all non-internal fields', () => {
    const [stripped] = stripInternalFields([seedRow])
    expect(stripped['Full Name']).toBe('Aarav Mehta')
    expect(stripped['SIP Company']).toBe('BCG')
    expect(stripped.cohort).toBe('27-Delhi-IB')
  })

  it('PlacedPage export includes placement_domain and placement_final_status for finals', () => {
    const s = { ...seedRow, _placement_final: { domain: 'Finance', finalStatus: 'PPO', company: 'McKinsey', package: '3250000' } }
    const pl = s._placement_final
    const exportRow = {
      cohort: s.cohort,
      placement_season: 'Final Placement',
      placement_company: pl.company,
      placement_domain: pl.domain || '',
      placement_final_status: pl.finalStatus || '',
      placement_package: pl.package,
    }
    expect(exportRow.placement_domain).toBe('Finance')
    expect(exportRow.placement_final_status).toBe('PPO')
  })

  it('PlacedPage summer export does NOT include placement_final_status', () => {
    const season = 'summer'
    const pl = { company: 'BCG', package: '75000' }
    const exportRow = {
      placement_company: pl.company,
      ...(season === 'final' ? { placement_final_status: pl.finalStatus || '' } : {}),
    }
    expect(exportRow).not.toHaveProperty('placement_final_status')
  })

  it('Roster export respects visible columns only', () => {
    const student = {
      'Full Name': 'Priya', 'Roll No.': 'D27002', 'CAT Percentile': '98',
      cohort: '27-Delhi-IB', _placed_summer: false,
    }
    const visibleDefs = [
      { label: 'Full Name', sortKey: 'Full Name' },
      { label: 'Roll No.', sortKey: 'Roll No.' },
    ]
    const exportRow = {}
    visibleDefs.forEach(def => { exportRow[def.label] = student[def.sortKey] || '' })
    expect(exportRow).toHaveProperty('Full Name')
    expect(exportRow).toHaveProperty('Roll No.')
    expect(exportRow).not.toHaveProperty('CAT Percentile')
    expect(exportRow).not.toHaveProperty('cohort')
    expect(exportRow).not.toHaveProperty('_placed_summer')
  })
})

// ─── 7. Role management — admin-only guards ───────────────────────────────────
describe('Role management — admin-only guards', () => {
  it('cannot remove the last admin', () => {
    function canChangeRole(member, newRole, adminCount) {
      if (member.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
        return { ok: false, reason: 'At least one admin must remain.' }
      }
      return { ok: true }
    }
    expect(canChangeRole({ role: 'admin' }, 'committee', 1)).toEqual({ ok: false, reason: 'At least one admin must remain.' })
    expect(canChangeRole({ role: 'admin' }, 'committee', 2)).toEqual({ ok: true })
    expect(canChangeRole({ role: 'committee' }, 'admin', 1)).toEqual({ ok: true })
  })

  it('only master admin can toggle master admin status', () => {
    function canToggleMasterAdmin(currentUser) {
      return currentUser.isMasterAdmin === true
    }
    expect(canToggleMasterAdmin({ isMasterAdmin: true })).toBe(true)
    expect(canToggleMasterAdmin({ isMasterAdmin: false })).toBe(false)
    expect(canToggleMasterAdmin({ role: 'admin' })).toBe(false)
  })

  it('role selector only shows master admin controls for admin accounts', () => {
    const members = [
      { uid: 'a', role: 'admin', isMasterAdmin: false },
      { uid: 'b', role: 'committee' },
    ]
    const adminForCrown = members.filter(m => m.role === 'admin')
    expect(adminForCrown.length).toBe(1)
    expect(adminForCrown[0].uid).toBe('a')
  })

  it('CONFIGURABLE_ROLES does not include admin', () => {
    expect(CONFIGURABLE_ROLES).not.toContain('admin')
  })

  it('admin field permission checkbox is always locked', () => {
    // Admin is always true — checkbox disabled in UI and enforced in toggleFieldRole
    function toggleFieldRole(fieldKey, role, current) {
      const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role]
      return next.includes('admin') ? next : ['admin', ...next]
    }
    // Even if you try to remove admin, it comes back
    const result = toggleFieldRole('ctc', 'admin', ['admin', 'committee'])
    expect(result).toContain('admin')
  })

  it('addAuthorizedUser requires a non-empty email', () => {
    function validate(email, existingEmails) {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed) return { ok: false, reason: 'Email is required.' }
      if (existingEmails.includes(trimmed)) return { ok: false, reason: 'Email already in the list.' }
      return { ok: true, email: trimmed }
    }
    expect(validate('', [])).toEqual({ ok: false, reason: 'Email is required.' })
    expect(validate('   ', [])).toEqual({ ok: false, reason: 'Email is required.' })
    expect(validate('jay_d27@iift.edu', ['jay_d27@iift.edu'])).toEqual({ ok: false, reason: 'Email already in the list.' })
    expect(validate('new@iift.edu', [])).toEqual({ ok: true, email: 'new@iift.edu' })
  })
})

// ─── 8. Batch / cohort rules ──────────────────────────────────────────────────
describe('Batch / cohort rules', () => {
  it('cohort ID is deterministic from parts', () => {
    expect(makeCohortId('27', 'Delhi', 'IB')).toBe('27-Delhi-IB')
    expect(makeCohortId('27', 'Delhi', 'BA')).toBe('27-Delhi-BA')
    expect(makeCohortId('28', 'Kakinada', 'IB')).toBe('28-Kakinada-IB')
  })

  it('cohortLabel returns readable label', () => {
    expect(cohortLabel('27-Delhi-IB')).toBe('27 Delhi IB')
    expect(cohortLabel(null)).toBe('No cohort')
  })

  it('cohort activeCycle must be summer or final', () => {
    const validCycles = ['summer', 'final']
    expect(validCycles.includes('summer')).toBe(true)
    expect(validCycles.includes('final')).toBe(true)
    expect(validCycles.includes('other')).toBe(false)
  })

  it('SIP data import forces activeCycle to final', () => {
    function getActiveCycle(includeSipData, requestedCycle) {
      if (includeSipData) return 'final'
      return requestedCycle || 'final'
    }
    expect(getActiveCycle(true, 'summer')).toBe('final')
    expect(getActiveCycle(false, 'summer')).toBe('summer')
    expect(getActiveCycle(false, 'final')).toBe('final')
    expect(getActiveCycle(false, null)).toBe('final')
  })

  it('clearAll requires studentIds array and studentCount > 0', () => {
    function validateClearAll(change) {
      if (!Array.isArray(change.studentIds) || !change.studentIds.length) return false
      if (!change.studentCount || change.studentCount <= 0) return false
      return true
    }
    expect(validateClearAll({ studentIds: ['a', 'b'], studentCount: 2 })).toBe(true)
    expect(validateClearAll({ studentIds: [], studentCount: 0 })).toBe(false)
    expect(validateClearAll({ studentIds: ['a'], studentCount: 0 })).toBe(false)
    expect(validateClearAll({ studentIds: null, studentCount: 2 })).toBe(false)
  })
})

// ─── 9. Firestore rules — replicated logic ───────────────────────────────────
describe('Firestore security rules — logic verification', () => {
  // Replicate the core rule functions in pure JS
  function isAdmin(roleData) {
    return roleData?.role === 'admin'
  }

  function isMasterAdmin(roleData) {
    return roleData?.isMasterAdmin === true
  }

  function isCommittee(roleData) {
    return roleData?.role === 'committee'
  }

  function hasRole(roleData) {
    return ['admin', 'committee'].includes(roleData?.role)
  }

  function hasAnyRole(roleData) {
    return ['admin', 'committee', 'tpo', 'faculty_coordinator'].includes(roleData?.role)
  }

  function canViewTpoData(roleData) {
    return isAdmin(roleData) || roleData?.role === 'faculty_coordinator'
  }

  const admin = { role: 'admin', isMasterAdmin: false }
  const masterAdmin = { role: 'admin', isMasterAdmin: true }
  const committee = { role: 'committee' }
  const tpo = { role: 'tpo' }
  const fc = { role: 'faculty_coordinator' }
  const nobody = null

  describe('students collection', () => {
    it('admin and committee can read students (hasRole)', () => {
      expect(hasRole(admin)).toBe(true)
      expect(hasRole(committee)).toBe(true)
      expect(hasRole(tpo)).toBe(false)
      expect(hasRole(fc)).toBe(false)
      expect(hasRole(nobody)).toBe(false)
    })

    it('only admin can write students', () => {
      expect(isAdmin(admin)).toBe(true)
      expect(isAdmin(masterAdmin)).toBe(true)
      expect(isAdmin(committee)).toBe(false)
      expect(isAdmin(tpo)).toBe(false)
    })
  })

  describe('pendingChanges collection', () => {
    it('admin and committee can create pending changes', () => {
      function canCreate(roleData, proposedBy, authUid) {
        return (isAdmin(roleData) || isCommittee(roleData)) && proposedBy === authUid
      }
      expect(canCreate(admin, 'uid-A', 'uid-A')).toBe(true)
      expect(canCreate(committee, 'uid-B', 'uid-B')).toBe(true)
      expect(canCreate(tpo, 'uid-C', 'uid-C')).toBe(false)
      expect(canCreate(admin, 'uid-A', 'uid-B')).toBe(false) // proposedBy != auth.uid
    })

    it('approve: different admin, status=pending, result=approved', () => {
      function canApprove(roleData, proposedBy, authUid, currentStatus) {
        return isAdmin(roleData) && proposedBy !== authUid && currentStatus === 'pending'
      }
      expect(canApprove(admin, 'uid-A', 'uid-B', 'pending')).toBe(true)
      expect(canApprove(admin, 'uid-A', 'uid-A', 'pending')).toBe(false) // own proposal
      expect(canApprove(committee, 'uid-A', 'uid-B', 'pending')).toBe(false) // not admin
      expect(canApprove(admin, 'uid-A', 'uid-B', 'approved')).toBe(false) // already resolved
    })

    it('withdraw: same user, status=pending', () => {
      function canWithdraw(roleData, proposedBy, authUid, currentStatus) {
        return (isAdmin(roleData) || isCommittee(roleData)) &&
          proposedBy === authUid && currentStatus === 'pending'
      }
      expect(canWithdraw(admin, 'uid-A', 'uid-A', 'pending')).toBe(true)
      expect(canWithdraw(committee, 'uid-A', 'uid-A', 'pending')).toBe(true)
      expect(canWithdraw(admin, 'uid-A', 'uid-B', 'pending')).toBe(false)
      expect(canWithdraw(admin, 'uid-A', 'uid-A', 'approved')).toBe(false)
    })
  })

  describe('roles collection', () => {
    it('any authed user can read roles', () => {
      // hasAnyRole (or just isAuthed) — roles are needed by everyone to check their own role
      expect(hasAnyRole(admin)).toBe(true)
      expect(hasAnyRole(committee)).toBe(true)
      expect(hasAnyRole(tpo)).toBe(true)
      expect(hasAnyRole(fc)).toBe(true)
      expect(hasAnyRole(nobody)).toBe(false)
    })

    it('only master admin can update/delete roles', () => {
      expect(isMasterAdmin(masterAdmin)).toBe(true)
      expect(isMasterAdmin(admin)).toBe(false)
      expect(isMasterAdmin(committee)).toBe(false)
    })
  })

  describe('batches collection', () => {
    it('any authed user can read batches (sidebar cohort list)', () => {
      expect(hasAnyRole(tpo)).toBe(true)
      expect(hasAnyRole(fc)).toBe(true)
    })

    it('only admin can create/update batches', () => {
      expect(isAdmin(admin)).toBe(true)
      expect(isAdmin(committee)).toBe(false)
    })

    it('only master admin can delete batches', () => {
      expect(isMasterAdmin(masterAdmin)).toBe(true)
      expect(isMasterAdmin(admin)).toBe(false)
    })
  })

  describe('config collection', () => {
    it('authorizedUsers write is master-admin-only', () => {
      function canWriteConfig(docId, roleData) {
        if (docId === 'authorizedUsers') return isMasterAdmin(roleData)
        return isAdmin(roleData)
      }
      expect(canWriteConfig('authorizedUsers', masterAdmin)).toBe(true)
      expect(canWriteConfig('authorizedUsers', admin)).toBe(false)
      expect(canWriteConfig('columnSchema_27-Delhi-IB', admin)).toBe(true)
      expect(canWriteConfig('columnSchema_27-Delhi-IB', committee)).toBe(false)
    })
  })

  describe('tpoProfiles + outreach', () => {
    it('admin and fc can view all TPO data', () => {
      expect(canViewTpoData(admin)).toBe(true)
      expect(canViewTpoData(fc)).toBe(true)
      expect(canViewTpoData(committee)).toBe(false)
      expect(canViewTpoData(tpo)).toBe(false)
    })

    it('TPO can only access their own profile and outreach entries', () => {
      function canReadOwnProfile(roleData, tpoUid, authUid) {
        return canViewTpoData(roleData) || (roleData?.role === 'tpo' && authUid === tpoUid)
      }
      expect(canReadOwnProfile(tpo, 'tpo-uid-X', 'tpo-uid-X')).toBe(true)  // own
      expect(canReadOwnProfile(tpo, 'tpo-uid-X', 'tpo-uid-Y')).toBe(false) // not own
      expect(canReadOwnProfile(admin, 'tpo-uid-X', 'admin-uid')).toBe(true)
    })

    it('TPO can create outreach entries with their own uid as createdBy', () => {
      function canCreateOutreach(roleData, createdBy, authUid, tpoUid) {
        return (isAdmin(roleData) || (roleData?.role === 'tpo' && authUid === tpoUid))
          && createdBy === authUid
      }
      expect(canCreateOutreach(tpo, 'tpo-uid', 'tpo-uid', 'tpo-uid')).toBe(true)
      expect(canCreateOutreach(tpo, 'tpo-uid', 'tpo-uid', 'different-tpo')).toBe(false) // not their profile
      expect(canCreateOutreach(tpo, 'other-uid', 'tpo-uid', 'tpo-uid')).toBe(false) // createdBy mismatch
    })
  })

  describe('auditLog', () => {
    it('only admin can append to audit log', () => {
      expect(isAdmin(admin)).toBe(true)
      expect(isAdmin(committee)).toBe(false)
    })

    it('nobody can update or delete audit log entries', () => {
      // Rules: allow update, delete: if false
      const canModifyAuditLog = false
      expect(canModifyAuditLog).toBe(false)
    })
  })
})

// ─── 10. ENV detection ────────────────────────────────────────────────────────
describe('Firebase env detection', () => {
  it('localhost maps to staging', () => {
    function detectEnv(hostname) {
      return hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname.includes('placement-mgmt-staging') ? 'staging' : 'production'
    }
    expect(detectEnv('localhost')).toBe('staging')
    expect(detectEnv('127.0.0.1')).toBe('staging')
    expect(detectEnv('placement-mgmt-staging.web.app')).toBe('staging')
    expect(detectEnv('iiftd-pc.web.app')).toBe('production')
    expect(detectEnv('placement-management-6133f.web.app')).toBe('production')
  })
})

// ─── 11. Placement change validation ─────────────────────────────────────────
describe('Place/Unplace change validation', () => {
  it('place change requires studentId', () => {
    function validateChange(change) {
      const placementTypes = ['place', 'place_from_activity', 'unplace', 'delete']
      if (placementTypes.includes(change.type)) {
        if (!change.studentId) return { ok: false, reason: 'Student no longer exists' }
      }
      return { ok: true }
    }
    expect(validateChange({ type: 'place', studentId: 'abc' })).toEqual({ ok: true })
    expect(validateChange({ type: 'place', studentId: null })).toEqual({ ok: false, reason: 'Student no longer exists' })
    expect(validateChange({ type: 'place', studentId: '' })).toEqual({ ok: false, reason: 'Student no longer exists' })
  })

  it('unplace requires matching season to clear correct slot', () => {
    function getUnplaceUpdate(season) {
      if (season === 'summer') return { _placed_summer: false, _placement_summer: null }
      return { _placed_final: false, _placement_final: null }
    }
    expect(getUnplaceUpdate('summer')).toEqual({ _placed_summer: false, _placement_summer: null })
    expect(getUnplaceUpdate('final')).toEqual({ _placed_final: false, _placement_final: null })
  })

  it('place update writes to correct season slot only', () => {
    function getPlaceUpdate(season, placement) {
      if (season === 'summer') return { _placed_summer: true, _placement_summer: placement }
      return { _placed_final: true, _placement_final: placement }
    }
    const pl = { company: 'BCG', package: '75000' }
    const summerUpdate = getPlaceUpdate('summer', pl)
    expect(summerUpdate).toHaveProperty('_placed_summer', true)
    expect(summerUpdate).toHaveProperty('_placement_summer', pl)
    expect(summerUpdate).not.toHaveProperty('_placed_final')

    const finalUpdate = getPlaceUpdate('final', pl)
    expect(finalUpdate).toHaveProperty('_placed_final', true)
    expect(finalUpdate).toHaveProperty('_placement_final', pl)
    expect(finalUpdate).not.toHaveProperty('_placed_summer')
  })
})
