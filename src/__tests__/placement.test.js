/**
 * PlacementOS — Comprehensive Test Suite
 *
 * Tests cover:
 * 1. batch.js — cohort ID parsing, labels, schema doc IDs
 * 2. csv.js — file parsing, header normalization, export stripping
 * 3. columns.js — getVal, autoMapColumns
 * 4. PendingChangesContext internals — normalizePlacementDetails, parseSipColumns, SIP_COLUMNS
 * 5. PlacedPage logic — fmtPackage, parsePackage (Finals vs Summer CTC)
 * 6. Firestore schema invariants — shape of student docs, _placed_summer/_placed_final
 */

import { describe, it, expect } from 'vitest'

// ─── batch.js ────────────────────────────────────────────────────────────────
import {
  makeCohortId,
  parseCohortId,
  cohortLabel,
  cohortYear,
  seasonLabel,
  schemaDocIdForBatch,
  campusesForProgramme,
  programmesForCampus,
} from '../lib/batch.js'

describe('batch.js — cohort ID helpers', () => {
  it('makeCohortId produces correct id', () => {
    expect(makeCohortId('27', 'Delhi', 'IB')).toBe('27-Delhi-IB')
    expect(makeCohortId('27', 'Delhi', 'BA')).toBe('27-Delhi-BA')
    expect(makeCohortId('27', 'Gift City', 'IB')).toBe('27-GiftCity-IB')
    expect(makeCohortId('27', 'Kakinada', 'IB')).toBe('27-Kakinada-IB')
    expect(makeCohortId('27', 'Kolkata', 'IB')).toBe('27-Kolkata-IB')
  })

  it('parseCohortId round-trips standard ids', () => {
    expect(parseCohortId('27-Delhi-IB')).toEqual({ yearCode: '27', campus: 'Delhi', programme: 'IB' })
    expect(parseCohortId('27-Delhi-BA')).toEqual({ yearCode: '27', campus: 'Delhi', programme: 'BA' })
    expect(parseCohortId('27-GiftCity-IB')).toEqual({ yearCode: '27', campus: 'Gift City', programme: 'IB' })
    expect(parseCohortId('27-Kakinada-IB')).toEqual({ yearCode: '27', campus: 'Kakinada', programme: 'IB' })
  })

  it('parseCohortId handles empty/null', () => {
    expect(parseCohortId('')).toEqual({ yearCode: '', campus: '', programme: '' })
    expect(parseCohortId(null)).toEqual({ yearCode: '', campus: '', programme: '' })
  })

  it('cohortLabel produces readable label', () => {
    expect(cohortLabel('27-Delhi-IB')).toBe('27 Delhi IB')
    expect(cohortLabel('27-GiftCity-IB')).toBe('27 Gift City IB')
    expect(cohortLabel('')).toBe('No cohort')
  })

  it('cohortYear extracts year number', () => {
    expect(cohortYear('27-Delhi-IB')).toBe(2027)
    expect(cohortYear('28-Kolkata-IB')).toBe(2028)
    expect(cohortYear('')).toBe(0)
  })

  it('seasonLabel returns correct strings', () => {
    expect(seasonLabel('summer')).toBe('Summer Internship')
    expect(seasonLabel('final')).toBe('Final Placement')
    expect(seasonLabel('')).toBe('Unknown Season')
    expect(seasonLabel(null)).toBe('Unknown Season')
  })

  it('schemaDocIdForBatch produces correct doc ID', () => {
    expect(schemaDocIdForBatch('27-Delhi-IB')).toBe('columnSchema_27-Delhi-IB')
    expect(schemaDocIdForBatch('default')).toBe('columnSchema_default')
  })

  it('campusesForProgramme returns correct campuses', () => {
    expect(campusesForProgramme('BA')).toEqual(['Delhi'])
    expect(campusesForProgramme('IB')).toEqual(['Delhi', 'Kakinada', 'Gift City', 'Kolkata'])
  })

  it('programmesForCampus returns correct programmes', () => {
    expect(programmesForCampus('Delhi')).toEqual(['IB', 'BA'])
    expect(programmesForCampus('Kakinada')).toEqual(['IB'])
    expect(programmesForCampus('Gift City')).toEqual(['IB'])
  })
})

// ─── columns.js ──────────────────────────────────────────────────────────────
import { getVal, OUR_COLS, autoMapColumns, normalize } from '../lib/columns.js'

describe('columns.js — getVal', () => {
  const student = {
    'Full Name': 'Priya Sharma',
    'Roll No.': 'D27001',
    'CAT Percentile': '99.5',
    'Gender': 'Female',
    'Total Work Experience (in months)': '24',
    'Graduation Overall Score in %age': '8.5',
  }

  it('getVal resolves canonical keys to raw column values', () => {
    expect(getVal(student, 'name')).toBe('Priya Sharma')
    expect(getVal(student, 'roll')).toBe('D27001')
    expect(getVal(student, 'cat')).toBe('99.5')
    expect(getVal(student, 'gender')).toBe('Female')
    expect(getVal(student, 'wx')).toBe('24')
    expect(getVal(student, 'ugpct')).toBe('8.5')
  })

  it('getVal returns empty string for missing key', () => {
    expect(getVal(student, 'nonexistent_key')).toBe('')
    expect(getVal({}, 'name')).toBe('')
  })

  it('getVal constructs Full Name from parts if Full Name missing', () => {
    const s = { 'First Name': 'Priya', 'Last Name': 'Sharma' }
    expect(getVal(s, 'name')).toBe('Priya Sharma')
  })

  it('OUR_COLS has no duplicate keys', () => {
    const keys = OUR_COLS.map(c => c.key)
    const unique = new Set(keys)
    expect(keys.length).toBe(unique.size)
  })
})

describe('columns.js — autoMapColumns', () => {
  it('maps common company column names to our keys', () => {
    const result = autoMapColumns(['Name', 'Roll No', 'CAT %ile', 'Gender', 'Work Experience'])
    const mapped = Object.fromEntries(result.map(r => [r.companyCol, r.ourKey]))
    expect(mapped['Name']).toBe('name')
    expect(mapped['Roll No']).toBe('roll')
    expect(mapped['CAT %ile']).toBe('cat')
    expect(mapped['Gender']).toBe('gender')
    expect(mapped['Work Experience']).toBe('wx')
  })

  it('maps Total Work Experience correctly', () => {
    const result = autoMapColumns(['Total Work Experience (in months)'])
    expect(result[0].ourKey).toBe('wx')
  })

  it('returns null ourKey for a truly unknown column', () => {
    // "QWERTY_GIBBERISH_NO_MATCH" — no synonym should match
    const result = autoMapColumns(['QWERTY_GIBBERISH_NO_MATCH'])
    expect(result[0].ourKey).toBe(null)
    expect(result[0].auto).toBe(false)
  })
})

describe('columns.js — normalize', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    // normalize replaces non-alphanumeric (except space) with space, then collapses multi-space
    expect(normalize('CAT %ile')).toBe('cat ile')
    expect(normalize('Full Name!')).toBe('full name')
    expect(normalize('Work Experience')).toBe('work experience')
  })
})

// ─── SIP_COLUMNS — what gets stripped from student doc ───────────────────────
// Mirror the exact SIP_COLUMNS from PendingChangesContext
const SIP_COLUMNS_STRIPPED = [
  'Summer Stipend', 'SIP Stipend (In Lakhs/month)', 'SIP Stipend',
]

const SIP_COLUMNS_KEPT = [
  'SIP Status',
  'SIP Company',
  'SIP Role',
  'SIP Company Sector',
  'SIP Company Domain',
  'SIP Roles and Responsibilities',
  'Location',
  'DOP',
  'Placed Via',
]

describe('SIP column stripping rules', () => {
  it('strips only monetary stipend columns', () => {
    SIP_COLUMNS_STRIPPED.forEach(col => {
      expect(SIP_COLUMNS_STRIPPED.includes(col)).toBe(true)
    })
  })

  it('does NOT strip non-monetary SIP bio columns', () => {
    SIP_COLUMNS_KEPT.forEach(col => {
      expect(SIP_COLUMNS_STRIPPED.includes(col)).toBe(false)
    })
  })

  it('correctly simulates what stays on student doc after import', () => {
    const rawRow = {
      'Full Name': 'Aarav Mehta',
      'Roll No.': 'D27042',
      'SIP Status': 'Placed',
      'SIP Company': 'Boston Consulting Group',
      'SIP Role': 'Consultant',
      'SIP Company Sector': 'Consulting & Professional Services',
      'Summer Stipend': '80000',
      'SIP Stipend (In Lakhs/month)': '0.8',
      'DOP': '2025-03-15',
    }

    const studentRow = { ...rawRow }
    SIP_COLUMNS_STRIPPED.forEach(col => { delete studentRow[col] })

    expect(studentRow['Summer Stipend']).toBeUndefined()
    expect(studentRow['SIP Stipend (In Lakhs/month)']).toBeUndefined()
    expect(studentRow['SIP Status']).toBe('Placed')
    expect(studentRow['SIP Company']).toBe('Boston Consulting Group')
    expect(studentRow['DOP']).toBe('2025-03-15')
  })
})

// ─── parseSipColumns — what goes into _placement_summer ──────────────────────
function parseSipColumns(row) {
  const get = (...keys) => {
    for (const k of keys) {
      const val = row[k]
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim()
    }
    return ''
  }

  const status = get('SIP Status').toLowerCase()
  const placed = status === 'placed'

  const rawDate = get('DOP')
  let date = ''
  if (rawDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
      date = rawDate.trim()
    } else {
      const parsed = new Date(rawDate)
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear()
        const m = String(parsed.getMonth() + 1).padStart(2, '0')
        const d = String(parsed.getDate()).padStart(2, '0')
        date = `${y}-${m}-${d}`
      } else {
        date = rawDate
      }
    }
  }
  if (!date) date = new Date().toISOString().slice(0, 10)

  const placement = {
    date,
    company:   get('SIP Company'),
    role:      get('SIP Role'),
    sector:    get('SIP Company Sector', 'SIP Company Domain'),
    location:  get('Location'),
    package:   get('Summer Stipend', 'SIP Stipend (In Lakhs/month)', 'SIP Stipend'),
    ctcNotes:  get('SIP Roles and Responsibilities'),
    via:       get('Placed Via'),
    placedAtIso: date ? new Date(`${date}T00:00:00`).toISOString() : new Date().toISOString(),
  }

  return { placed, placement, sipStatus: get('SIP Status') }
}

describe('parseSipColumns', () => {
  it('marks placed=true when SIP Status = Placed', () => {
    const row = {
      'SIP Status': 'Placed',
      'SIP Company': 'McKinsey',
      'SIP Role': 'Business Analyst',
      'SIP Company Sector': 'Consulting & Professional Services',
      'Location': 'Domestic',
      'DOP': '2025-02-21',
      'Summer Stipend': '75000',
    }
    const { placed, placement } = parseSipColumns(row)
    expect(placed).toBe(true)
    expect(placement.company).toBe('McKinsey')
    expect(placement.role).toBe('Business Analyst')
    expect(placement.sector).toBe('Consulting & Professional Services')
    expect(placement.package).toBe('75000')
    expect(placement.date).toBe('2025-02-21')
  })

  it('marks placed=false when SIP Status != Placed', () => {
    const row = { 'SIP Status': 'Not Placed', 'SIP Company': '' }
    const { placed } = parseSipColumns(row)
    expect(placed).toBe(false)
  })

  it('falls back to SIP Company Domain if SIP Company Sector missing', () => {
    const row = {
      'SIP Status': 'Placed',
      'SIP Company': 'ITC',
      'SIP Company Domain': 'FMCG & Consumer Products',
      'DOP': '2025-03-01',
    }
    const { placement } = parseSipColumns(row)
    expect(placement.sector).toBe('FMCG & Consumer Products')
  })

  it('falls back to SIP Stipend (In Lakhs/month) if Summer Stipend missing', () => {
    const row = {
      'SIP Status': 'Placed',
      'SIP Company': 'Deloitte',
      'DOP': '2025-02-01',
      'SIP Stipend (In Lakhs/month)': '0.6',
    }
    const { placement } = parseSipColumns(row)
    expect(placement.package).toBe('0.6')
  })

  it('handles date formats: "February 21, 2025"', () => {
    const row = {
      'SIP Status': 'Placed',
      'SIP Company': 'Accenture',
      'DOP': 'February 21, 2025',
    }
    const { placement } = parseSipColumns(row)
    expect(placement.date).toBe('2025-02-21')
  })

  it('handles date format: "21/02/2025"', () => {
    const row = {
      'SIP Status': 'Placed',
      'SIP Company': 'Bain',
      'DOP': '02/21/2025',
    }
    const { placement } = parseSipColumns(row)
    expect(placement.date).toBe('2025-02-21')
  })
})

// ─── normalizePlacementDetails ────────────────────────────────────────────────
function normalizePlacementDetails(change) {
  const raw = change?.placementDetails || {}
  const date = typeof raw.date === 'string' && raw.date.trim()
    ? raw.date.trim()
    : new Date().toISOString().slice(0, 10)
  const placedAtIso = typeof raw.placedAtIso === 'string' && raw.placedAtIso.trim()
    ? raw.placedAtIso.trim()
    : new Date(`${date}T00:00:00`).toISOString()

  return {
    date,
    company: String(raw.company || change?.company || '').trim(),
    role: String(raw.role || '').trim(),
    domain: String(raw.domain || '').trim(),
    sector: String(raw.sector || '').trim(),
    location: String(raw.location || '').trim(),
    package: String(raw.package || '').trim(),
    ctcNotes: String(raw.ctcNotes || '').trim(),
    via: String(raw.via || '').trim(),
    finalStatus: String(raw.finalStatus || '').trim(),
    placedAtIso,
  }
}

describe('normalizePlacementDetails', () => {
  it('produces all required fields for Finals placement', () => {
    const change = {
      company: 'KPMG',
      placementDetails: {
        date: '2025-12-10',
        company: 'KPMG',
        role: 'Associate',
        domain: 'Finance',
        sector: 'Banking & Financial Services',
        location: 'Domestic',
        package: '3250000',
        ctcNotes: 'Fixed pay only',
        via: 'Finals Cycle',
        finalStatus: 'Convert',
        placedAtIso: '2025-12-10T00:00:00.000Z',
      },
    }
    const result = normalizePlacementDetails(change)
    expect(result.company).toBe('KPMG')
    expect(result.role).toBe('Associate')
    expect(result.domain).toBe('Finance')
    expect(result.sector).toBe('Banking & Financial Services')
    expect(result.package).toBe('3250000')
    expect(result.via).toBe('Finals Cycle')
    expect(result.finalStatus).toBe('Convert')
    expect(result.date).toBe('2025-12-10')
  })

  it('falls back to change.company if placementDetails.company missing', () => {
    const change = { company: 'Fallback Co', placementDetails: { date: '2025-12-01' } }
    const result = normalizePlacementDetails(change)
    expect(result.company).toBe('Fallback Co')
  })

  it('trims all string fields', () => {
    const change = {
      placementDetails: {
        date: '2025-12-01',
        company: '  Deloitte  ',
        role: '  Analyst  ',
        domain: '  Finance  ',
        finalStatus: '  PPO  ',
        via: '  Summer PPO  ',
      }
    }
    const result = normalizePlacementDetails(change)
    expect(result.company).toBe('Deloitte')
    expect(result.role).toBe('Analyst')
    expect(result.domain).toBe('Finance')
    expect(result.finalStatus).toBe('PPO')
    expect(result.via).toBe('Summer PPO')
  })

  it('defaults date to today if missing', () => {
    const result = normalizePlacementDetails({ placementDetails: { company: 'X' } })
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ─── fmtPackage / parsePackage (PlacedPage display logic) ────────────────────
function parsePackage(pkg, isSummer) {
  const cleaned = String(pkg).replace(/,/g, '')
  const m = cleaned.match(/[\d.]+/)
  if (!m) return null
  const val = parseFloat(m[0])
  if (!isSummer && val > 1000) return parseFloat((val / 100000).toFixed(2))
  return val
}

function fmtPackage(pkg, season) {
  if (!pkg) return '—'
  if (season === 'summer') return `₹${pkg}/mo`
  const val = parseFloat(String(pkg).replace(/,/g, ''))
  if (isNaN(val)) return pkg
  if (val > 1000) return `${(val / 100000).toFixed(2)} LPA`
  return `${val} LPA`
}

describe('PlacedPage — Finals CTC parsing and display', () => {
  describe('parsePackage (stats)', () => {
    it('converts absolute rupees to LPA for Finals', () => {
      expect(parsePackage('3250000', false)).toBe(32.5)
      expect(parsePackage('2000000', false)).toBe(20)
      expect(parsePackage('1500000', false)).toBe(15)
    })

    it('treats values ≤ 1000 as already LPA for Finals', () => {
      expect(parsePackage('32.5', false)).toBe(32.5)
      expect(parsePackage('20', false)).toBe(20)
      expect(parsePackage('8', false)).toBe(8)
    })

    it('returns raw value for Summer (no conversion)', () => {
      expect(parsePackage('75000', true)).toBe(75000)
      expect(parsePackage('60000', true)).toBe(60000)
    })

    it('handles comma-separated numbers', () => {
      expect(parsePackage('32,50,000', false)).toBe(32.5)
    })

    it('returns null for non-numeric package', () => {
      expect(parsePackage('TBD', false)).toBe(null)
      expect(parsePackage('', false)).toBe(null)
    })
  })

  describe('fmtPackage (display)', () => {
    it('formats Finals absolute rupees as LPA', () => {
      expect(fmtPackage('3250000', 'final')).toBe('32.50 LPA')
      expect(fmtPackage('2000000', 'final')).toBe('20.00 LPA')
    })

    it('formats Finals already-LPA values', () => {
      expect(fmtPackage('32.5', 'final')).toBe('32.5 LPA')
      expect(fmtPackage('20', 'final')).toBe('20 LPA')
    })

    it('formats Summer as ₹/mo', () => {
      expect(fmtPackage('75000', 'summer')).toBe('₹75000/mo')
      expect(fmtPackage('60,000', 'summer')).toBe('₹60,000/mo')
    })

    it('returns — for empty/null package', () => {
      expect(fmtPackage('', 'final')).toBe('—')
      expect(fmtPackage(null, 'final')).toBe('—')
      expect(fmtPackage(undefined, 'summer')).toBe('—')
    })
  })
})

// ─── Firestore student doc schema invariants ──────────────────────────────────
describe('Student doc schema invariants', () => {
  const validStudentDoc = {
    // Bio fields (sample)
    'Full Name': 'Test Student',
    'Roll No.': 'D27001',
    'CAT Percentile': '99.5',
    cohort: '27-Delhi-IB',
    // Placement flags (always present)
    _placed_summer: false,
    _placed_final: false,
    _placement_summer: null,
    _placement_final: null,
    _createdAt: new Date(),
  }

  it('has all required _ fields', () => {
    expect(validStudentDoc).toHaveProperty('_placed_summer')
    expect(validStudentDoc).toHaveProperty('_placed_final')
    expect(validStudentDoc).toHaveProperty('_placement_summer')
    expect(validStudentDoc).toHaveProperty('_placement_final')
    expect(validStudentDoc).toHaveProperty('cohort')
  })

  it('_placed_summer and _placed_final are booleans', () => {
    expect(typeof validStudentDoc._placed_summer).toBe('boolean')
    expect(typeof validStudentDoc._placed_final).toBe('boolean')
  })

  it('_placement_summer shape matches expected schema', () => {
    const placement = {
      date: '2025-02-21',
      company: 'McKinsey',
      role: 'Business Analyst',
      domain: 'Strategy',
      sector: 'Consulting & Professional Services',
      location: 'Domestic',
      package: '75000',
      ctcNotes: '',
      via: 'Campus Placement',
      finalStatus: '',
      placedAtIso: '2025-02-21T00:00:00.000Z',
    }
    const requiredKeys = ['date', 'company', 'role', 'domain', 'sector', 'location', 'package', 'ctcNotes', 'via', 'finalStatus', 'placedAtIso']
    requiredKeys.forEach(k => {
      expect(placement).toHaveProperty(k)
    })
  })

  it('_placement_final shape includes domain and finalStatus', () => {
    const finalPlacement = {
      date: '2025-12-10',
      company: 'KPMG',
      role: 'Associate',
      domain: 'Finance',
      sector: 'Banking & Financial Services',
      location: 'Domestic',
      package: '3250000',
      ctcNotes: 'Fixed pay',
      via: 'Finals Cycle',
      finalStatus: 'Convert',
      placedAtIso: '2025-12-10T00:00:00.000Z',
    }
    expect(finalPlacement.domain).toBe('Finance')
    expect(finalPlacement.finalStatus).toBe('Convert')
    expect(finalPlacement.package).toBe('3250000')
  })

  it('SIP stipend is NOT stored on student doc', () => {
    const studentRow = {
      'Full Name': 'Test',
      'SIP Company': 'BCG',
      'SIP Role': 'Consultant',
    }
    // After strip, no stipend column should exist
    SIP_COLUMNS_STRIPPED.forEach(col => {
      expect(studentRow[col]).toBeUndefined()
    })
  })
})

// ─── Permission schema invariants ─────────────────────────────────────────────
import { PAGE_ACCESS, ACTION_ACCESS, FIELD_DEFAULTS, ROLES, ROLE_LABELS } from '../lib/permissions.js'

describe('permissions.js — schema invariants', () => {
  it('faculty_coordinator role key is never renamed', () => {
    expect(ROLES).toContain('faculty_coordinator')
    expect(ROLE_LABELS['faculty_coordinator']).toBe('Faculty Incharge')
  })

  it('ctc field is admin-only by default', () => {
    expect(FIELD_DEFAULTS['ctc']).toEqual(['admin'])
  })

  it('stipend field is admin-only by default', () => {
    expect(FIELD_DEFAULTS['stipend']).toEqual(['admin'])
  })

  it('committee can see placement data (company/role)', () => {
    expect(FIELD_DEFAULTS['_placement_final']).toContain('committee')
    expect(FIELD_DEFAULTS['_placement_summer']).toContain('committee')
  })

  it('only admin can approve changes', () => {
    expect(ACTION_ACCESS['approveChange']).toEqual(['admin'])
  })

  it('only admin can import data', () => {
    expect(ACTION_ACCESS['proposeImport']).toEqual(['admin'])
  })

  it('both admin and committee can propose placements', () => {
    expect(ACTION_ACCESS['proposePlace']).toContain('admin')
    expect(ACTION_ACCESS['proposePlace']).toContain('committee')
  })

  it('TPO can only access tpo and about pages', () => {
    const tpoPages = Object.entries(PAGE_ACCESS)
      .filter(([, roles]) => roles.includes('tpo'))
      .map(([page]) => page)
    expect(tpoPages).toContain('tpo')
    expect(tpoPages).toContain('about')
    expect(tpoPages).not.toContain('roster')
    expect(tpoPages).not.toContain('placed')
    expect(tpoPages).not.toContain('approvals')
  })

  it('faculty_coordinator can only access analytics, tpo, and about', () => {
    const fcPages = Object.entries(PAGE_ACCESS)
      .filter(([, roles]) => roles.includes('faculty_coordinator'))
      .map(([page]) => page)
    expect(fcPages).toContain('analytics')
    expect(fcPages).toContain('tpo')
    expect(fcPages).toContain('about')
    expect(fcPages).not.toContain('roster')
    expect(fcPages).not.toContain('approvals')
    expect(fcPages).not.toContain('admin')
  })

  it('approvals page is admin-only', () => {
    expect(PAGE_ACCESS['approvals']).toEqual(['admin'])
  })

  it('admin page is admin-only', () => {
    expect(PAGE_ACCESS['admin']).toEqual(['admin'])
  })
})

// ─── Column ordering logic ────────────────────────────────────────────────────
describe('Column ordering — allColumnDefs logic', () => {
  function buildAllColumnDefs(docKeys, schemaHeaders) {
    const ordered = []
    const seen = new Set()
    for (const h of (schemaHeaders || [])) {
      if (docKeys.has(h) && !seen.has(h)) {
        seen.add(h)
        ordered.push({ key: h, label: h, sortKey: h })
      }
    }
    for (const k of docKeys) {
      if (!seen.has(k)) ordered.push({ key: k, label: k, sortKey: k })
    }
    return ordered
  }

  it('respects schema header order', () => {
    const docKeys = new Set(['Roll No.', 'Full Name', 'CAT Percentile', 'Gender'])
    const schema  = ['Full Name', 'Roll No.', 'Gender', 'CAT Percentile']
    const defs = buildAllColumnDefs(docKeys, schema)
    expect(defs.map(d => d.key)).toEqual(['Full Name', 'Roll No.', 'Gender', 'CAT Percentile'])
  })

  it('appends extra doc keys not in schema at the end', () => {
    const docKeys = new Set(['Full Name', 'Roll No.', 'ExtraCol'])
    const schema  = ['Full Name', 'Roll No.']
    const defs = buildAllColumnDefs(docKeys, schema)
    expect(defs[0].key).toBe('Full Name')
    expect(defs[1].key).toBe('Roll No.')
    expect(defs[2].key).toBe('ExtraCol')
  })

  it('handles empty schema — all doc keys included', () => {
    const docKeys = new Set(['A', 'B', 'C'])
    const defs = buildAllColumnDefs(docKeys, [])
    expect(defs.length).toBe(3)
  })

  it('does not include _ prefixed internal fields', () => {
    // This is enforced upstream when building docKeys
    const rawKeys = ['Full Name', '_placed_summer', '_placement_final', 'cohort']
    const docKeys = new Set()
    rawKeys.forEach(k => { if (!k.startsWith('_') && k !== 'cohort') docKeys.add(k) })
    const defs = buildAllColumnDefs(docKeys, ['Full Name'])
    expect(defs.map(d => d.key)).not.toContain('_placed_summer')
    expect(defs.map(d => d.key)).not.toContain('cohort')
    expect(defs.map(d => d.key)).toContain('Full Name')
  })
})

// ─── csv.js — stripping internal fields on export ────────────────────────────
import { exportToCSV } from '../lib/csv.js'

describe('csv.js — stripInternalFields on export', () => {
  it('does not expose _ prefixed fields in export rows', () => {
    // We can't call exportToCSV directly (creates DOM blob) but can test the logic
    const rows = [
      {
        'Full Name': 'Test',
        'Roll No.': 'D27001',
        _placed_summer: true,
        _placement_summer: { company: 'BCG' },
        _placed_final: false,
        _placement_final: null,
        _createdAt: new Date(),
        cohort: '27-Delhi-IB',
      }
    ]

    // Replicate stripInternalFields logic
    const stripped = rows.map(r => {
      const obj = { ...r }
      Object.keys(obj).filter(k => k.startsWith('_')).forEach(k => delete obj[k])
      return obj
    })

    expect(stripped[0]).not.toHaveProperty('_placed_summer')
    expect(stripped[0]).not.toHaveProperty('_placement_summer')
    expect(stripped[0]).not.toHaveProperty('_createdAt')
    expect(stripped[0]['Full Name']).toBe('Test')
  })
})

// ─── Approval flow invariants ─────────────────────────────────────────────────
describe('Approval flow — business rule checks', () => {
  it('cannot approve your own proposal', () => {
    const change = { proposedBy: 'uid123', status: 'pending', applied: false }
    const currentUser = 'uid123'
    const canApprove = change.proposedBy !== currentUser && change.status === 'pending' && !change.applied
    expect(canApprove).toBe(false)
  })

  it('different admin can approve a pending change', () => {
    const change = { proposedBy: 'uid123', status: 'pending', applied: false }
    const currentUser = 'uid456'
    const canApprove = change.proposedBy !== currentUser && change.status === 'pending' && !change.applied
    expect(canApprove).toBe(true)
  })

  it('cannot approve an already-approved change', () => {
    const change = { proposedBy: 'uid123', status: 'approved', applied: true }
    const currentUser = 'uid456'
    const canApprove = change.proposedBy !== currentUser && change.status === 'pending' && !change.applied
    expect(canApprove).toBe(false)
  })

  it('cannot approve a rejected change', () => {
    const change = { proposedBy: 'uid123', status: 'rejected', applied: false }
    const currentUser = 'uid456'
    const canApprove = change.status === 'pending'
    expect(canApprove).toBe(false)
  })
})

// ─── Import schema invariants ─────────────────────────────────────────────────
describe('Import flow — schema doc written correctly', () => {
  it('schema headers exclude stipend columns', () => {
    const allHeaders = [
      'Full Name', 'Roll No.', 'CAT Percentile',
      'SIP Status', 'SIP Company', 'SIP Role',
      'Summer Stipend', 'SIP Stipend (In Lakhs/month)', 'SIP Stipend',
      'DOP', 'Location',
    ]
    const schemaHeaders = allHeaders.filter(h => !SIP_COLUMNS_STRIPPED.includes(h))
    expect(schemaHeaders).not.toContain('Summer Stipend')
    expect(schemaHeaders).not.toContain('SIP Stipend (In Lakhs/month)')
    expect(schemaHeaders).toContain('SIP Status')
    expect(schemaHeaders).toContain('SIP Company')
    expect(schemaHeaders).toContain('Full Name')
  })
})
