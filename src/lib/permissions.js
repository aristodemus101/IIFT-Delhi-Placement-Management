// Central permissions definition.
// PAGE_ACCESS and FIELD_DEFAULTS are the hardcoded minimums.
// Master admin can FURTHER restrict field visibility via Firestore config
// (they can hide fields from committee/viewer but never from admin).

// ── Page access ──────────────────────────────────────────────────────────────
// Which roles can access each route
export const PAGE_ACCESS = {
  dashboard:  ['admin', 'committee', 'viewer'],
  roster:     ['admin', 'committee', 'viewer'],
  placed:     ['admin', 'committee'],           // viewers blocked
  activity:   ['admin', 'committee', 'viewer'],
  analytics:  ['admin', 'committee'],           // viewers blocked
  remapper:   ['admin', 'committee', 'viewer'],
  approvals:  ['admin'],
  admin:      ['admin'],
}

// ── Action permissions ────────────────────────────────────────────────────────
export const ACTION_ACCESS = {
  proposePlace:   ['admin'],
  proposeUnplace: ['admin'],
  proposeDelete:  ['admin'],
  proposeImport:  ['admin'],
  proposeClearAll:['admin'],
  approveChange:  ['admin'],
  manageRoles:    ['admin'],
  manageCohorts:  ['admin'],
  exportData:     ['admin', 'committee'],
  viewFullRoster: ['admin', 'committee', 'viewer'],
}

// ── Field-level defaults ──────────────────────────────────────────────────────
// Maps field key → roles that can see it.
// Master admin can only restrict these further (not grant more than admin).
export const FIELD_DEFAULTS = {
  ctc:            ['admin'],            // Final placement CTC
  stipend:        ['admin'],            // Summer stipend
  _placement_final:   ['admin', 'committee'],   // Company + role on Placed page
  _placement_summer:  ['admin', 'committee'],
}

// Fields the master admin is allowed to toggle visibility for
export const CONFIGURABLE_FIELDS = [
  { key: 'ctc',             label: 'CTC (final placement)',      defaultRoles: ['admin'] },
  { key: 'stipend',         label: 'Stipend (summer)',            defaultRoles: ['admin'] },
  { key: '_placement_final',  label: 'Placed company / role (Final)', defaultRoles: ['admin', 'committee'] },
  { key: '_placement_summer', label: 'Placed company / role (Summer)',defaultRoles: ['admin', 'committee'] },
]

// ── Role labels ───────────────────────────────────────────────────────────────
export const ROLE_LABELS = {
  admin:     'Admin',
  committee: 'Committee Member',
  viewer:    'Viewer',
}

export const ROLES = ['admin', 'committee', 'viewer']

// ── Helper ────────────────────────────────────────────────────────────────────
export function canAccess(page, role) {
  return (PAGE_ACCESS[page] || []).includes(role)
}

export function canDo(action, role) {
  return (ACTION_ACCESS[action] || []).includes(role)
}
