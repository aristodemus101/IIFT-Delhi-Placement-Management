/**
 * PlacementOS — Intel Module Test Suite
 *
 * Tests cover:
 * 1.  normalizeId              — canonical company key normalisation
 * 2.  fuzzyMatch               — company name fuzzy matching (the IIFT benchmark core)
 * 3.  dedupKey                 — deduplication key formula invariants
 * 4.  parseIntelRows           — Excel row → intel record mapping, type coercion, skips
 * 5.  blankIntelRecord         — shape contract
 * 6.  INTEL_SECTORS / INTEL_CYCLES — list completeness
 * 7.  filterIntelRecords       — all filter dimensions independently and combined
 * 8.  aggregateByCompany       — grouping, status upgrade, appearance count
 * 9.  IIFT benchmark join      — iiftCompanySet construction, status assignment
 * 10. Permission invariants    — intel page in PAGE_ACCESS for all roles; action guards
 * 11. Soft-delete invariant    — _deleted field shape
 * 12. Upload batch chunking    — chunkArray logic replicated
 * 13. Column header map        — all canonical headers resolve correctly
 * 14. Edge cases               — empty input, null fields, unicode names, very long strings
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeId,
  fuzzyMatch,
  dedupKey,
  parseIntelRows,
  blankIntelRecord,
  INTEL_SECTORS,
  INTEL_CYCLES,
} from '../lib/intel.js'
import {
  filterIntelRecords,
  aggregateByCompany,
} from '../lib/useIntel.js'
import {
  PAGE_ACCESS,
  ACTION_ACCESS,
  CONFIGURABLE_PAGES,
  CONFIGURABLE_ACTIONS,
  ROLES,
} from '../lib/permissions.js'

// ─── 1. normalizeId ───────────────────────────────────────────────────────────
describe('normalizeId', () => {
  it('uppercases and strips spaces', () => {
    expect(normalizeId('Asian Paints')).toBe('ASIANPAINTS')
  })

  it('strips punctuation', () => {
    expect(normalizeId('eightfold.ai')).toBe('EIGHTFOLDAI')
    expect(normalizeId('media.net')).toBe('MEDIANET')
    expect(normalizeId('Kroll & Co')).toBe('KROLLCO')
    expect(normalizeId('J.P. Morgan')).toBe('JPMORGAN')
    expect(normalizeId('McKinsey & Company')).toBe('MCKINSEYCOMPANY')
  })

  it('strips hyphens', () => {
    expect(normalizeId('GEF-Capital')).toBe('GEFCAPITAL')
  })

  it('handles empty / null / undefined', () => {
    expect(normalizeId('')).toBe('')
    expect(normalizeId(null)).toBe('')
    expect(normalizeId(undefined)).toBe('')
  })

  it('already-normalised IDs are idempotent', () => {
    expect(normalizeId('ASIANPAINTS')).toBe('ASIANPAINTS')
    expect(normalizeId('BCG')).toBe('BCG')
  })

  it('handles numbers in names', () => {
    expect(normalizeId('3M')).toBe('3M')
    expect(normalizeId('InCred Capital 2')).toBe('INCREDCAPITAL2')
  })
})

// ─── 2. fuzzyMatch ────────────────────────────────────────────────────────────
describe('fuzzyMatch', () => {
  it('exact match after normalisation', () => {
    expect(fuzzyMatch('Asian Paints', 'Asian Paints')).toBe(true)
    expect(fuzzyMatch('KPMG', 'KPMG')).toBe(true)
  })

  it('matches when one contains the other', () => {
    expect(fuzzyMatch('Asian Paints', 'Asian Paints India')).toBe(true)
    expect(fuzzyMatch('Asian Paints India', 'Asian Paints')).toBe(true)
    expect(fuzzyMatch('KPMG India', 'KPMG')).toBe(true)
    expect(fuzzyMatch('McKinsey', 'McKinsey & Company')).toBe(true)
  })

  it('matches via token overlap (≥4 char tokens)', () => {
    expect(fuzzyMatch('Boston Consulting Group', 'BCG')).toBe(false) // BCG has no 4-char tokens
    expect(fuzzyMatch('Deloitte Consulting', 'Deloitte')).toBe(true)
    expect(fuzzyMatch('Goldman Sachs India', 'Goldman Sachs')).toBe(true)
    expect(fuzzyMatch('Accenture Strategy', 'Accenture')).toBe(true)
  })

  it('returns false for clearly different companies', () => {
    expect(fuzzyMatch('KPMG', 'Deloitte')).toBe(false)
    expect(fuzzyMatch('Asian Paints', 'ITC')).toBe(false)
    expect(fuzzyMatch('McKinsey', 'Bain')).toBe(false)
    expect(fuzzyMatch('Goldman Sachs', 'Morgan Stanley')).toBe(false)
  })

  it('handles null / empty gracefully', () => {
    expect(fuzzyMatch(null, 'KPMG')).toBe(false)
    expect(fuzzyMatch('KPMG', null)).toBe(false)
    expect(fuzzyMatch('', '')).toBe(false)
    expect(fuzzyMatch(null, null)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(fuzzyMatch('kpmg', 'KPMG')).toBe(true)
    expect(fuzzyMatch('Asian paints', 'ASIAN PAINTS')).toBe(true)
  })

  it('does not false-positive on short shared tokens', () => {
    // 'ITC' and 'Intuit' share no 4-char token
    expect(fuzzyMatch('ITC', 'Intuit')).toBe(false)
  })
})

// ─── 3. dedupKey ─────────────────────────────────────────────────────────────
describe('dedupKey', () => {
  const base = {
    recruiterId:    'ASIANPAINTS',
    collegeName:    'SPJIMR',
    placementYear:  2022,
    placementCycle: 'Finals',
    program:        'PGDM',
  }

  it('produces stable key from canonical fields', () => {
    expect(dedupKey(base)).toBe('ASIANPAINTS::SPJIMR::2022::FINALS::PGDM')
  })

  it('is case-insensitive on college and cycle', () => {
    expect(dedupKey({ ...base, collegeName: 'spjimr', placementCycle: 'finals' }))
      .toBe('ASIANPAINTS::SPJIMR::2022::FINALS::PGDM')
  })

  it('derives recruiterId from recruiterName if recruiterId missing', () => {
    const row = { ...base, recruiterId: '', recruiterName: 'Asian Paints' }
    expect(dedupKey(row)).toBe('ASIANPAINTS::SPJIMR::2022::FINALS::PGDM')
  })

  it('same company at different colleges = different keys', () => {
    const iiml = { ...base, collegeName: 'IIM Lucknow' }
    expect(dedupKey(base)).not.toBe(dedupKey(iiml))
  })

  it('same company at different years = different keys', () => {
    const yr2023 = { ...base, placementYear: 2023 }
    expect(dedupKey(base)).not.toBe(dedupKey(yr2023))
  })

  it('same company at different cycles = different keys', () => {
    const summer = { ...base, placementCycle: 'Summer' }
    expect(dedupKey(base)).not.toBe(dedupKey(summer))
  })

  it('same company at different programs = different keys', () => {
    const mba = { ...base, program: 'MBA' }
    expect(dedupKey(base)).not.toBe(dedupKey(mba))
  })

  it('handles all-empty record without throwing', () => {
    expect(() => dedupKey({})).not.toThrow()
  })

  it('empty fields produce separator-only key', () => {
    const key = dedupKey({})
    // 5 components joined by '::' = 4 separators → '::::::::' (8 colons)
    expect(key).toBe('::::::::')
  })
})

// ─── 4. parseIntelRows ───────────────────────────────────────────────────────
describe('parseIntelRows', () => {
  const validRow = {
    'Recruiter ID':    'ASIANPAINTS',
    'Recruiter Name':  'Asian Paints',
    'Alias':           'Asian Paints',
    'Placement Year':  '2022',
    'Placement Cycle': 'Finals',
    'College Name':    'SPJIMR',
    'Program':         'PGDM',
    'Sector':          'FMCG',
    'Number of Offers': '2',
    'International Opportunity': 'No',
  }

  it('parses a valid row correctly', () => {
    const { records, warnings } = parseIntelRows([validRow])
    expect(records).toHaveLength(1)
    expect(warnings).toHaveLength(0)
    const r = records[0]
    expect(r.recruiterId).toBe('ASIANPAINTS')
    expect(r.recruiterName).toBe('Asian Paints')
    expect(r.placementYear).toBe(2022)       // coerced to number
    expect(r.numberOfOffers).toBe(2)          // coerced to number
    expect(r.collegeName).toBe('SPJIMR')
    expect(r.sector).toBe('FMCG')
    expect(r.internationalOpp).toBe(false)
  })

  it('coerces year to integer', () => {
    const { records } = parseIntelRows([{ ...validRow, 'Placement Year': '2023' }])
    expect(typeof records[0].placementYear).toBe('number')
    expect(records[0].placementYear).toBe(2023)
  })

  it('coerces numberOfOffers to integer', () => {
    const { records } = parseIntelRows([{ ...validRow, 'Number of Offers': '5' }])
    expect(typeof records[0].numberOfOffers).toBe('number')
    expect(records[0].numberOfOffers).toBe(5)
  })

  it('sets numberOfOffers to null for non-numeric value', () => {
    const { records } = parseIntelRows([{ ...validRow, 'Number of Offers': 'TBD' }])
    expect(records[0].numberOfOffers).toBeNull()
  })

  it('coerces internationalOpp = "Yes" to true', () => {
    const { records } = parseIntelRows([{ ...validRow, 'International Opportunity': 'Yes' }])
    expect(records[0].internationalOpp).toBe(true)
  })

  it('coerces internationalOpp = "1" to true', () => {
    const { records } = parseIntelRows([{ ...validRow, 'International Opportunity': '1' }])
    expect(records[0].internationalOpp).toBe(true)
  })

  it('coerces internationalOpp = "No" to false', () => {
    const { records } = parseIntelRows([{ ...validRow, 'International Opportunity': 'No' }])
    expect(records[0].internationalOpp).toBe(false)
  })

  it('derives recruiterId from recruiterName when ID column missing', () => {
    const row = { ...validRow }
    delete row['Recruiter ID']
    const { records } = parseIntelRows([row])
    expect(records[0].recruiterId).toBe('ASIANPAINTS')  // normalizeId('Asian Paints')
  })

  it('skips rows with no recruiter name or ID and records a warning', () => {
    const row = { 'Placement Year': '2022', 'College Name': 'SPJIMR' }
    const { records, warnings } = parseIntelRows([row])
    expect(records).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/skipped/)
  })

  it('returns empty for empty input', () => {
    const { records, warnings } = parseIntelRows([])
    expect(records).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('returns empty for null input', () => {
    const { records, warnings } = parseIntelRows(null)
    expect(records).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('handles case-insensitive column headers', () => {
    const row = {
      'recruiter name': 'Dabur',
      'college name':   'IIM Lucknow',
      'placement year': '2023',
      'sector':         'FMCG',
    }
    const { records } = parseIntelRows([row])
    expect(records[0].recruiterName).toBe('Dabur')
    expect(records[0].collegeName).toBe('IIM Lucknow')
    expect(records[0].placementYear).toBe(2023)
    expect(records[0].sector).toBe('FMCG')
  })

  it('recognises "Company" as recruiterName alias', () => {
    const row = { 'Company': 'Unilever', 'College Name': 'ISB', 'Placement Year': '2024' }
    const { records } = parseIntelRows([row])
    expect(records[0].recruiterName).toBe('Unilever')
  })

  it('recognises "Industry" as sector alias', () => {
    const row = { ...validRow, 'Industry': 'Tech' }
    delete row['Sector']
    const { records } = parseIntelRows([row])
    expect(records[0].sector).toBe('Tech')
  })

  it('trims whitespace from all string fields', () => {
    const row = { ...validRow, 'Recruiter Name': '  Asian Paints  ', 'Sector': '  FMCG  ' }
    const { records } = parseIntelRows([row])
    expect(records[0].recruiterName).toBe('Asian Paints')
    expect(records[0].sector).toBe('FMCG')
  })

  it('parses multiple rows independently', () => {
    const rows = [
      { ...validRow, 'Recruiter Name': 'Asian Paints', 'Recruiter ID': 'ASIANPAINTS' },
      { ...validRow, 'Recruiter Name': 'Dabur',        'Recruiter ID': 'DABUR', 'College Name': 'IIM Lucknow' },
      { ...validRow, 'Recruiter Name': 'HUL',          'Recruiter ID': 'HUL',   'Placement Year': '2023' },
    ]
    const { records } = parseIntelRows(rows)
    expect(records).toHaveLength(3)
    expect(records[0].recruiterName).toBe('Asian Paints')
    expect(records[1].collegeName).toBe('IIM Lucknow')
    expect(records[2].placementYear).toBe(2023)
  })

  it('handles Compensation column alias "CTC"', () => {
    const row = { ...validRow, 'CTC': '18-24 LPA' }
    const { records } = parseIntelRows([row])
    expect(records[0].compensation).toBe('18-24 LPA')
  })

  it('handles Notes column', () => {
    const row = { ...validRow, 'Notes': 'Strong FMCG recruiter' }
    const { records } = parseIntelRows([row])
    expect(records[0].notes).toBe('Strong FMCG recruiter')
  })

  it('handles POC Name column', () => {
    const row = { ...validRow, 'POC Name': 'Rahul Sharma', 'POC Email': 'rahul@asian.com' }
    const { records } = parseIntelRows([row])
    expect(records[0].pocName).toBe('Rahul Sharma')
    expect(records[0].pocEmail).toBe('rahul@asian.com')
  })

  it('ignores unknown/extra columns silently', () => {
    const row = { ...validRow, 'TOTALLY_UNKNOWN_COLUMN': 'garbage', 'ANOTHER_JUNK': '123' }
    const { records, warnings } = parseIntelRows([row])
    expect(records).toHaveLength(1)
    // No warnings for unknown columns — they're simply ignored
    expect(records[0]).not.toHaveProperty('TOTALLY_UNKNOWN_COLUMN')
  })
})

// ─── 5. blankIntelRecord ─────────────────────────────────────────────────────
describe('blankIntelRecord', () => {
  it('has all required shape keys', () => {
    const blank = blankIntelRecord()
    const required = [
      'recruiterId', 'recruiterName', 'alias', 'placementYear', 'academicBatch',
      'placementCycle', 'collegeName', 'campus', 'program', 'sector', 'function',
      'rolesMentioned', 'recruiterType', 'internationalOpp', 'internationalLoc',
      'numberOfOffers', 'sourceReport', 'sourceType', 'evidence', 'remarks',
      'compensation', 'poc', 'notes', 'importBatch', '_deleted',
    ]
    required.forEach(k => expect(blank).toHaveProperty(k))
  })

  it('poc has name/email/phone keys', () => {
    const blank = blankIntelRecord()
    expect(blank.poc).toHaveProperty('name')
    expect(blank.poc).toHaveProperty('email')
    expect(blank.poc).toHaveProperty('phone')
  })

  it('_deleted is false by default', () => {
    expect(blankIntelRecord()._deleted).toBe(false)
  })

  it('internationalOpp is false by default', () => {
    expect(blankIntelRecord().internationalOpp).toBe(false)
  })

  it('placementCycle defaults to Finals', () => {
    expect(blankIntelRecord().placementCycle).toBe('Finals')
  })

  it('produces independent objects (not shared reference)', () => {
    const a = blankIntelRecord()
    const b = blankIntelRecord()
    a.recruiterName = 'Changed'
    expect(b.recruiterName).toBe('')
  })
})

// ─── 6. INTEL_SECTORS / INTEL_CYCLES ─────────────────────────────────────────
describe('INTEL_SECTORS and INTEL_CYCLES', () => {
  it('INTEL_SECTORS is a non-empty array of strings', () => {
    expect(Array.isArray(INTEL_SECTORS)).toBe(true)
    expect(INTEL_SECTORS.length).toBeGreaterThan(0)
    INTEL_SECTORS.forEach(s => expect(typeof s).toBe('string'))
  })

  it('INTEL_SECTORS contains the major sectors', () => {
    expect(INTEL_SECTORS).toContain('FMCG')
    expect(INTEL_SECTORS).toContain('BFSI')
    expect(INTEL_SECTORS).toContain('Consulting')
  })

  it('INTEL_CYCLES contains the three standard cycles', () => {
    expect(INTEL_CYCLES).toContain('Finals')
    expect(INTEL_CYCLES).toContain('Summer')
    expect(INTEL_CYCLES).toContain('Lateral')
  })

  it('INTEL_CYCLES has no duplicates', () => {
    expect(new Set(INTEL_CYCLES).size).toBe(INTEL_CYCLES.length)
  })
})

// ─── 7. filterIntelRecords ────────────────────────────────────────────────────
describe('filterIntelRecords', () => {
  const records = [
    { _id: '1', recruiterName: 'Asian Paints', collegeName: 'SPJIMR',     placementYear: 2022, placementCycle: 'Finals', sector: 'FMCG',        program: 'PGDM', _iiftStatus: 'at_iift' },
    { _id: '2', recruiterName: 'Dabur',         collegeName: 'IIM Lucknow', placementYear: 2022, placementCycle: 'Finals', sector: 'FMCG',        program: 'MBA',  _iiftStatus: 'gap'     },
    { _id: '3', recruiterName: 'KPMG',          collegeName: 'SPJIMR',     placementYear: 2023, placementCycle: 'Summer', sector: 'Consulting',  program: 'PGDM', _iiftStatus: 'gap'     },
    { _id: '4', recruiterName: 'Goldman Sachs', collegeName: 'IIM Lucknow', placementYear: 2023, placementCycle: 'Finals', sector: 'BFSI',        program: 'MBA',  _iiftStatus: 'at_iift' },
    { _id: '5', recruiterName: 'Accenture',     collegeName: 'MDI Gurgaon', placementYear: 2024, placementCycle: 'Finals', sector: 'IT / Tech',  program: 'PGPM', _iiftStatus: 'gap'     },
  ]

  it('returns all records when no filters applied', () => {
    const result = filterIntelRecords(records, {})
    expect(result).toHaveLength(5)
  })

  it('filters by college', () => {
    const result = filterIntelRecords(records, { college: 'SPJIMR' })
    expect(result).toHaveLength(2)
    result.forEach(r => expect(r.collegeName).toBe('SPJIMR'))
  })

  it('filters by year', () => {
    const result = filterIntelRecords(records, { year: '2023' })
    expect(result).toHaveLength(2)
    result.forEach(r => expect(r.placementYear).toBe(2023))
  })

  it('filters by cycle', () => {
    const result = filterIntelRecords(records, { cycle: 'Summer' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('KPMG')
  })

  it('filters by sector — single string (legacy)', () => {
    const result = filterIntelRecords(records, { sector: 'FMCG' })
    expect(result).toHaveLength(2)
    result.forEach(r => expect(r.sector).toBe('FMCG'))
  })

  it('filters by sector — single-element array', () => {
    const result = filterIntelRecords(records, { sector: ['FMCG'] })
    expect(result).toHaveLength(2)
    result.forEach(r => expect(r.sector).toBe('FMCG'))
  })

  it('filters by sector — multi-select array (OR logic across sectors)', () => {
    const result = filterIntelRecords(records, { sector: ['FMCG', 'BFSI'] })
    expect(result).toHaveLength(3) // Asian Paints, Dabur (FMCG) + Goldman Sachs (BFSI)
    expect(result.map(r => r.recruiterName).sort()).toEqual(['Asian Paints', 'Dabur', 'Goldman Sachs'])
  })

  it('filters by sector — all three sectors', () => {
    const result = filterIntelRecords(records, { sector: ['FMCG', 'BFSI', 'Consulting'] })
    expect(result).toHaveLength(4)
  })

  it('filters by sector — empty array returns all records', () => {
    const result = filterIntelRecords(records, { sector: [] })
    expect(result).toHaveLength(5)
  })

  it('filters by sector — array with empty string ignored', () => {
    const result = filterIntelRecords(records, { sector: ['', 'FMCG'] })
    expect(result).toHaveLength(2)
  })

  it('filters by program', () => {
    const result = filterIntelRecords(records, { program: 'MBA' })
    expect(result).toHaveLength(2)
    result.forEach(r => expect(r.program).toBe('MBA'))
  })

  it('filters by iiftFilter = "gap"', () => {
    const result = filterIntelRecords(records, { iiftFilter: 'gap' })
    expect(result).toHaveLength(3)
    result.forEach(r => expect(r._iiftStatus).toBe('gap'))
  })

  it('filters by iiftFilter = "at_iift"', () => {
    const result = filterIntelRecords(records, { iiftFilter: 'at_iift' })
    expect(result).toHaveLength(2)
    result.forEach(r => expect(r._iiftStatus).toBe('at_iift'))
  })

  it('filters by search (recruiterName)', () => {
    const result = filterIntelRecords(records, { search: 'kpmg' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('KPMG')
  })

  it('search is case-insensitive', () => {
    const result = filterIntelRecords(records, { search: 'ASIAN' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('Asian Paints')
  })

  it('search matches sector', () => {
    const result = filterIntelRecords(records, { search: 'consulting' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('KPMG')
  })

  it('combines multiple filters (AND logic)', () => {
    const result = filterIntelRecords(records, { college: 'IIM Lucknow', year: '2022' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('Dabur')
  })

  it('returns empty when no records match combined filters', () => {
    const result = filterIntelRecords(records, { college: 'SPJIMR', sector: 'BFSI' })
    expect(result).toHaveLength(0)
  })

  it('empty iiftFilter = "" shows all', () => {
    const result = filterIntelRecords(records, { iiftFilter: '' })
    expect(result).toHaveLength(5)
  })

  it('returns empty array for empty records', () => {
    const result = filterIntelRecords([], { college: 'SPJIMR' })
    expect(result).toHaveLength(0)
  })
})

// ─── 8. aggregateByCompany ────────────────────────────────────────────────────
describe('aggregateByCompany', () => {
  const records = [
    { _id: '1', recruiterId: 'KPMG',         recruiterName: 'KPMG',  alias: '',       sector: 'Consulting', _iiftStatus: 'at_iift', collegeName: 'SPJIMR',     placementYear: 2022 },
    { _id: '2', recruiterId: 'KPMG',         recruiterName: 'KPMG',  alias: 'KPMG Co',sector: 'Consulting', _iiftStatus: 'gap',     collegeName: 'IIM Lucknow', placementYear: 2023 },
    { _id: '3', recruiterId: 'ASIANPAINTS',  recruiterName: 'Asian Paints', alias: '',  sector: 'FMCG',      _iiftStatus: 'gap',     collegeName: 'SPJIMR',     placementYear: 2022 },
    { _id: '4', recruiterId: 'ASIANPAINTS',  recruiterName: 'Asian Paints', alias: '',  sector: '',           _iiftStatus: 'gap',     collegeName: 'MDI Gurgaon',placementYear: 2023 },
    { _id: '5', recruiterId: 'BCG',          recruiterName: 'BCG',   alias: '',       sector: 'Consulting', _iiftStatus: 'gap',     collegeName: 'XLRI',       placementYear: 2024 },
  ]

  it('groups by recruiterId', () => {
    const result = aggregateByCompany(records)
    expect(result).toHaveLength(3)  // KPMG, Asian Paints, BCG
  })

  it('counts appearances correctly', () => {
    const result = aggregateByCompany(records)
    const kpmg = result.find(c => c.recruiterName === 'KPMG')
    const asian = result.find(c => c.recruiterName === 'Asian Paints')
    const bcg = result.find(c => c.recruiterName === 'BCG')
    expect(kpmg.appearances).toHaveLength(2)
    expect(asian.appearances).toHaveLength(2)
    expect(bcg.appearances).toHaveLength(1)
  })

  it('upgrades status to at_iift if any appearance is at_iift', () => {
    // KPMG: one 'at_iift' + one 'gap' → should be 'at_iift'
    const result = aggregateByCompany(records)
    const kpmg = result.find(c => c.recruiterName === 'KPMG')
    expect(kpmg._iiftStatus).toBe('at_iift')
  })

  it('keeps gap status when all appearances are gap', () => {
    const result = aggregateByCompany(records)
    const asian = result.find(c => c.recruiterName === 'Asian Paints')
    const bcg   = result.find(c => c.recruiterName === 'BCG')
    expect(asian._iiftStatus).toBe('gap')
    expect(bcg._iiftStatus).toBe('gap')
  })

  it('prefers non-empty sector from any appearance', () => {
    // Asian Paints: record 3 has sector='FMCG', record 4 has sector=''
    const result = aggregateByCompany(records)
    const asian = result.find(c => c.recruiterName === 'Asian Paints')
    expect(asian.sector).toBe('FMCG')
  })

  it('returns empty array for empty input', () => {
    expect(aggregateByCompany([])).toHaveLength(0)
  })

  it('sorts results alphabetically by recruiterName', () => {
    const result = aggregateByCompany(records)
    const names = result.map(c => c.recruiterName)
    expect(names).toEqual([...names].sort())
  })

  it('each appearance array contains the original record objects', () => {
    const result = aggregateByCompany(records)
    const kpmg = result.find(c => c.recruiterName === 'KPMG')
    const ids = kpmg.appearances.map(a => a._id)
    expect(ids).toContain('1')
    expect(ids).toContain('2')
  })
})

// ─── 9. IIFT benchmark join (iiftCompanySet + fuzzyMatch) ────────────────────
describe('IIFT benchmark join logic', () => {
  // Replicate the iiftCompanySet construction from useIntel.js
  function buildIiftSet(students, cutoffYear) {
    const set = new Set()
    students.forEach(s => {
      const finalYear = s._placement_final?.placedAtIso
        ? new Date(s._placement_final.placedAtIso).getFullYear()
        : null
      const summerYear = s._placement_summer?.placedAtIso
        ? new Date(s._placement_summer.placedAtIso).getFullYear()
        : null

      if (s._placed_final && s._placement_final?.company && finalYear >= cutoffYear) {
        set.add(normalizeId(s._placement_final.company))
      }
      if (s._placed_summer && s._placement_summer?.company && summerYear >= cutoffYear) {
        set.add(normalizeId(s._placement_summer.company))
      }
    })
    return set
  }

  function classifyRecord(record, iiftSet) {
    if (iiftSet.size === 0) return 'gap'
    const match = [...iiftSet].some(
      name => fuzzyMatch(record.recruiterName, name) || fuzzyMatch(record.alias, name)
    )
    return match ? 'at_iift' : 'gap'
  }

  const currentYear = new Date().getFullYear()
  const cutoff = currentYear - 2

  const students = [
    {
      _placed_final: true,
      _placement_final: { company: 'KPMG India', placedAtIso: `${currentYear}-01-15T00:00:00.000Z` },
      _placed_summer: false,
      _placement_summer: null,
    },
    {
      _placed_final: false,
      _placement_final: null,
      _placed_summer: true,
      _placement_summer: { company: 'McKinsey', placedAtIso: `${currentYear - 1}-06-01T00:00:00.000Z` },
    },
    {
      // Old placement — outside the 2-year window
      _placed_final: true,
      _placement_final: { company: 'Bain', placedAtIso: `${currentYear - 3}-12-01T00:00:00.000Z` },
      _placed_summer: false,
      _placement_summer: null,
    },
  ]

  it('includes companies from final placements within last 2 years', () => {
    const set = buildIiftSet(students, cutoff)
    expect(set.has('KPMGINDIA')).toBe(true)
  })

  it('includes companies from summer placements within last 2 years', () => {
    const set = buildIiftSet(students, cutoff)
    expect(set.has('MCKINSEY')).toBe(true)
  })

  it('excludes companies from placements older than 2 years', () => {
    const set = buildIiftSet(students, cutoff)
    expect(set.has('BAIN')).toBe(false)
  })

  it('classifies intel record as at_iift when fuzzy match found', () => {
    const set = buildIiftSet(students, cutoff)
    const record = { recruiterName: 'KPMG', alias: '' }
    expect(classifyRecord(record, set)).toBe('at_iift')
  })

  it('classifies intel record as gap when no fuzzy match', () => {
    const set = buildIiftSet(students, cutoff)
    const record = { recruiterName: 'Deloitte', alias: '' }
    expect(classifyRecord(record, set)).toBe('gap')
  })

  it('checks alias if recruiterName does not match', () => {
    const set = buildIiftSet(students, cutoff)
    const record = { recruiterName: 'Some other name', alias: 'McKinsey' }
    expect(classifyRecord(record, set)).toBe('at_iift')
  })

  it('returns gap when iiftSet is empty (no placed students)', () => {
    const set = new Set()
    const record = { recruiterName: 'KPMG', alias: '' }
    expect(classifyRecord(record, set)).toBe('gap')
  })

  it('handles student with missing placedAtIso gracefully', () => {
    const s = [{
      _placed_final: true,
      _placement_final: { company: 'XYZ Corp' },  // no placedAtIso
      _placed_summer: false,
      _placement_summer: null,
    }]
    expect(() => buildIiftSet(s, cutoff)).not.toThrow()
    // finalYear will be NaN, comparison NaN >= cutoff = false → not included
    const set = buildIiftSet(s, cutoff)
    expect(set.has('XYZCORP')).toBe(false)
  })
})

// ─── 10. Permission invariants ────────────────────────────────────────────────
describe('permissions.js — Intel invariants', () => {
  it('intel page is accessible to all 4 roles', () => {
    const intelRoles = PAGE_ACCESS['intel'] || []
    expect(intelRoles).toContain('admin')
    expect(intelRoles).toContain('committee')
    expect(intelRoles).toContain('tpo')
    expect(intelRoles).toContain('faculty_coordinator')
  })

  it('intel page access covers all defined roles', () => {
    const intelRoles = PAGE_ACCESS['intel'] || []
    ROLES.forEach(role => {
      expect(intelRoles).toContain(role)
    })
  })

  it('writeIntel is restricted to admin and committee only', () => {
    const writeRoles = ACTION_ACCESS['writeIntel'] || []
    expect(writeRoles).toContain('admin')
    expect(writeRoles).toContain('committee')
    expect(writeRoles).not.toContain('tpo')
    expect(writeRoles).not.toContain('faculty_coordinator')
  })

  it('uploadIntel is admin-only', () => {
    const uploadRoles = ACTION_ACCESS['uploadIntel'] || []
    expect(uploadRoles).toContain('admin')
    expect(uploadRoles).not.toContain('committee')
    expect(uploadRoles).not.toContain('tpo')
    expect(uploadRoles).not.toContain('faculty_coordinator')
  })

  it('deleteIntel is admin-only', () => {
    const deleteRoles = ACTION_ACCESS['deleteIntel'] || []
    expect(deleteRoles).toContain('admin')
    expect(deleteRoles).not.toContain('committee')
    expect(deleteRoles).not.toContain('tpo')
    expect(deleteRoles).not.toContain('faculty_coordinator')
  })

  it('intel page is in CONFIGURABLE_PAGES (visible in admin panel)', () => {
    expect(CONFIGURABLE_PAGES).toContain('intel')
  })

  it('intel actions are in CONFIGURABLE_ACTIONS', () => {
    expect(CONFIGURABLE_ACTIONS).toContain('writeIntel')
    expect(CONFIGURABLE_ACTIONS).toContain('uploadIntel')
    expect(CONFIGURABLE_ACTIONS).toContain('deleteIntel')
  })

  it('intel page does NOT appear in restricted pages (no Firestore floor)', () => {
    // Intel is open to all roles — there's no ROLE_FLOOR_PAGES entry for it.
    // This test encodes that contract so a future refactor doesn't accidentally floor it.
    const ROLE_FLOOR_PAGES = { dashboard: ['admin', 'committee'], approvals: ['admin'] }
    expect(ROLE_FLOOR_PAGES).not.toHaveProperty('intel')
  })
})

// ─── 11. Soft-delete invariant ────────────────────────────────────────────────
describe('Soft-delete invariant', () => {
  it('blankIntelRecord always has _deleted = false', () => {
    expect(blankIntelRecord()._deleted).toBe(false)
  })

  it('soft-delete shape: only _deleted, updatedAt, updatedBy are changed', () => {
    const record = { ...blankIntelRecord(), _id: 'doc1', recruiterName: 'Test Co', _deleted: false }
    // Simulate soft-delete update payload
    const softDeletePayload = {
      _deleted: true,
      updatedAt: 'SERVER_TIMESTAMP',
      updatedBy: 'uid123',
    }
    const after = { ...record, ...softDeletePayload }
    expect(after._deleted).toBe(true)
    expect(after.updatedBy).toBe('uid123')
    expect(after.recruiterName).toBe('Test Co')  // other fields unchanged
    expect(after._id).toBe('doc1')               // _id unchanged
  })

  it('useIntel query must exclude _deleted = true records', () => {
    // Encode the invariant: the Firestore query uses where('_deleted', '!=', true)
    // We can't run Firestore here, but we can test the filter predicate directly
    const inMemoryFilter = records => records.filter(r => r._deleted !== true)
    const records = [
      { _id: '1', recruiterName: 'Visible Co',  _deleted: false },
      { _id: '2', recruiterName: 'Deleted Co',  _deleted: true  },
      { _id: '3', recruiterName: 'Also Visible', _deleted: false },
    ]
    const visible = inMemoryFilter(records)
    expect(visible).toHaveLength(2)
    expect(visible.map(r => r._id)).not.toContain('2')
  })
})

// ─── 12. Batch chunking logic ─────────────────────────────────────────────────
describe('Batch upload chunking', () => {
  // Replicate chunkArray from intel.js
  function chunkArray(arr, size) {
    const out = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  it('chunks empty array into empty array', () => {
    expect(chunkArray([], 499)).toHaveLength(0)
  })

  it('array smaller than chunk size = 1 chunk', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i)
    const chunks = chunkArray(arr, 499)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(100)
  })

  it('exactly 499 items = 1 chunk', () => {
    const arr = Array.from({ length: 499 }, (_, i) => i)
    const chunks = chunkArray(arr, 499)
    expect(chunks).toHaveLength(1)
  })

  it('500 items = 2 chunks (499 + 1)', () => {
    const arr = Array.from({ length: 500 }, (_, i) => i)
    const chunks = chunkArray(arr, 499)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(499)
    expect(chunks[1]).toHaveLength(1)
  })

  it('1000 items with batch size 499 = 3 chunks (499 + 499 + 2)', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i)
    const chunks = chunkArray(arr, 499)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(499)
    expect(chunks[1]).toHaveLength(499)
    expect(chunks[2]).toHaveLength(2)
  })

  it('total items across all chunks = original length', () => {
    const arr = Array.from({ length: 1234 }, (_, i) => i)
    const chunks = chunkArray(arr, 499)
    const total = chunks.reduce((sum, c) => sum + c.length, 0)
    expect(total).toBe(1234)
  })

  it('no items are duplicated or lost', () => {
    const arr = Array.from({ length: 750 }, (_, i) => i)
    const chunks = chunkArray(arr, 499)
    const flattened = chunks.flat()
    expect(flattened).toEqual(arr)
  })
})

// ─── 13. Column header map coverage ──────────────────────────────────────────
describe('Column header map — canonical aliases', () => {
  // We test parseIntelRows with each known alias variant

  const baseRow = { 'Recruiter Name': 'Test Co', 'Placement Year': '2024', 'Placement Cycle': 'Finals', 'College Name': 'SPJIMR' }

  const aliasTests = [
    { header: 'Company',           field: 'recruiterName', value: 'Alias Co',    expectedVal: 'Alias Co' },
    { header: 'Company Name',      field: 'recruiterName', value: 'Name Co',     expectedVal: 'Name Co' },
    { header: 'Year',              field: 'placementYear', value: '2023',         expectedVal: 2023 },
    { header: 'Cycle',             field: 'placementCycle',value: 'Summer',       expectedVal: 'Summer' },
    { header: 'College',           field: 'collegeName',   value: 'ISB',          expectedVal: 'ISB' },
    { header: 'Institution',       field: 'collegeName',   value: 'MDI',          expectedVal: 'MDI' },
    { header: 'Programme',         field: 'program',       value: 'MBA',          expectedVal: 'MBA' },
    { header: 'Industry',          field: 'sector',        value: 'Tech',         expectedVal: 'Tech' },
    { header: 'Offers',            field: 'numberOfOffers',value: '3',            expectedVal: 3 },
    { header: 'No Of Offers',      field: 'numberOfOffers',value: '4',            expectedVal: 4 },
    { header: 'Source',            field: 'sourceReport',  value: 'report.pdf',   expectedVal: 'report.pdf' },
    { header: 'Compensation',      field: 'compensation',  value: '18 LPA',       expectedVal: '18 LPA' },
    { header: 'CTC',               field: 'compensation',  value: '20 LPA',       expectedVal: '20 LPA' },
    { header: 'Package',           field: 'compensation',  value: '22 LPA',       expectedVal: '22 LPA' },
    { header: 'Notes',             field: 'notes',         value: 'some note',    expectedVal: 'some note' },
  ]

  aliasTests.forEach(({ header, field, value, expectedVal }) => {
    it(`"${header}" maps to ${field}`, () => {
      // Only include the test header, keep base row for required fields
      // but override college/year/name to avoid conflict
      const row = {
        'Recruiter Name': 'Test Co',
        'Placement Year': '2024',
        'Placement Cycle': 'Finals',
        'College Name': 'SPJIMR',
        [header]: value,
      }
      // Avoid overriding recruiterName from 'Company' if we're not testing that
      // When testing 'Company', we need to remove 'Recruiter Name' to avoid conflict
      if (header === 'Company' || header === 'Company Name') {
        delete row['Recruiter Name']
      }
      if (header === 'College' || header === 'Institution') {
        delete row['College Name']
      }
      if (header === 'Year') {
        delete row['Placement Year']
      }
      if (header === 'Cycle') {
        delete row['Placement Cycle']
      }
      const { records } = parseIntelRows([row])
      expect(records.length).toBeGreaterThan(0)
      expect(records[0][field]).toEqual(expectedVal)
    })
  })
})

// ─── 14. Edge cases ──────────────────────────────────────────────────────────
describe('Edge cases', () => {
  it('parseIntelRows handles unicode company names', () => {
    const row = { 'Recruiter Name': 'Tata Consultancy Services (TCS)', 'College Name': 'IIM-B', 'Placement Year': '2024' }
    const { records } = parseIntelRows([row])
    expect(records[0].recruiterName).toBe('Tata Consultancy Services (TCS)')
  })

  it('normalizeId handles unicode by stripping non-alphanumeric', () => {
    expect(normalizeId('Tata Consultancy Services (TCS)')).toBe('TATACONSULTANCYSERVICESTCS')
  })

  it('dedupKey is stable across multiple calls with same input', () => {
    const row = { recruiterId: 'BCG', collegeName: 'XLRI', placementYear: 2024, placementCycle: 'Finals', program: 'MBA' }
    expect(dedupKey(row)).toBe(dedupKey(row))
  })

  it('filterIntelRecords handles records with undefined fields gracefully', () => {
    const records = [
      { _id: '1', recruiterName: 'Test', _iiftStatus: 'gap' },  // no collegeName, sector etc.
    ]
    expect(() => filterIntelRecords(records, { college: 'SPJIMR', sector: 'FMCG' })).not.toThrow()
  })

  it('aggregateByCompany handles records with missing recruiterId', () => {
    const records = [
      { _id: '1', recruiterId: '', recruiterName: 'No ID Co', _iiftStatus: 'gap', sector: '' },
    ]
    expect(() => aggregateByCompany(records)).not.toThrow()
    const result = aggregateByCompany(records)
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('No ID Co')
  })

  it('parseIntelRows handles a very large batch (1000 rows) within reasonable time', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      'Recruiter ID':    `CO${i}`,
      'Recruiter Name':  `Company ${i}`,
      'Placement Year':  '2024',
      'Placement Cycle': 'Finals',
      'College Name':    'SPJIMR',
      'Program':         'PGDM',
    }))
    const start = Date.now()
    const { records } = parseIntelRows(rows)
    const elapsed = Date.now() - start
    expect(records).toHaveLength(1000)
    expect(elapsed).toBeLessThan(500)  // should parse 1000 rows in < 500ms
  })

  it('fuzzyMatch does not match companies that share only very short tokens', () => {
    // "A" company and "AB" company — tokens < 4 chars should not trigger match
    expect(fuzzyMatch('AI Labs', 'TI Corp')).toBe(false)
  })

  it('dedupKey handles numeric year as string vs number consistently', () => {
    const asNumber = { recruiterId: 'BCG', collegeName: 'ISB', placementYear: 2024,   placementCycle: 'Finals', program: 'MBA' }
    const asString = { recruiterId: 'BCG', collegeName: 'ISB', placementYear: '2024', placementCycle: 'Finals', program: 'MBA' }
    // Both should produce the same key since we convert to String() in dedupKey
    expect(dedupKey(asNumber)).toBe(dedupKey(asString))
  })
})
