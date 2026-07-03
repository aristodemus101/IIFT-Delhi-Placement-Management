/**
 * Integration tests: full data pipeline from raw student + intel data
 * through aggregation, benchmark classification, and filter stacks.
 *
 * No Firebase — all pure functions, no mocks needed.
 */

import { describe, it, expect } from 'vitest'
import { dedupKey, normalizeId, fuzzyMatch, parseIntelRows, blankIntelRecord, INTEL_CYCLES, INTEL_SECTORS } from '../lib/intel.js'
import { filterIntelRecords, aggregateByCompany } from '../lib/useIntel.js'
import { STUDENTS, INTEL_RECORDS, studentCohort } from './mockData.js'

// ── Build IIFT company set from students (mirrors useIntel iiftCompanySet) ───

function buildIiftSet(students, currentYear = new Date().getFullYear()) {
  const cutoff = currentYear - 2
  const set = new Set()
  students.forEach(s => {
    const finalYear = s._placement_final?.placedAtIso
      ? new Date(s._placement_final.placedAtIso).getFullYear()
      : null
    const summerYear = s._placement_summer?.placedAtIso
      ? new Date(s._placement_summer.placedAtIso).getFullYear()
      : null

    if (s._placed_final && s._placement_final?.company && finalYear >= cutoff) {
      set.add(normalizeId(s._placement_final.company))
    }
    if (s._placed_summer && s._placement_summer?.company && summerYear >= cutoff) {
      set.add(normalizeId(s._placement_summer.company))
    }
  })
  return set
}

// ── Enrich intel records with IIFT status (mirrors useIntel enriched memo) ───

function enrichIntel(records, iiftSet) {
  return records.map(r => {
    const matchesIift = iiftSet.size > 0 && [...iiftSet].some(
      iiftName => fuzzyMatch(r.recruiterName, iiftName) || fuzzyMatch(r.alias, iiftName)
    )
    return { ...r, _iiftStatus: matchesIift ? 'at_iift' : 'gap' }
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. IIFT company set construction
// ══════════════════════════════════════════════════════════════════════════════

describe('IIFT company set pipeline', () => {
  it('builds set from placed students within last 2 years', () => {
    // Use 2026 as "current year" so 2025 placements are within window (2026-2=2024)
    const set = buildIiftSet(STUDENTS, 2026)
    expect(set.size).toBeGreaterThan(0)
    // McKinsey placed at IIFT (s1 final: Goldman Sachs, s1 summer: McKinsey)
    expect(set.has(normalizeId('Goldman Sachs'))).toBe(true)
    expect(set.has(normalizeId('McKinsey & Company'))).toBe(true)
  })

  it('excludes companies from placements older than 2 years', () => {
    // Use 2026 → cutoff = 2024. Asian Paints placed in 2024-04 (s5, summer)
    // 2024 >= 2024 → included
    const set = buildIiftSet(STUDENTS, 2026)
    expect(set.has(normalizeId('Asian Paints'))).toBe(true)
  })

  it('excludes placements from before the window', () => {
    // Use 2028 → cutoff = 2026. All 2025 placements would be excluded
    const set = buildIiftSet(STUDENTS, 2028)
    expect(set.size).toBe(0)
  })

  it('handles students with both summer and final placements', () => {
    // s1: summer=McKinsey, final=Goldman Sachs. Both within window
    const set = buildIiftSet(STUDENTS, 2026)
    expect(set.has(normalizeId('McKinsey & Company'))).toBe(true)
    expect(set.has(normalizeId('Goldman Sachs'))).toBe(true)
  })

  it('uses normalizeId for company names (strips punctuation)', () => {
    const set = buildIiftSet(STUDENTS, 2026)
    // "McKinsey & Company" → "MCKINSEYCOMPANY"
    expect(set.has('MCKINSEYCOMPANY')).toBe(true)
  })

  it('excludes unplaced students', () => {
    const set = buildIiftSet(STUDENTS, 2026)
    // s4: _placed_final=false, _placed_summer=false → no contribution
    // s4 has no company so its absence is correct
    expect(set.has('')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. Intel enrichment pipeline (iiftStatus tagging)
// ══════════════════════════════════════════════════════════════════════════════

describe('Intel enrichment pipeline', () => {
  const iiftSet = buildIiftSet(STUDENTS, 2026)
  const enriched = enrichIntel(INTEL_RECORDS, iiftSet)

  it('tags McKinsey as at_iift when matched', () => {
    const mckinsey = enriched.filter(r => r.recruiterName === 'McKinsey & Company')
    mckinsey.forEach(r => {
      expect(r._iiftStatus).toBe('at_iift')
    })
  })

  it('tags Goldman Sachs as at_iift when matched', () => {
    const gs = enriched.filter(r => r.recruiterName === 'Goldman Sachs')
    gs.forEach(r => {
      expect(r._iiftStatus).toBe('at_iift')
    })
  })

  it('tags Asian Paints as at_iift (placed at IIFT in 2024)', () => {
    const ap = enriched.find(r => r.recruiterName === 'Asian Paints')
    expect(ap?._iiftStatus).toBe('at_iift')
  })

  it('tags Credit Suisse as gap (no IIFT placement)', () => {
    const cs = enriched.find(r => r.recruiterName === 'Credit Suisse')
    expect(cs?._iiftStatus).toBe('gap')
  })

  it('all records have _iiftStatus attached', () => {
    enriched.forEach(r => {
      expect(['at_iift', 'gap']).toContain(r._iiftStatus)
    })
  })

  it('enrichment is non-destructive (original records untouched)', () => {
    INTEL_RECORDS.forEach(r => {
      expect(r._iiftStatus).toBeUndefined()
    })
  })

  it('empty IIFT set tags all records as gap', () => {
    const emptySet = new Set()
    const result = enrichIntel(INTEL_RECORDS, emptySet)
    result.forEach(r => {
      expect(r._iiftStatus).toBe('gap')
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. filterIntelRecords() — multi-dimensional filter stack
// ══════════════════════════════════════════════════════════════════════════════

describe('filterIntelRecords() pipeline', () => {
  const iiftSet = buildIiftSet(STUDENTS, 2026)
  const enriched = enrichIntel(INTEL_RECORDS, iiftSet)

  it('returns all records with empty filters', () => {
    const result = filterIntelRecords(enriched, {})
    expect(result).toHaveLength(enriched.length)
  })

  it('filters by college', () => {
    const result = filterIntelRecords(enriched, { college: 'IIM Ahmedabad' })
    // i1 (McKinsey/IIMA/2025) and i5 (Credit Suisse/IIMA/2023)
    expect(result).toHaveLength(2)
    result.forEach(r => expect(r.collegeName).toBe('IIM Ahmedabad'))
  })

  it('filters by year', () => {
    const result = filterIntelRecords(enriched, { year: '2025' })
    // i1, i3, i4 all 2025
    expect(result).toHaveLength(3)
  })

  it('filters by cycle', () => {
    const result = filterIntelRecords(enriched, { cycle: 'Summer' })
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('i3')
  })

  it('filters by sector', () => {
    const result = filterIntelRecords(enriched, { sector: 'Consulting' })
    expect(result).toHaveLength(2) // i1, i2 (both McKinsey records)
  })

  it('filters by program', () => {
    const result = filterIntelRecords(enriched, { program: 'MBA' })
    expect(result).toHaveLength(enriched.length) // all are MBA
  })

  it('filters by iiftFilter=gap', () => {
    const result = filterIntelRecords(enriched, { iiftFilter: 'gap' })
    result.forEach(r => expect(r._iiftStatus).toBe('gap'))
  })

  it('filters by iiftFilter=at_iift', () => {
    const result = filterIntelRecords(enriched, { iiftFilter: 'at_iift' })
    result.forEach(r => expect(r._iiftStatus).toBe('at_iift'))
  })

  it('filters by search term (company name)', () => {
    const result = filterIntelRecords(enriched, { search: 'goldman' })
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('i3')
  })

  it('filters by search term (sector)', () => {
    const result = filterIntelRecords(enriched, { search: 'bfsi' })
    expect(result).toHaveLength(2) // i3 (GS), i5 (CS)
  })

  it('search is case-insensitive', () => {
    const lower = filterIntelRecords(enriched, { search: 'mckinsey' })
    const upper = filterIntelRecords(enriched, { search: 'MCKINSEY' })
    expect(lower.length).toBe(upper.length)
  })

  it('chains multiple filters (year + cycle)', () => {
    const result = filterIntelRecords(enriched, { year: '2025', cycle: 'Finals' })
    // 2025 Finals: i1 (McKinsey/IIMA), i4 (Asian Paints/IIMC)
    expect(result).toHaveLength(2)
  })

  it('chains college + sector filters', () => {
    const result = filterIntelRecords(enriched, { college: 'IIM Ahmedabad', sector: 'Consulting' })
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('i1')
  })

  it('returns empty array when no records match', () => {
    const result = filterIntelRecords(enriched, { college: 'IIM Shillong' })
    expect(result).toHaveLength(0)
  })

  it('ignores undefined filter keys', () => {
    const result = filterIntelRecords(enriched, { college: undefined, year: undefined })
    expect(result).toHaveLength(enriched.length)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. aggregateByCompany() — benchmark view grouping
// ══════════════════════════════════════════════════════════════════════════════

describe('aggregateByCompany() pipeline', () => {
  const iiftSet = buildIiftSet(STUDENTS, 2026)
  const enriched = enrichIntel(INTEL_RECORDS, iiftSet)

  it('groups multiple McKinsey records into one company entry', () => {
    const result = aggregateByCompany(enriched)
    const mckinsey = result.find(c => c.recruiterName === 'McKinsey & Company')
    expect(mckinsey).toBeDefined()
    expect(mckinsey.appearances).toHaveLength(2) // i1 (IIMA), i2 (XLRI)
  })

  it('each company appears once in output', () => {
    const result = aggregateByCompany(enriched)
    const names = result.map(c => c.recruiterName)
    const unique = new Set(names)
    expect(names.length).toBe(unique.size)
  })

  it('upgrades status to at_iift if any appearance matches', () => {
    const records = [
      { recruiterId: 'MCKINSEYCOMPANY', recruiterName: 'McKinsey & Company', alias: '', sector: 'Consulting', _iiftStatus: 'gap' },
      { recruiterId: 'MCKINSEYCOMPANY', recruiterName: 'McKinsey & Company', alias: '', sector: 'Consulting', _iiftStatus: 'at_iift' },
    ]
    const result = aggregateByCompany(records)
    expect(result[0]._iiftStatus).toBe('at_iift')
  })

  it('keeps gap status if no appearances are at_iift', () => {
    const records = [
      { recruiterId: 'CREDITSUITEMEC', recruiterName: 'Credit Suisse', alias: 'CS', sector: 'BFSI', _iiftStatus: 'gap' },
    ]
    const result = aggregateByCompany(records)
    expect(result[0]._iiftStatus).toBe('gap')
  })

  it('prefers non-empty sector when first record has empty sector', () => {
    const records = [
      { recruiterId: 'TESTCO', recruiterName: 'Test Co', alias: '', sector: '', _iiftStatus: 'gap' },
      { recruiterId: 'TESTCO', recruiterName: 'Test Co', alias: '', sector: 'Consulting', _iiftStatus: 'gap' },
    ]
    const result = aggregateByCompany(records)
    expect(result[0].sector).toBe('Consulting')
  })

  it('sorts companies alphabetically by recruiterName', () => {
    const result = aggregateByCompany(enriched)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].recruiterName.localeCompare(result[i].recruiterName)).toBeLessThanOrEqual(0)
    }
  })

  it('returns empty array for empty input', () => {
    expect(aggregateByCompany([])).toEqual([])
  })

  it('counts appearances correctly', () => {
    const result = aggregateByCompany(enriched)
    const gs = result.find(c => c.recruiterName === 'Goldman Sachs')
    expect(gs.appearances).toHaveLength(1) // only i3
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. parseIntelRows() — Excel → canonical records pipeline
// ══════════════════════════════════════════════════════════════════════════════

describe('parseIntelRows() pipeline', () => {
  it('parses well-formed rows into canonical records', () => {
    const raw = [
      {
        'Recruiter Name': 'Bain & Company',
        'Placement Year': '2025',
        'Placement Cycle': 'Finals',
        'College Name': 'IIM Ahmedabad',
        'Program': 'MBA',
        'Sector': 'Consulting',
        'Number of Offers': '4',
        'International Opportunity': 'Yes',
      }
    ]
    const { records, warnings } = parseIntelRows(raw)
    expect(records).toHaveLength(1)
    expect(warnings).toHaveLength(0)
    expect(records[0].recruiterName).toBe('Bain & Company')
    expect(records[0].placementYear).toBe(2025)
    expect(records[0].numberOfOffers).toBe(4)
    expect(records[0].internationalOpp).toBe(true)
  })

  it('derives recruiterId from recruiterName when missing', () => {
    const raw = [{ 'Company': 'Test Corp', 'Year': '2025' }]
    const { records } = parseIntelRows(raw)
    expect(records[0].recruiterId).toBe('TESTCORP')
  })

  it('skips rows with no name or ID', () => {
    const raw = [
      { 'Placement Year': '2025', 'Sector': 'IT' },
    ]
    const { records, warnings } = parseIntelRows(raw)
    expect(records).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('skipped')
  })

  it('handles header aliases case-insensitively', () => {
    const raw = [{ 'RECRUITER NAME': 'Alpha Corp', 'PLACEMENT YEAR': '2024' }]
    const { records } = parseIntelRows(raw)
    expect(records[0].recruiterName).toBe('Alpha Corp')
  })

  it('coerces internationalOpp = "no" to false', () => {
    const raw = [{ 'Recruiter Name': 'Beta Ltd', 'International Opportunity': 'no' }]
    const { records } = parseIntelRows(raw)
    expect(records[0].internationalOpp).toBe(false)
  })

  it('coerces internationalOpp = "1" to true', () => {
    const raw = [{ 'Recruiter Name': 'Gamma Inc', 'International Opportunity': '1' }]
    const { records } = parseIntelRows(raw)
    expect(records[0].internationalOpp).toBe(true)
  })

  it('trims whitespace from string fields', () => {
    const raw = [{ 'Recruiter Name': '  Delta Co  ', 'College Name': '  IIM B  ' }]
    const { records } = parseIntelRows(raw)
    expect(records[0].recruiterName).toBe('Delta Co')
    expect(records[0].collegeName).toBe('IIM B')
  })

  it('returns empty collections for empty input', () => {
    const { records, warnings } = parseIntelRows([])
    expect(records).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('returns empty collections for null input', () => {
    const { records, warnings } = parseIntelRows(null)
    expect(records).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('handles mixed valid and invalid rows', () => {
    const raw = [
      { 'Recruiter Name': 'Good Co', 'Placement Year': '2025' },
      { 'Placement Year': '2025' }, // no name → warning
      { 'Recruiter Name': 'Another Co' },
    ]
    const { records, warnings } = parseIntelRows(raw)
    expect(records).toHaveLength(2)
    expect(warnings).toHaveLength(1)
  })

  it('handles 200+ rows performantly', () => {
    const raw = Array.from({ length: 200 }, (_, i) => ({
      'Recruiter Name': `Company ${i}`,
      'Placement Year': '2025',
      'Placement Cycle': 'Finals',
      'College Name': `IIM ${i % 5}`,
    }))
    const start = Date.now()
    const { records } = parseIntelRows(raw)
    const elapsed = Date.now() - start
    expect(records).toHaveLength(200)
    expect(elapsed).toBeLessThan(200) // should complete well under 200ms
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. dedupKey + dedup pipeline
// ══════════════════════════════════════════════════════════════════════════════

describe('Deduplication pipeline', () => {
  it('same company+college+year+cycle+program → same key', () => {
    const r1 = { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'IIM Ahmedabad', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }
    const r2 = { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'IIM Ahmedabad', placementYear: 2025, placementCycle: 'finals', program: 'MBA' }
    expect(dedupKey(r1)).toBe(dedupKey(r2))
  })

  it('different college → different key', () => {
    const r1 = { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'IIM Ahmedabad', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }
    const r2 = { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'XLRI', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }
    expect(dedupKey(r1)).not.toBe(dedupKey(r2))
  })

  it('different year → different key', () => {
    const r1 = { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'IIM Ahmedabad', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }
    const r2 = { ...r1, placementYear: 2024 }
    expect(dedupKey(r1)).not.toBe(dedupKey(r2))
  })

  it('different cycle → different key (same company, same college)', () => {
    const r1 = { recruiterId: 'GOLDMANSACHS', collegeName: 'IIM B', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }
    const r2 = { ...r1, placementCycle: 'Summer' }
    expect(dedupKey(r1)).not.toBe(dedupKey(r2))
  })

  it('falls back to recruiterName when recruiterId missing', () => {
    const r = { recruiterName: 'Bain & Co', collegeName: 'XLRI', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }
    const key = dedupKey(r)
    expect(key).toBe('BAINCO::XLRI::2025::FINALS::MBA')
  })

  it('empty record produces consistent key', () => {
    const key = dedupKey({})
    // 5 empty parts joined by '::' → 4 separators → 8 colons total
    expect(key).toBe('::::::::')
    expect(key.split('::').length).toBe(5)
  })

  it('builds unique key set from batch of records (simulates upload dedup check)', () => {
    const records = [
      { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'IIMA', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' },
      { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'IIMA', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }, // duplicate
      { recruiterId: 'MCKINSEYCOMPANY', collegeName: 'XLRI', placementYear: 2025, placementCycle: 'Finals', program: 'MBA' }, // different college
    ]
    const keys = new Set(records.map(dedupKey))
    expect(keys.size).toBe(2) // only 2 unique appearances
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. blankIntelRecord() — default shape invariants
// ══════════════════════════════════════════════════════════════════════════════

describe('blankIntelRecord()', () => {
  const blank = blankIntelRecord()

  it('returns an object with all required fields', () => {
    const requiredFields = [
      'recruiterId', 'recruiterName', 'alias', 'placementYear', 'academicBatch',
      'placementCycle', 'collegeName', 'campus', 'program', 'sector', 'function',
      'rolesMentioned', 'recruiterType', 'internationalOpp', 'internationalLoc',
      'numberOfOffers', 'sourceReport', 'sourceType', 'evidence', 'remarks',
      'compensation', 'poc', 'notes', 'importBatch', '_deleted',
    ]
    requiredFields.forEach(f => {
      expect(blank).toHaveProperty(f)
    })
  })

  it('defaults _deleted to false', () => {
    expect(blank._deleted).toBe(false)
  })

  it('defaults internationalOpp to false', () => {
    expect(blank.internationalOpp).toBe(false)
  })

  it('defaults poc to nested object', () => {
    expect(blank.poc).toEqual({ name: '', email: '', phone: '' })
  })

  it('defaults placementCycle to Finals', () => {
    expect(blank.placementCycle).toBe('Finals')
  })

  it('returns a fresh object each call (no shared reference)', () => {
    const a = blankIntelRecord()
    const b = blankIntelRecord()
    a.recruiterName = 'mutated'
    expect(b.recruiterName).toBe('')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. INTEL_SECTORS / INTEL_CYCLES constants
// ══════════════════════════════════════════════════════════════════════════════

describe('Intel constants', () => {
  it('INTEL_SECTORS is a non-empty array', () => {
    expect(Array.isArray(INTEL_SECTORS)).toBe(true)
    expect(INTEL_SECTORS.length).toBeGreaterThan(0)
  })

  it('INTEL_CYCLES contains Finals, Summer, Lateral', () => {
    expect(INTEL_CYCLES).toContain('Finals')
    expect(INTEL_CYCLES).toContain('Summer')
    expect(INTEL_CYCLES).toContain('Lateral')
  })

  it('INTEL_SECTORS contains key sectors', () => {
    expect(INTEL_SECTORS).toContain('Consulting')
    expect(INTEL_SECTORS).toContain('BFSI')
    expect(INTEL_SECTORS).toContain('FMCG')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. Full end-to-end pipeline: students → IIFT set → enrich → filter → aggregate
// ══════════════════════════════════════════════════════════════════════════════

describe('End-to-end pipeline', () => {
  it('pipeline produces correct benchmark classification for a known scenario', () => {
    // Scenario: McKinsey visited IIM A. McKinsey also placed at IIFT Delhi (s1 summer).
    // Expected: McKinsey record should be tagged at_iift.

    const iiftSet = buildIiftSet(STUDENTS, 2026)
    const enriched = enrichIntel(INTEL_RECORDS, iiftSet)
    const filtered = filterIntelRecords(enriched, { iiftFilter: 'at_iift' })
    const aggregated = aggregateByCompany(filtered)

    const mckinsey = aggregated.find(c => c.recruiterName === 'McKinsey & Company')
    expect(mckinsey).toBeDefined()
    expect(mckinsey._iiftStatus).toBe('at_iift')
  })

  it('identifies gap companies correctly', () => {
    // Credit Suisse visited IIM A in 2023 but never recruited at IIFT
    const iiftSet = buildIiftSet(STUDENTS, 2026)
    const enriched = enrichIntel(INTEL_RECORDS, iiftSet)
    const gapRecords = enriched.filter(r => r._iiftStatus === 'gap')

    const creditSuisse = gapRecords.find(r => r.recruiterName === 'Credit Suisse')
    expect(creditSuisse).toBeDefined()
  })

  it('benchmark filter + search combined works', () => {
    const iiftSet = buildIiftSet(STUDENTS, 2026)
    const enriched = enrichIntel(INTEL_RECORDS, iiftSet)
    // Filter: gap companies AND search for "bfsi" sector
    const result = filterIntelRecords(enriched, { iiftFilter: 'gap', search: 'bfsi' })

    result.forEach(r => {
      expect(r._iiftStatus).toBe('gap')
      expect(
        [r.recruiterName, r.alias, r.sector, r.function, r.rolesMentioned].join(' ').toLowerCase()
      ).toContain('bfsi')
    })
  })

  it('full pipeline: parse → dedup → enrich → filter runs without error', () => {
    const rawRows = [
      { 'Recruiter Name': 'BCG', 'Placement Year': '2025', 'Placement Cycle': 'Finals', 'College Name': 'IIM A', 'Program': 'MBA', 'Sector': 'Consulting' },
      { 'Recruiter Name': 'HSBC', 'Placement Year': '2025', 'Placement Cycle': 'Finals', 'College Name': 'IIM B', 'Program': 'MBA', 'Sector': 'BFSI' },
    ]
    const { records } = parseIntelRows(rawRows)
    expect(records).toHaveLength(2)

    const keys = records.map(dedupKey)
    expect(new Set(keys).size).toBe(2) // both unique

    const iiftSet = buildIiftSet(STUDENTS, 2026)
    const enriched = enrichIntel(records, iiftSet)
    expect(enriched).toHaveLength(2)
    enriched.forEach(r => expect(r._iiftStatus).toBeDefined())

    const filtered = filterIntelRecords(enriched, { sector: 'Consulting' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].recruiterName).toBe('BCG')
  })

  it('aggregate count by iift status is consistent with enriched records', () => {
    const iiftSet = buildIiftSet(STUDENTS, 2026)
    const enriched = enrichIntel(INTEL_RECORDS, iiftSet)

    const atIiftCount = enriched.filter(r => r._iiftStatus === 'at_iift').length
    const gapCount = enriched.filter(r => r._iiftStatus === 'gap').length
    expect(atIiftCount + gapCount).toBe(enriched.length)
  })
})
