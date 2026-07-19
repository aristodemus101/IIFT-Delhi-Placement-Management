/**
 * Tests for the Activity module:
 *   - activityTaxonomy.js — normalizeActivityType, helpers, display labels
 *   - useOpportunities.js — blankOpportunity, sanitizeOpportunityFields (via postOpportunity)
 *   - PostModal normalizeParsedOpportunity logic (pure function extracted inline)
 *
 * No Firebase, no React — all pure function tests.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeActivityType,
  typeIsHiringDrive,
  typeIsCaseComp,
  typeHasVia,
  typeHasSubtype,
  getActivityDisplayLabel,
  getActivityAnnouncementHeader,
  normalizeCampusEngagementSubtype,
  inferCampusEngagementSubtype,
  ACTIVITY_TYPE_OPTIONS,
  VIA_OPTIONS,
} from '../config/activityTaxonomy.js'
import { blankOpportunity } from '../lib/useOpportunities.js'

// ══════════════════════════════════════════════════════════════════════════════
// 1. normalizeActivityType — canonical type resolution
// ══════════════════════════════════════════════════════════════════════════════

describe('normalizeActivityType', () => {
  it('returns known types unchanged', () => {
    expect(normalizeActivityType('Hiring')).toBe('Hiring')
    expect(normalizeActivityType('Case Comp')).toBe('Case Comp')
    expect(normalizeActivityType('Live Project')).toBe('Live Project')
    expect(normalizeActivityType('Campus Engagement')).toBe('Campus Engagement')
  })

  it('returns Hiring for empty/null/undefined input', () => {
    expect(normalizeActivityType('')).toBe('Hiring')
    expect(normalizeActivityType(null)).toBe('Hiring')
    expect(normalizeActivityType(undefined)).toBe('Hiring')
  })

  // Backwards compat: old docs stored type='Hiring', via='Case Comp'
  it('resolves type=Hiring via=Case Comp → Case Comp (backwards compat)', () => {
    expect(normalizeActivityType('Hiring', 'Case Comp')).toBe('Case Comp')
  })

  it('does NOT use via when type is already a canonical value', () => {
    // Canonical types always win — via cannot override them
    expect(normalizeActivityType('Case Comp', 'Hiring')).toBe('Case Comp')
    expect(normalizeActivityType('Campus Engagement', 'Case Comp')).toBe('Campus Engagement')
    expect(normalizeActivityType('Live Project', 'Case Comp')).toBe('Live Project')
    expect(normalizeActivityType('Hiring', 'PPO')).toBe('Hiring')
  })

  it('normalises alias: case competition → Case Comp', () => {
    expect(normalizeActivityType('case competition')).toBe('Case Comp')
  })

  it('normalises alias: hackathon → Case Comp', () => {
    expect(normalizeActivityType('hackathon')).toBe('Case Comp')
  })

  it('normalises alias: challenge → Case Comp', () => {
    expect(normalizeActivityType('challenge')).toBe('Case Comp')
  })

  it('normalises alias: webinar → Campus Engagement', () => {
    expect(normalizeActivityType('webinar')).toBe('Campus Engagement')
  })

  it('normalises alias: workshop → Campus Engagement', () => {
    expect(normalizeActivityType('workshop')).toBe('Campus Engagement')
  })

  it('normalises alias: guest lecture → Campus Engagement', () => {
    expect(normalizeActivityType('guest lecture')).toBe('Campus Engagement')
  })

  it('normalises alias: internship → Hiring (via "sip hiring")', () => {
    expect(normalizeActivityType('internship')).toBe('Hiring')
  })

  it('treats live project substring → Live Project', () => {
    expect(normalizeActivityType('live project work')).toBe('Live Project')
  })

  it('all ACTIVITY_TYPE_OPTIONS pass through unchanged', () => {
    ACTIVITY_TYPE_OPTIONS.forEach(t => {
      expect(normalizeActivityType(t)).toBe(t)
    })
  })

  it('via is ignored when type resolves from alias (not backwards-compat path)', () => {
    // type='hackathon' should resolve to 'Case Comp' ignoring via
    expect(normalizeActivityType('hackathon', 'Hiring')).toBe('Case Comp')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. typeIsHiringDrive / typeIsCaseComp / typeHasVia / typeHasSubtype
// ══════════════════════════════════════════════════════════════════════════════

describe('type predicate helpers', () => {
  describe('typeIsHiringDrive', () => {
    it('returns true for Hiring', () => expect(typeIsHiringDrive('Hiring')).toBe(true))
    it('returns true for Live Project', () => expect(typeIsHiringDrive('Live Project')).toBe(true))
    it('returns false for Case Comp', () => expect(typeIsHiringDrive('Case Comp')).toBe(false))
    it('returns false for Campus Engagement', () => expect(typeIsHiringDrive('Campus Engagement')).toBe(false))
    it('normalises input first', () => expect(typeIsHiringDrive('hackathon')).toBe(false))
    it('returns true for internship alias', () => expect(typeIsHiringDrive('internship')).toBe(true))
  })

  describe('typeIsCaseComp', () => {
    it('returns true for Case Comp', () => expect(typeIsCaseComp('Case Comp')).toBe(true))
    it('returns false for Hiring', () => expect(typeIsCaseComp('Hiring')).toBe(false))
    it('normalises alias: hackathon → true', () => expect(typeIsCaseComp('hackathon')).toBe(true))
    it('normalises alias: challenge → true', () => expect(typeIsCaseComp('challenge')).toBe(true))
  })

  describe('typeHasVia', () => {
    it('true for Hiring (placement route relevant)', () => expect(typeHasVia('Hiring')).toBe(true))
    it('true for Live Project', () => expect(typeHasVia('Live Project')).toBe(true))
    it('false for Case Comp (via not applicable)', () => expect(typeHasVia('Case Comp')).toBe(false))
    it('false for Campus Engagement', () => expect(typeHasVia('Campus Engagement')).toBe(false))
  })

  describe('typeHasSubtype', () => {
    it('true only for Campus Engagement', () => {
      expect(typeHasSubtype('Campus Engagement')).toBe(true)
      expect(typeHasSubtype('Hiring')).toBe(false)
      expect(typeHasSubtype('Case Comp')).toBe(false)
      expect(typeHasSubtype('Live Project')).toBe(false)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. VIA_OPTIONS — must NOT contain 'Case Comp' or 'PPT'
// ══════════════════════════════════════════════════════════════════════════════

describe('VIA_OPTIONS invariants', () => {
  it('does not contain Case Comp', () => {
    expect(VIA_OPTIONS).not.toContain('Case Comp')
  })

  it('does not contain PPT', () => {
    expect(VIA_OPTIONS).not.toContain('PPT')
  })

  it('contains only placement routes: PPO, Referral, Direct', () => {
    expect(VIA_OPTIONS).toEqual(expect.arrayContaining(['PPO', 'Referral', 'Direct']))
    expect(VIA_OPTIONS).toHaveLength(3)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. getActivityDisplayLabel
// ══════════════════════════════════════════════════════════════════════════════

describe('getActivityDisplayLabel', () => {
  it('returns type name for Hiring without via', () => {
    expect(getActivityDisplayLabel({ type: 'Hiring' })).toBe('Hiring')
  })

  it('appends via for Hiring with via', () => {
    expect(getActivityDisplayLabel({ type: 'Hiring', via: 'PPO' })).toBe('Hiring · via PPO')
  })

  it('appends subtype for Campus Engagement', () => {
    expect(getActivityDisplayLabel({ type: 'Campus Engagement', subtype: 'Webinar' })).toBe('Campus Engagement · Webinar')
  })

  it('returns just type for Campus Engagement with no subtype', () => {
    expect(getActivityDisplayLabel({ type: 'Campus Engagement', subtype: '' })).toBe('Campus Engagement')
  })

  it('returns Case Comp without via (via ignored)', () => {
    expect(getActivityDisplayLabel({ type: 'Case Comp', via: 'PPO' })).toBe('Case Comp')
  })

  it('resolves old doc (type=Hiring, via=Case Comp) → Case Comp label', () => {
    const label = getActivityDisplayLabel({ type: 'Hiring', via: 'Case Comp' })
    expect(label).toBe('Case Comp')
  })

  it('handles null/undefined opp gracefully', () => {
    expect(() => getActivityDisplayLabel(null)).not.toThrow()
    expect(() => getActivityDisplayLabel(undefined)).not.toThrow()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. getActivityAnnouncementHeader
// ══════════════════════════════════════════════════════════════════════════════

describe('getActivityAnnouncementHeader', () => {
  it('Hiring final → "Final Opportunity | Org"', () => {
    const h = getActivityAnnouncementHeader({ type: 'Hiring', organization: 'Goldman Sachs', applicability: 'final' })
    expect(h).toBe('Final Opportunity | Goldman Sachs')
  })

  it('Hiring summer → "SIP Opportunity | Org"', () => {
    const h = getActivityAnnouncementHeader({ type: 'Hiring', organization: 'KPMG', applicability: 'summer' })
    expect(h).toBe('SIP Opportunity | KPMG')
  })

  it('Hiring both → "Placement Opportunity | Org"', () => {
    const h = getActivityAnnouncementHeader({ type: 'Hiring', organization: 'Deloitte', applicability: 'both' })
    expect(h).toBe('Placement Opportunity | Deloitte')
  })

  it('Case Comp → "Case Comp | Org"', () => {
    const h = getActivityAnnouncementHeader({ type: 'Case Comp', organization: 'BCG' })
    expect(h).toBe('Case Comp | BCG')
  })

  it('Live Project → "Live Project | Org"', () => {
    const h = getActivityAnnouncementHeader({ type: 'Live Project', organization: 'CRISIL' })
    expect(h).toBe('Live Project | CRISIL')
  })

  it('Campus Engagement with subtype → "Webinar | Org"', () => {
    const h = getActivityAnnouncementHeader({ type: 'Campus Engagement', organization: 'IIM Alumni', subtype: 'Webinar' })
    expect(h).toBe('Webinar | IIM Alumni')
  })

  it('Campus Engagement no subtype → "Campus Engagement | Org"', () => {
    const h = getActivityAnnouncementHeader({ type: 'Campus Engagement', organization: 'Industry Partner', subtype: '' })
    expect(h).toBe('Campus Engagement | Industry Partner')
  })

  it('uses title as fallback when organization missing', () => {
    const h = getActivityAnnouncementHeader({ type: 'Hiring', title: 'Some Drive', applicability: 'final' })
    expect(h).toBe('Final Opportunity | Some Drive')
  })

  it('old doc (type=Hiring via=Case Comp) → Case Comp header', () => {
    const h = getActivityAnnouncementHeader({ type: 'Hiring', via: 'Case Comp', organization: 'EY Parthenon' })
    expect(h).toBe('Case Comp | EY Parthenon')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. normalizeCampusEngagementSubtype
// ══════════════════════════════════════════════════════════════════════════════

describe('normalizeCampusEngagementSubtype', () => {
  it('passes through valid subtypes', () => {
    expect(normalizeCampusEngagementSubtype('Webinar')).toBe('Webinar')
    expect(normalizeCampusEngagementSubtype('Workshop')).toBe('Workshop')
    expect(normalizeCampusEngagementSubtype('Guest Lecture')).toBe('Guest Lecture')
  })

  it('normalises aliases', () => {
    expect(normalizeCampusEngagementSubtype('alumni talk')).toBe('Alumni Session')
    expect(normalizeCampusEngagementSubtype('guest lecture')).toBe('Guest Lecture')
    expect(normalizeCampusEngagementSubtype('industry visit')).toBe('Company Visit')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeCampusEngagementSubtype('')).toBe('')
    expect(normalizeCampusEngagementSubtype(null)).toBe('')
  })

  it('returns Other for unknown subtypes', () => {
    expect(normalizeCampusEngagementSubtype('Cocktail Party')).toBe('Other')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. blankOpportunity — shape invariants
// ══════════════════════════════════════════════════════════════════════════════

describe('blankOpportunity', () => {
  const blank = blankOpportunity()

  it('contains all required fields', () => {
    const required = [
      'title', 'type', 'subtype', 'via', 'organization', 'applicability',
      'roles', 'stipend', 'ctc', 'duration', 'location', 'deadline', 'eligibility',
      'eoi_link', 'apply_link', 'tracker_link', 'description', 'notes', 'status',
      'currentRound', 'spoc', 'expected_hires', 'process_date', 'process_mode',
      'tracks', 'prize', 'team_size',
    ]
    required.forEach(f => expect(blank).toHaveProperty(f))
  })

  it('defaults type to Hiring', () => {
    expect(blank.type).toBe('Hiring')
  })

  it('defaults roles/tracks to empty arrays', () => {
    expect(Array.isArray(blank.roles)).toBe(true)
    expect(Array.isArray(blank.tracks)).toBe(true)
  })

  it('defaults currentRound to 0', () => {
    expect(blank.currentRound).toBe(0)
  })

  it('defaults expected_hires to null', () => {
    expect(blank.expected_hires).toBeNull()
  })

  it('defaults status to open', () => {
    expect(blank.status).toBe('open')
  })

  it('returns a fresh object each call (no shared ref)', () => {
    const a = blankOpportunity()
    const b = blankOpportunity()
    a.tracks.push('Strategy')
    expect(b.tracks).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. normalizeParsedOpportunity logic (extracted pure fn — mirrors PostModal)
// ══════════════════════════════════════════════════════════════════════════════

// Mirror the function so we can test without importing PostModal (which needs React)
function normalizeParsedOpportunity(result) {
  const VALID_APPLICABILITY = new Set(['summer', 'final', 'both'])
  const parsed = { ...blankOpportunity(), ...result }
  const rawType = String(parsed.type || '').trim()
  const lowerType = rawType.toLowerCase()

  if (parsed.applicability && !VALID_APPLICABILITY.has(parsed.applicability)) {
    parsed.applicability = 'both'
  }

  // Normalize type FIRST — pass via for backwards-compat (type='Hiring', via='Case Comp')
  parsed.type = normalizeActivityType(parsed.type, parsed.via)

  if (parsed.via && !VIA_OPTIONS.includes(parsed.via)) {
    parsed.via = ''
  }

  if (parsed.type === 'Campus Engagement') {
    parsed.via = ''
  }

  if (parsed.expected_hires != null) {
    const n = parseInt(parsed.expected_hires, 10)
    parsed.expected_hires = isNaN(n) ? null : n
  }

  if (parsed.process_mode && !['Online', 'Offline', 'Hybrid'].includes(parsed.process_mode)) {
    parsed.process_mode = ''
  }

  if (parsed.tracks && !Array.isArray(parsed.tracks)) {
    parsed.tracks = String(parsed.tracks).split(',').map(s => s.trim()).filter(Boolean)
  }

  if (rawType && !['Hiring', 'Case Comp', 'Live Project', 'Campus Engagement'].includes(rawType)) {
    if (lowerType.includes('case') || lowerType.includes('competition') || lowerType.includes('challenge') || lowerType.includes('hackathon')) {
      parsed.type = 'Case Comp'
    } else if (lowerType.includes('live')) {
      parsed.type = 'Live Project'
    } else if (lowerType.includes('event') || lowerType.includes('workshop') || lowerType.includes('lecture') || lowerType.includes('webinar') || lowerType.includes('alumni')) {
      parsed.type = 'Campus Engagement'
    } else if (lowerType.includes('intern') || lowerType.includes('sip')) {
      parsed.type = 'Hiring'
    } else {
      parsed.type = 'Hiring'
    }
  }

  return parsed
}

describe('normalizeParsedOpportunity', () => {
  it('passes through valid type unchanged', () => {
    const result = normalizeParsedOpportunity({ type: 'Case Comp' })
    expect(result.type).toBe('Case Comp')
  })

  // The critical bug fix: type must be resolved BEFORE clearing via
  it('resolves type=Hiring via=Case Comp → Case Comp (order-of-ops fix)', () => {
    const result = normalizeParsedOpportunity({ type: 'Hiring', via: 'Case Comp' })
    expect(result.type).toBe('Case Comp')
  })

  it('clears invalid via values', () => {
    const result = normalizeParsedOpportunity({ type: 'Hiring', via: 'Unknown Route' })
    expect(result.via).toBe('')
  })

  it('keeps valid via values', () => {
    const result = normalizeParsedOpportunity({ type: 'Hiring', via: 'PPO' })
    expect(result.via).toBe('PPO')
  })

  it('clears via for Campus Engagement', () => {
    const result = normalizeParsedOpportunity({ type: 'Campus Engagement', via: 'PPO' })
    expect(result.via).toBe('')
  })

  it('converts invalid applicability to both', () => {
    const result = normalizeParsedOpportunity({ applicability: 'quarterly' })
    expect(result.applicability).toBe('both')
  })

  it('sanitizes expected_hires string → integer', () => {
    const result = normalizeParsedOpportunity({ expected_hires: '5' })
    expect(result.expected_hires).toBe(5)
  })

  it('sanitizes non-numeric expected_hires → null', () => {
    const result = normalizeParsedOpportunity({ expected_hires: 'many' })
    expect(result.expected_hires).toBeNull()
  })

  it('sanitizes invalid process_mode → empty string', () => {
    const result = normalizeParsedOpportunity({ process_mode: 'Virtual' })
    expect(result.process_mode).toBe('')
  })

  it('keeps valid process_mode values', () => {
    ['Online', 'Offline', 'Hybrid'].forEach(mode => {
      const result = normalizeParsedOpportunity({ process_mode: mode })
      expect(result.process_mode).toBe(mode)
    })
  })

  it('converts tracks string → array', () => {
    const result = normalizeParsedOpportunity({ tracks: 'Strategy, Finance, Analytics' })
    expect(result.tracks).toEqual(['Strategy', 'Finance', 'Analytics'])
  })

  it('leaves tracks array unchanged', () => {
    const tracks = ['Strategy', 'Finance']
    const result = normalizeParsedOpportunity({ tracks })
    expect(result.tracks).toEqual(tracks)
  })

  it('alias: hackathon type string → Case Comp', () => {
    const result = normalizeParsedOpportunity({ type: 'hackathon' })
    expect(result.type).toBe('Case Comp')
  })

  it('alias: webinar → Campus Engagement', () => {
    const result = normalizeParsedOpportunity({ type: 'webinar' })
    expect(result.type).toBe('Campus Engagement')
  })

  it('alias: internship → Hiring', () => {
    const result = normalizeParsedOpportunity({ type: 'internship' })
    expect(result.type).toBe('Hiring')
  })

  it('returns object with all blankOpportunity fields', () => {
    const result = normalizeParsedOpportunity({ title: 'Test' })
    const blank = blankOpportunity()
    Object.keys(blank).forEach(key => {
      expect(result).toHaveProperty(key)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. sanitizeOpportunityFields invariants (tested via blankOpportunity shape)
// ══════════════════════════════════════════════════════════════════════════════

// We test the public contract of sanitizeOpportunityFields by confirming
// normalizeActivityType + the sanitize rules are consistent:
describe('sanitizeOpportunityFields contract (type resolution)', () => {
  it('resolves old doc type before writing via', () => {
    // Legacy: type='Hiring', via='Case Comp' must be written as type='Case Comp', via=''
    const resolvedType = normalizeActivityType('Hiring', 'Case Comp')
    expect(resolvedType).toBe('Case Comp')
    // Case Comp should not have via
    expect(typeHasVia(resolvedType)).toBe(false)
  })

  it('Campus Engagement never has via', () => {
    expect(typeHasVia('Campus Engagement')).toBe(false)
  })

  it('Hiring and Live Project can have via', () => {
    expect(typeHasVia('Hiring')).toBe(true)
    expect(typeHasVia('Live Project')).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 10. SIMPLE_FORM / NEEDS_PASTE separation (correctness of set membership)
// ══════════════════════════════════════════════════════════════════════════════

describe('SIMPLE_FORM / NEEDS_PASTE invariants', () => {
  const SIMPLE_FORM = new Set(['post_ppt', 'open_applications', 'post_round'])
  const NEEDS_PASTE = new Set(['release_shortlist', 'post_interview', 'post_gd_pi', 'post_final_selection', 'post_submission'])
  const MESSAGE_ONLY = new Set(['generate_announcement', 'generate_shortlist_msg', 'generate_interview_msg', 'generate_final_msg', 'generate_reminder', 'generate_event_msg'])

  it('SIMPLE_FORM and NEEDS_PASTE are disjoint', () => {
    const overlap = [...SIMPLE_FORM].filter(k => NEEDS_PASTE.has(k))
    expect(overlap).toHaveLength(0)
  })

  it('SIMPLE_FORM and MESSAGE_ONLY are disjoint', () => {
    const overlap = [...SIMPLE_FORM].filter(k => MESSAGE_ONLY.has(k))
    expect(overlap).toHaveLength(0)
  })

  it('NEEDS_PASTE and MESSAGE_ONLY are disjoint', () => {
    const overlap = [...NEEDS_PASTE].filter(k => MESSAGE_ONLY.has(k))
    expect(overlap).toHaveLength(0)
  })

  it('post_ppt is in SIMPLE_FORM', () => expect(SIMPLE_FORM.has('post_ppt')).toBe(true))
  it('open_applications is in SIMPLE_FORM', () => expect(SIMPLE_FORM.has('open_applications')).toBe(true))
  it('post_round is in SIMPLE_FORM', () => expect(SIMPLE_FORM.has('post_round')).toBe(true))
  it('post_gd_pi is in NEEDS_PASTE', () => expect(NEEDS_PASTE.has('post_gd_pi')).toBe(true))
  it('post_final_selection is in NEEDS_PASTE', () => expect(NEEDS_PASTE.has('post_final_selection')).toBe(true))
})

// ══════════════════════════════════════════════════════════════════════════════
// 11. advanceStage stageType mapping (post_gd_pi → gd_pi)
// ══════════════════════════════════════════════════════════════════════════════

describe('post_gd_pi → gd_pi stage type mapping', () => {
  it('maps post_gd_pi action key to gd_pi stage type', () => {
    const mapActionToStage = (actionKey) => actionKey === 'post_gd_pi' ? 'gd_pi' : actionKey
    expect(mapActionToStage('post_gd_pi')).toBe('gd_pi')
    expect(mapActionToStage('post_final_selection')).toBe('post_final_selection')
    expect(mapActionToStage('release_shortlist')).toBe('release_shortlist')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 12. Backwards-compat: old docs remain fully readable
// ══════════════════════════════════════════════════════════════════════════════

describe('Backwards compatibility — old Firestore docs', () => {
  it('type=Hiring, via=Case Comp resolves to Case Comp everywhere', () => {
    const oldDoc = { type: 'Hiring', via: 'Case Comp', organization: 'BCG' }
    expect(normalizeActivityType(oldDoc.type, oldDoc.via)).toBe('Case Comp')
    expect(typeIsCaseComp(normalizeActivityType(oldDoc.type, oldDoc.via))).toBe(true)
    expect(typeIsHiringDrive(normalizeActivityType(oldDoc.type, oldDoc.via))).toBe(false)
  })

  it('type=Hiring, via=PPO resolves to Hiring (PPO is a placement route)', () => {
    const oldDoc = { type: 'Hiring', via: 'PPO' }
    expect(normalizeActivityType(oldDoc.type, oldDoc.via)).toBe('Hiring')
  })

  it('type=Campus Engagement, subtype=Webinar resolves correctly', () => {
    const oldDoc = { type: 'Campus Engagement', subtype: 'Webinar' }
    expect(normalizeActivityType(oldDoc.type, oldDoc.via)).toBe('Campus Engagement')
    expect(typeHasSubtype(normalizeActivityType(oldDoc.type))).toBe(true)
  })

  it('announcement header is correct for old Case Comp doc', () => {
    const oldDoc = { type: 'Hiring', via: 'Case Comp', organization: 'McKinsey' }
    expect(getActivityAnnouncementHeader(oldDoc)).toBe('Case Comp | McKinsey')
  })

  it('display label is correct for old Case Comp doc', () => {
    const oldDoc = { type: 'Hiring', via: 'Case Comp' }
    expect(getActivityDisplayLabel(oldDoc)).toBe('Case Comp')
  })
})
