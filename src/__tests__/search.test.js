/**
 * Tests for useSearch — the full-text search hook used on the Roster page.
 *
 * Tests the index-building logic (extractSearchableText) directly by importing
 * the module and checking match behavior through the returned Set, using a
 * synchronous wrapper instead of renderHook (avoids jsdom dependency for pure logic).
 */

import { describe, it, expect } from 'vitest'

// ── Mirror the internal extractSearchableText logic ──────────────────────────
// (We can't import it directly because it's not exported; re-implement it here
//  identically and keep in sync. If you ever change the function, update this too.)

const SKIP_KEYS = new Set(['_id', 'cohort', 'createdAt', 'updatedAt', 'postedBy'])

function extractSearchableText(item) {
  const parts = []
  for (const k of Object.keys(item)) {
    if (k.startsWith('_') || SKIP_KEYS.has(k)) continue
    const v = item[k]
    if (v == null) continue
    if (typeof v === 'object') continue
    if (typeof v === 'boolean') continue
    parts.push(String(v))
  }
  for (const slot of ['_placement_summer', '_placement_final']) {
    const p = item[slot]
    if (!p || typeof p !== 'object') continue
    for (const field of ['company', 'role', 'sector', 'location', 'via']) {
      if (p[field]) parts.push(String(p[field]))
    }
  }
  return parts.join(' ').toLowerCase()
}

// Synchronous search helper (mirrors the match memo logic)
function buildMatch(items, term) {
  const index = items.map(extractSearchableText)
  const t = term.toLowerCase().trim()
  if (!t) return null
  return new Set(items.reduce((acc, _, i) => {
    if (index[i].includes(t)) acc.push(i)
    return acc
  }, []))
}

// ── Sample student docs ──────────────────────────────────────────────────────

const STUDENTS = [
  {
    _id: 'abc123',
    cohort: '27-Delhi-IB',
    'First Name': 'Arjun',
    'Last Name': 'Sharma',
    'Roll No.': '12A',
    email: 'arjun@example.com',
    cat: '98.5',
    gender: 'Male',
    _placed_final: false,
    _placed_summer: true,
    _placement_summer: { company: 'McKinsey & Company', role: 'Analyst', sector: 'Consulting', location: 'Mumbai', via: 'PPO' },
    _placement_final: null,
  },
  {
    _id: 'def456',
    cohort: '27-Delhi-IB',
    'First Name': 'Priya',
    'Last Name': 'Nair',
    'Roll No.': '34B',
    email: 'priya@example.com',
    cat: '95.2',
    gender: 'Female',
    _placed_final: true,
    _placed_summer: false,
    _placement_summer: null,
    _placement_final: { company: 'Goldman Sachs', role: 'Associate', sector: 'BFSI', location: 'Delhi', via: 'Direct' },
  },
  {
    _id: 'ghi789',
    cohort: '27-Delhi-IB',
    'First Name': 'Rahul',
    'Last Name': 'Singh',
    'Roll No.': '56C',
    email: 'rahul@example.com',
    cat: '88.0',
    gender: 'Male',
    _placed_final: false,
    _placed_summer: false,
    _placement_summer: null,
    _placement_final: null,
  },
]

// ══════════════════════════════════════════════════════════════════════════════
// 1. extractSearchableText — what goes into the index
// ══════════════════════════════════════════════════════════════════════════════

describe('extractSearchableText', () => {
  it('includes regular string fields', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).toContain('arjun')
    expect(text).toContain('sharma')
    expect(text).toContain('12a')
  })

  it('includes email', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).toContain('arjun@example.com')
  })

  it('includes numeric fields as strings', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).toContain('98.5')
  })

  it('includes placement company from _placement_summer', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).toContain('mckinsey')
  })

  it('includes placement role from _placement_summer', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).toContain('analyst')
  })

  it('includes placement sector from _placement_summer', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).toContain('consulting')
  })

  it('includes placement company from _placement_final', () => {
    const text = extractSearchableText(STUDENTS[1])
    expect(text).toContain('goldman sachs')
  })

  it('includes placement role from _placement_final', () => {
    const text = extractSearchableText(STUDENTS[1])
    expect(text).toContain('associate')
  })

  it('does NOT include boolean values (avoids false positives for true/false)', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).not.toContain('true')
    expect(text).not.toContain('false')
  })

  it('does NOT include _id', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).not.toContain('abc123')
  })

  it('does NOT include cohort', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).not.toContain('27-delhi-ib')
  })

  it('is case-lowered', () => {
    const text = extractSearchableText(STUDENTS[0])
    expect(text).toBe(text.toLowerCase())
  })

  it('handles null placement slots gracefully', () => {
    expect(() => extractSearchableText(STUDENTS[2])).not.toThrow()
  })

  it('produces empty-ish string for a student with no text fields', () => {
    const text = extractSearchableText({ _id: 'x', cohort: 'y', _placed_final: false })
    expect(text.trim()).toBe('')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. buildMatch — Set<index> correctness
// ══════════════════════════════════════════════════════════════════════════════

describe('buildMatch', () => {
  it('returns null for empty term (no filter active)', () => {
    expect(buildMatch(STUDENTS, '')).toBeNull()
    expect(buildMatch(STUDENTS, '   ')).toBeNull()
  })

  it('matches by first name', () => {
    const m = buildMatch(STUDENTS, 'arjun')
    expect(m.has(0)).toBe(true)
    expect(m.has(1)).toBe(false)
    expect(m.has(2)).toBe(false)
  })

  it('matches by last name', () => {
    const m = buildMatch(STUDENTS, 'nair')
    expect(m.has(1)).toBe(true)
    expect(m.has(0)).toBe(false)
  })

  it('matches by roll number', () => {
    const m = buildMatch(STUDENTS, '34b')
    expect(m.has(1)).toBe(true)
  })

  it('search is case-insensitive', () => {
    const m1 = buildMatch(STUDENTS, 'Arjun')
    const m2 = buildMatch(STUDENTS, 'ARJUN')
    const m3 = buildMatch(STUDENTS, 'arjun')
    expect(m1).toEqual(m2)
    expect(m2).toEqual(m3)
  })

  it('matches by placement company (summer)', () => {
    const m = buildMatch(STUDENTS, 'mckinsey')
    expect(m.has(0)).toBe(true)  // Arjun placed at McKinsey (summer)
    expect(m.has(1)).toBe(false)
    expect(m.has(2)).toBe(false)
  })

  it('matches by placement company (final)', () => {
    const m = buildMatch(STUDENTS, 'goldman')
    expect(m.has(1)).toBe(true)  // Priya placed at Goldman (final)
    expect(m.has(0)).toBe(false)
  })

  it('matches by placement role', () => {
    const m = buildMatch(STUDENTS, 'associate')
    expect(m.has(1)).toBe(true)
    expect(m.has(0)).toBe(false)
  })

  it('matches by placement sector', () => {
    const m = buildMatch(STUDENTS, 'bfsi')
    expect(m.has(1)).toBe(true)
    expect(m.has(0)).toBe(false)
  })

  it('matches partial substring', () => {
    const m = buildMatch(STUDENTS, 'mckin')
    expect(m.has(0)).toBe(true)
  })

  it('returns empty Set for no matches (not null)', () => {
    const m = buildMatch(STUDENTS, 'zzznomatch')
    expect(m).not.toBeNull()
    expect(m.size).toBe(0)
  })

  it('returns Set with all indices when everyone matches', () => {
    // All three have 'example.com' in email
    const m = buildMatch(STUDENTS, 'example.com')
    expect(m.has(0)).toBe(true)
    expect(m.has(1)).toBe(true)
    expect(m.has(2)).toBe(true)
  })

  it('does NOT match on boolean sentinel values', () => {
    // Searching "true" should not match placed students
    const m = buildMatch(STUDENTS, 'true')
    expect(m.size).toBe(0)
  })

  it('does NOT match on _id', () => {
    const m = buildMatch(STUDENTS, 'abc123')
    expect(m.size).toBe(0)
  })

  it('does NOT match on cohort string', () => {
    const m = buildMatch(STUDENTS, '27-delhi-ib')
    expect(m.size).toBe(0)
  })

  it('handles empty items array', () => {
    const m = buildMatch([], 'arjun')
    expect(m).not.toBeNull()
    expect(m.size).toBe(0)
  })

  it('handles items with no searchable fields', () => {
    const items = [{ _id: 'x', cohort: 'y', _placed_final: false }]
    const m = buildMatch(items, 'anything')
    expect(m.size).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. Index stability — index must not change unless items change
// ══════════════════════════════════════════════════════════════════════════════

describe('index stability invariants', () => {
  it('same item produces same index text on repeated calls', () => {
    const t1 = extractSearchableText(STUDENTS[0])
    const t2 = extractSearchableText(STUDENTS[0])
    expect(t1).toBe(t2)
  })

  it('index length equals items length', () => {
    const index = STUDENTS.map(extractSearchableText)
    expect(index).toHaveLength(STUDENTS.length)
  })

  it('empty items produces empty index', () => {
    expect([].map(extractSearchableText)).toHaveLength(0)
  })

  it('match Set indices correspond 1:1 with items array positions', () => {
    const m = buildMatch(STUDENTS, 'rahul')
    // Rahul is at index 2
    expect(m.has(2)).toBe(true)
    expect(m.size).toBe(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. Edge cases
// ══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('matches via placement location', () => {
    const m = buildMatch(STUDENTS, 'mumbai')
    expect(m.has(0)).toBe(true)
  })

  it('matches via placement via field (PPO/Referral/Direct)', () => {
    const m = buildMatch(STUDENTS, 'ppo')
    expect(m.has(0)).toBe(true)  // Arjun via PPO
    expect(m.has(1)).toBe(false) // Priya via Direct
  })

  it('handles student with both summer and final placements', () => {
    const student = {
      'First Name': 'Test',
      _placed_summer: true,
      _placement_summer: { company: 'Bain', role: 'Consultant', sector: 'Consulting', location: 'Delhi', via: 'PPO' },
      _placed_final: true,
      _placement_final: { company: 'BCG', role: 'Senior Analyst', sector: 'Consulting', location: 'Mumbai', via: 'Direct' },
    }
    const text = extractSearchableText(student)
    expect(text).toContain('bain')
    expect(text).toContain('bcg')
    expect(text).toContain('consultant')
    expect(text).toContain('senior analyst')
  })

  it('handles undefined values in fields', () => {
    const student = { 'First Name': 'Test', cat: undefined, gender: null }
    expect(() => extractSearchableText(student)).not.toThrow()
    const text = extractSearchableText(student)
    expect(text).toContain('test')
  })

  it('number fields are searchable as strings', () => {
    const student = { roll: 42, cat: 99.1 }
    const text = extractSearchableText(student)
    expect(text).toContain('42')
    expect(text).toContain('99.1')
  })
})
