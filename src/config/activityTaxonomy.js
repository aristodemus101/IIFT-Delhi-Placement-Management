import { CalendarClock, FlaskConical, GraduationCap, Trophy } from 'lucide-react'

export const ACTIVITY_TYPE_OPTIONS = ['Hiring', 'Case Comp', 'Live Project', 'Campus Engagement']

export const CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS = [
  'Guest Lecture',
  'Workshop',
  'Webinar',
  'Alumni Session',
  'Company Visit',
  'Panel Discussion',
  'Seminar',
  'Conference',
  'Networking Session',
  'Competition',
  'Other',
]

// Via = how the student got the offer (on placement record). Not the opp type.
export const VIA_OPTIONS = ['PPO', 'Referral', 'Direct']

export const ACTIVITY_TYPE_META = {
  'Hiring':           { icon: GraduationCap, color: 'green',  label: 'Hiring' },
  'Case Comp':        { icon: Trophy,        color: 'amber',  label: 'Case Comp' },
  'Live Project':     { icon: FlaskConical,  color: 'purple', label: 'Live Project' },
  'Campus Engagement':{ icon: CalendarClock, color: 'gray',   label: 'Campus Engagement' },
}

// Fields only relevant to Hiring / Live Project (not Case Comp or Campus Engagement)
export function typeIsHiringDrive(type) {
  const t = normalizeActivityType(type)
  return t === 'Hiring' || t === 'Live Project'
}

// Via (PPO/Referral/Direct) is only relevant on Hiring / Live Project
export function typeHasVia(type) {
  return typeIsHiringDrive(type)
}

// Subtype is only relevant for Campus Engagement
export function typeHasSubtype(type) {
  return normalizeActivityType(type) === 'Campus Engagement'
}

// Case Comp-specific fields (tracks, prize, team_size)
export function typeIsCaseComp(type) {
  return normalizeActivityType(type) === 'Case Comp'
}

const TYPE_ALIASES = new Map([
  ['sip hiring',        'Hiring'],
  ['placement',         'Hiring'],
  ['internship',        'Hiring'],
  ['case competition',  'Case Comp'],
  ['case comp',         'Case Comp'],
  ['competition',       'Case Comp'],
  ['hackathon',         'Case Comp'],
  ['challenge',         'Case Comp'],
  ['event',             'Campus Engagement'],
  ['ppt',               'Campus Engagement'],
  ['guest lecture',     'Campus Engagement'],
  ['workshop',          'Campus Engagement'],
  ['webinar',           'Campus Engagement'],
  ['alumni talk',       'Campus Engagement'],
  ['alumni session',    'Campus Engagement'],
  ['company visit',     'Campus Engagement'],
  ['panel discussion',  'Campus Engagement'],
  ['seminar',           'Campus Engagement'],
  ['conference',        'Campus Engagement'],
  ['networking session','Campus Engagement'],
])

const SUBTYPE_ALIASES = new Map([
  ['guest talk',        'Guest Lecture'],
  ['guest lecture',     'Guest Lecture'],
  ['lecture',           'Guest Lecture'],
  ['workshop',          'Workshop'],
  ['webinar',           'Webinar'],
  ['alumni talk',       'Alumni Session'],
  ['alumni session',    'Alumni Session'],
  ['company visit',     'Company Visit'],
  ['industry visit',    'Company Visit'],
  ['panel discussion',  'Panel Discussion'],
  ['seminar',           'Seminar'],
  ['conference',        'Conference'],
  ['networking session','Networking Session'],
])

export function normalizeActivityType(type, via) {
  const raw = String(type || '').trim()
  if (!raw) return 'Hiring'

  if (ACTIVITY_TYPE_OPTIONS.includes(raw)) return raw

  // Backwards-compat: old docs stored type='Hiring', via='Case Comp'
  if (String(via || '').trim() === 'Case Comp') return 'Case Comp'

  const alias = TYPE_ALIASES.get(raw.toLowerCase())
  if (alias) return alias

  if (raw.toLowerCase().includes('live project')) return 'Live Project'
  if (raw.toLowerCase().includes('case')) return 'Case Comp'
  return 'Hiring'
}

export function normalizeCampusEngagementSubtype(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS.includes(raw)) return raw
  const alias = SUBTYPE_ALIASES.get(raw.toLowerCase())
  if (alias) return alias
  return 'Other'
}

export function inferCampusEngagementSubtype(text) {
  const raw = String(text || '').toLowerCase()
  for (const [needle, subtype] of SUBTYPE_ALIASES.entries()) {
    if (raw.includes(needle)) return subtype
  }
  return ''
}

export function getActivityTypeMeta(type, via) {
  return ACTIVITY_TYPE_META[normalizeActivityType(type, via)] || ACTIVITY_TYPE_META.Hiring
}

export function getActivityDisplayLabel(opp) {
  const type = normalizeActivityType(opp?.type, opp?.via)
  if (type === 'Campus Engagement') {
    const subtype = normalizeCampusEngagementSubtype(opp?.subtype)
    return subtype ? `${type} · ${subtype}` : type
  }
  if (type === 'Hiring' && opp?.via) return `${type} · via ${opp.via}`
  return type
}

export function getActivityAnnouncementHeader(opp) {
  const type = normalizeActivityType(opp?.type, opp?.via)
  const subject = String(opp?.organization || opp?.title || 'Opportunity').trim()

  if (type === 'Case Comp') return `Case Comp | ${subject}`

  if (type === 'Campus Engagement') {
    const subtype = normalizeCampusEngagementSubtype(opp?.subtype)
    return `${subtype || 'Campus Engagement'} | ${subject}`
  }

  if (type === 'Live Project') return `Live Project | ${subject}`

  if (type === 'Hiring') {
    const applicability = String(opp?.applicability || 'both').toLowerCase()
    if (applicability === 'summer') return `SIP Opportunity | ${subject}`
    if (applicability === 'final') return `Final Opportunity | ${subject}`
    return `Placement Opportunity | ${subject}`
  }

  return `Opportunity | ${subject}`
}
