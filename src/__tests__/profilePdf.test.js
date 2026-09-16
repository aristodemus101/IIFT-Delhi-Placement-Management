import { describe, it, expect } from 'vitest'
import {
  isMeaningfulValue, groupColumnsForProfile, classifyColumns, resolveDisplayName, resolveRoll,
  resolvePlacementBadges, buildProfilesHtml,
} from '../lib/profilePdf'

// ─── isMeaningfulValue ───────────────────────────────────────────────────────

describe('isMeaningfulValue', () => {
  it('rejects null/undefined/empty', () => {
    expect(isMeaningfulValue(null)).toBe(false)
    expect(isMeaningfulValue(undefined)).toBe(false)
    expect(isMeaningfulValue('')).toBe(false)
    expect(isMeaningfulValue('   ')).toBe(false)
  })

  it('rejects common placeholder tokens, case-insensitively', () => {
    for (const tok of ['NA', 'na', 'N/A', 'Nil', 'none', '-', '--', '0', 'null', 'undefined']) {
      expect(isMeaningfulValue(tok)).toBe(false)
    }
  })

  it('accepts real values including numeric strings other than "0"', () => {
    expect(isMeaningfulValue('Delhi')).toBe(true)
    expect(isMeaningfulValue('95.5')).toBe(true)
    expect(isMeaningfulValue(0)).toBe(false) // numeric 0 coerces to string '0'
    expect(isMeaningfulValue(95)).toBe(true)
  })
})

// ─── groupColumnsForProfile ─────────────────────────────────────────────────

const getValue = (student, key) => student[key]

describe('groupColumnsForProfile', () => {
  it('buckets columns into sections by label pattern', () => {
    const columnDefs = [
      { key: 'roll', label: 'Roll No.' },
      { key: 'email', label: 'Official Email' },
      { key: 'x12pct', label: 'Class 12 Percentage' },
      { key: 'achievement', label: 'Achievements' },
      { key: 'randomThing', label: 'Favourite Colour' },
    ]
    const student = {
      roll: '12A', email: 'a@b.com', x12pct: '91.2', achievement: 'Gold medal', randomThing: 'Blue',
    }
    const sections = groupColumnsForProfile(columnDefs, student, getValue)
    const byKey = Object.fromEntries(sections.map(s => [s.key, s]))

    expect(byKey.identity.fields.map(f => f.label)).toContain('Roll No.')
    expect(byKey.contact.fields.map(f => f.label)).toContain('Official Email')
    expect(byKey.academics.fields.map(f => f.label)).toContain('Class 12 Percentage')
    expect(byKey.achievements.fields.map(f => f.label)).toContain('Achievements')
    expect(byKey.other.fields.map(f => f.label)).toContain('Favourite Colour')
  })

  it('drops columns with empty/placeholder values', () => {
    const columnDefs = [{ key: 'a', label: 'Field A' }, { key: 'b', label: 'Field B' }]
    const student = { a: '', b: 'Real value' }
    const sections = groupColumnsForProfile(columnDefs, student, getValue)
    const allLabels = sections.flatMap(s => s.fields.map(f => f.label))
    expect(allLabels).not.toContain('Field A')
    expect(allLabels).toContain('Field B')
  })

  it('omits sections that end up with zero fields', () => {
    const columnDefs = [{ key: 'roll', label: 'Roll No.' }]
    const student = { roll: '5B' }
    const sections = groupColumnsForProfile(columnDefs, student, getValue)
    expect(sections).toHaveLength(1)
    expect(sections[0].key).toBe('identity')
  })

  it('preserves section order: identity, contact, family, academics, experience, achievements, placement, other', () => {
    const columnDefs = [
      { key: 'other1', label: 'Something Else' },
      { key: 'sip_company', label: 'SIP Company' },
      { key: 'achievement', label: 'Achievements' },
      { key: 'intern1', label: 'Internship 1' },
      { key: 'ug', label: 'UG Degree' },
      { key: 'father', label: "Father's Name" },
      { key: 'email', label: 'Email' },
      { key: 'roll', label: 'Roll No.' },
    ]
    const student = Object.fromEntries(columnDefs.map(c => [c.key, 'value']))
    const sections = groupColumnsForProfile(columnDefs, student, getValue)
    expect(sections.map(s => s.key)).toEqual([
      'identity', 'contact', 'family', 'academics', 'experience', 'achievements', 'placement', 'other',
    ])
  })

  it('produces identical results with a precomputed classifyColumns() result', () => {
    const columnDefs = [
      { key: 'roll', label: 'Roll No.' },
      { key: 'email', label: 'Official Email' },
      { key: 'x12pct', label: 'Class 12 Percentage' },
    ]
    const student = { roll: '12A', email: 'a@b.com', x12pct: '91.2' }
    const withoutPrecompute = groupColumnsForProfile(columnDefs, student, getValue)
    const classified = classifyColumns(columnDefs)
    const withPrecompute = groupColumnsForProfile(columnDefs, student, getValue, new Set(), classified)
    expect(withPrecompute).toEqual(withoutPrecompute)
  })
})

describe('classifyColumns', () => {
  it('assigns each column to exactly one section key, independent of any student', () => {
    const columnDefs = [
      { key: 'roll', label: 'Roll No.' },
      { key: 'achievement', label: 'Achievements' },
      { key: 'random', label: 'Something Else' },
    ]
    const result = classifyColumns(columnDefs)
    expect(result).toEqual([
      { col: columnDefs[0], sectionKey: 'identity' },
      { col: columnDefs[1], sectionKey: 'achievements' },
      { col: columnDefs[2], sectionKey: 'other' },
    ])
  })
})

// ─── resolveDisplayName / resolveRoll ───────────────────────────────────────

describe('resolveDisplayName', () => {
  it('prefers an exact "Full Name" or "Name" label, and returns its column key', () => {
    const columnDefs = [{ key: 'name', label: 'Full Name' }, { key: 'company', label: 'Company Name' }]
    const student = { name: 'Priya Sharma', company: 'Acme Corp' }
    expect(resolveDisplayName(columnDefs, student, getValue)).toEqual({ value: 'Priya Sharma', columnKey: 'name' })
  })

  it('does not mistake "Father Name" or "Company Name" for the student name', () => {
    const columnDefs = [{ key: 'father', label: "Father's Name" }, { key: 'company', label: 'Company Name' }]
    const student = { father: 'Ramesh Sharma', company: 'Acme Corp' }
    expect(resolveDisplayName(columnDefs, student, getValue)).toEqual({ value: 'Unnamed Candidate', columnKey: null })
  })

  it('falls back to Unnamed Candidate with a null columnKey when no name column exists', () => {
    const columnDefs = [{ key: 'roll', label: 'Roll No.' }]
    expect(resolveDisplayName(columnDefs, { roll: '1A' }, getValue)).toEqual({ value: 'Unnamed Candidate', columnKey: null })
  })
})

describe('resolveRoll', () => {
  it('finds a roll-labeled column', () => {
    const columnDefs = [{ key: 'roll', label: 'Roll No.' }]
    expect(resolveRoll(columnDefs, { roll: '7C' }, getValue)).toBe('7C')
  })

  it('returns empty string when absent', () => {
    expect(resolveRoll([], {}, getValue)).toBe('')
  })
})

// ─── resolvePlacementBadges ─────────────────────────────────────────────────

describe('resolvePlacementBadges', () => {
  it('returns both badges when placed in both cycles', () => {
    const student = {
      _placed_summer: true, _placement_summer: { company: 'Goldman Sachs', role: 'Analyst' },
      _placed_final: true, _placement_final: { company: 'McKinsey', role: 'Consultant' },
    }
    const badges = resolvePlacementBadges(student)
    expect(badges).toEqual([
      { label: 'SIP', company: 'Goldman Sachs', role: 'Analyst' },
      { label: 'Final', company: 'McKinsey', role: 'Consultant' },
    ])
  })

  it('returns empty array when not placed', () => {
    expect(resolvePlacementBadges({})).toEqual([])
    expect(resolvePlacementBadges({ _placed_summer: false })).toEqual([])
  })

  it('skips a placed flag with no company on the placement object', () => {
    const student = { _placed_summer: true, _placement_summer: { company: '' } }
    expect(resolvePlacementBadges(student)).toEqual([])
  })
})

// ─── buildProfilesHtml ───────────────────────────────────────────────────────

describe('buildProfilesHtml', () => {
  const columnDefs = [{ key: 'name', label: 'Full Name' }, { key: 'roll', label: 'Roll No.' }]

  it('produces one <article class="profile-page"> per student', () => {
    const students = [{ name: 'Alice', roll: '1A' }, { name: 'Bob', roll: '2A' }]
    const html = buildProfilesHtml({ students, columnDefs, getValue })
    const openTags = html.match(/<article class="profile-page">/g) || []
    expect(openTags).toHaveLength(students.length)
  })

  it('includes the candidate name and roll in the output', () => {
    const html = buildProfilesHtml({ students: [{ name: 'Alice Verma', roll: '1A' }], columnDefs, getValue })
    expect(html).toContain('Alice Verma')
    expect(html).toContain('1A')
  })

  it('does not repeat the name field in the body grid (it is already shown in the header)', () => {
    const html = buildProfilesHtml({ students: [{ name: 'Alice Verma', roll: '1A' }], columnDefs, getValue })
    const occurrences = (html.match(/Alice Verma/g) || []).length
    expect(occurrences).toBe(1)
    expect(html).not.toContain('profile-field-label">Full Name')
  })

  it('escapes HTML-significant characters in values to prevent injection/breakage', () => {
    const html = buildProfilesHtml({ students: [{ name: '<script>alert(1)</script>', roll: '1A' }], columnDefs, getValue })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('shows placement badges in the header when placed', () => {
    const student = { name: 'Carol', roll: '3A', _placed_final: true, _placement_final: { company: 'Bain', role: 'Associate' } }
    const html = buildProfilesHtml({ students: [student], columnDefs, getValue })
    expect(html).toContain('Bain')
    expect(html).toContain('Associate')
  })

  it('shows an empty-state message when no visible columns have data', () => {
    const html = buildProfilesHtml({ students: [{}], columnDefs: [], getValue })
    expect(html).toContain('No additional details available')
  })

  it('includes institute name and batch label in the header', () => {
    const html = buildProfilesHtml({ students: [{ name: 'Dev', roll: '4A' }], columnDefs, getValue, institute: 'IIFT Delhi', batchLabel: '28 Delhi IB' })
    expect(html).toContain('IIFT Delhi')
    expect(html).toContain('28 Delhi IB')
  })
})
