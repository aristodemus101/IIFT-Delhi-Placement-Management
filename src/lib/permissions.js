// Central permissions definition.
// PAGE_ACCESS and FIELD_DEFAULTS are the hardcoded minimums.
// Master admin can FURTHER restrict field visibility via Firestore config
// (they can hide fields from committee but never from admin).

// ── Page access ──────────────────────────────────────────────────────────────
// Which roles can access each route
export const PAGE_ACCESS = {
  dashboard:  ['admin', 'committee'],
  roster:     ['admin', 'committee'],
  placed:     ['admin', 'committee'],
  activity:   ['admin', 'committee'],
  analytics:  ['admin', 'committee', 'faculty_coordinator'],
  remapper:   ['admin', 'committee'],
  approvals:  ['admin'],
  admin:      ['admin'],
  tpo:        ['admin', 'tpo', 'faculty_coordinator'],
}

// ── Action permissions ────────────────────────────────────────────────────────
export const ACTION_ACCESS = {
  proposePlace:       ['admin', 'committee'],
  proposeUnplace:     ['admin', 'committee'],
  proposeDelete:      ['admin', 'committee'],
  proposeImport:      ['admin'],
  proposeClearAll:    ['admin'],
  approveChange:      ['admin'],
  manageRoles:        ['admin'],
  manageCohorts:      ['admin'],
  exportData:         ['admin', 'committee'],
  viewFullRoster:     ['admin', 'committee'],
  writeTpoOutreach:   ['admin', 'tpo'],
  viewAllTpoData:     ['admin', 'faculty_coordinator'],
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
  admin:               'Admin',
  committee:           'Committee Member',
  tpo:                 'TPO',
  faculty_coordinator: 'Faculty Coordinator',
}

export const ROLES = ['admin', 'committee', 'tpo', 'faculty_coordinator']

// ── Page & Action labels (for Admin UI) ───────────────────────────────────────
export const PAGE_LABELS = {
  dashboard: 'Dashboard',
  roster:    'Roster (view)',
  placed:    'Placed Students',
  activity:  'Activity (Opportunities)',
  analytics: 'Analytics',
  remapper:  'Column Remapper',
  approvals: 'Approvals',
  tpo:       'TPO Outreach',
}

export const ACTION_LABELS = {
  proposePlace:    'Propose: Mark Placed',
  proposeUnplace:  'Propose: Unplace Student',
  proposeDelete:   'Propose: Delete Student',
  proposeImport:   'Propose: Import Students',
  proposeClearAll: 'Propose: Clear All Students',
  exportData:      'Export Data (CSV)',
  viewAllTpoData:  'View All TPO Outreach',
}

// Which pages/actions are configurable (admin access is always locked; tpo/fc fixed roles excluded)
export const CONFIGURABLE_PAGES   = ['dashboard', 'roster', 'placed', 'activity', 'analytics', 'remapper', 'approvals', 'tpo']
export const CONFIGURABLE_ACTIONS = ['proposePlace', 'proposeUnplace', 'proposeDelete', 'proposeImport', 'proposeClearAll', 'exportData', 'viewAllTpoData']

// Roles that can be toggled in the permission grid (admin is always locked on)
export const CONFIGURABLE_ROLES = ['committee', 'faculty_coordinator', 'tpo']

