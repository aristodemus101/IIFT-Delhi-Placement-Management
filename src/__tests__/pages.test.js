/**
 * Logic + integration tests for all page pure functions.
 * No DOM rendering — pure function extraction only.
 *
 * Covers:
 *   DashboardPage:   stats computation, work-ex bucketing, age groups, gender split
 *   PlacedPage:      placed filter, package parsing, company grouping, filteredCompanies
 *   ApprovalsPage:   changeDescription, fmtTime, filtered/scoped logic
 *   ActivityPage:    oppToRow transform, opportunity filter
 *   RosterPage:      studentCohort helper
 *   Permissions:     role-based page/action access invariants
 */

import { describe, it, expect } from 'vitest'
import {
  STUDENTS, INTEL_RECORDS, PENDING_CHANGES, OPPORTUNITIES,
  DELHI_IB_STUDENTS, studentCohort,
} from './mockData.js'

// ── Helpers mirrored from source files (pure, no imports needed) ───────────────

function getVal(s, key) {
  if (s[key] !== undefined) return s[key]
  return ''
}

function getPlacement(s, season) {
  if (season === 'summer') return s._placement_summer || {}
  return s._placement_final || {}
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. studentCohort — used across Dashboard, Roster, Placed, Approvals
// ══════════════════════════════════════════════════════════════════════════════

describe('studentCohort()', () => {
  it('formats object cohort correctly', () => {
    expect(studentCohort(STUDENTS[0])).toBe('27-Delhi-IB')
  })

  it('returns string cohort unchanged', () => {
    const s = { cohort: '27-Delhi-IB' }
    expect(studentCohort(s)).toBe('27-Delhi-IB')
  })

  it('returns empty string when cohort is missing', () => {
    expect(studentCohort({})).toBe('')
  })

  it('handles BA programme', () => {
    expect(studentCohort(STUDENTS[4])).toBe('27-Delhi-BA')
  })

  it('handles Kakinada campus', () => {
    expect(studentCohort(STUDENTS[5])).toBe('27-Kakinada-IB')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. DashboardPage — stats computation
// ══════════════════════════════════════════════════════════════════════════════

describe('DashboardPage stats', () => {
  const scoped = DELHI_IB_STUDENTS // s1, s2, s3, s4

  describe('placement counts', () => {
    it('counts summer placed correctly', () => {
      const summerPlaced = scoped.filter(s => s._placed_summer)
      expect(summerPlaced).toHaveLength(2) // s1, s2
    })

    it('counts final placed correctly', () => {
      const finalPlaced = scoped.filter(s => s._placed_final)
      expect(finalPlaced).toHaveLength(2) // s1, s3
    })

    it('counts summer YTP (yet to place) correctly', () => {
      const summerYtp = scoped.filter(s => !s._placed_summer)
      expect(summerYtp).toHaveLength(2) // s3, s4
    })

    it('computes placement percentage', () => {
      const placed = scoped.filter(s => s._placed_final)
      const pct = scoped.length ? Math.round(placed.length / scoped.length * 100) : 0
      expect(pct).toBe(50)
    })
  })

  describe('CAT score statistics', () => {
    it('computes average CAT from valid numeric values', () => {
      const cats = scoped.map(s => parseFloat(getVal(s, 'cat'))).filter(v => Number.isFinite(v) && v > 0)
      const avg = cats.reduce((a, b) => a + b, 0) / cats.length
      expect(parseFloat(avg.toFixed(1))).toBeCloseTo(95.95, 1)
    })

    it('filters out non-numeric CAT values', () => {
      const mixed = [...scoped, { cat: 'N/A' }, { cat: '' }, { cat: '0' }]
      const cats = mixed.map(s => parseFloat(getVal(s, 'cat'))).filter(v => Number.isFinite(v) && v > 0)
      expect(cats).toHaveLength(4) // only the 4 scoped students with real scores
    })

    it('computes avg CAT for placed vs YTP for summer', () => {
      const placed = scoped.filter(s => s._placed_summer)
      const ytp = scoped.filter(s => !s._placed_summer)
      const catOf = (arr) => {
        const vals = arr.map(s => parseFloat(getVal(s, 'cat'))).filter(v => Number.isFinite(v) && v > 0)
        return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null
      }
      const placedAvg = catOf(placed)
      const ytpAvg = catOf(ytp)
      // s1=98.5, s2=95.2 placed; s3=91.0, s4=99.1 ytp
      expect(placedAvg).toBeCloseTo(96.85, 1)
      expect(ytpAvg).toBeCloseTo(95.05, 1)
    })
  })

  describe('work experience buckets', () => {
    const wxKey = (v) => {
      if (!Number.isFinite(v)) return null
      return v < 6 ? '0-6' : v < 12 ? '6-12' : v < 24 ? '12-24' : v < 36 ? '24-36' : '36+'
    }

    it('assigns correct bucket for 0 months', () => expect(wxKey(0)).toBe('0-6'))
    it('assigns correct bucket for 8 months', () => expect(wxKey(8)).toBe('6-12'))
    it('assigns correct bucket for 12 months', () => expect(wxKey(12)).toBe('12-24'))
    it('assigns correct bucket for 24 months', () => expect(wxKey(24)).toBe('24-36'))
    it('assigns correct bucket for 36 months', () => expect(wxKey(36)).toBe('36+'))
    it('assigns correct bucket for 48 months', () => expect(wxKey(48)).toBe('36+'))
    it('returns null for NaN', () => expect(wxKey(NaN)).toBeNull())

    it('buckets all scoped students correctly', () => {
      const wxDefs = [
        { key: '0-6', min: 0, max: 6 },
        { key: '6-12', min: 6, max: 12 },
        { key: '12-24', min: 12, max: 24 },
        { key: '24-36', min: 24, max: 36 },
        { key: '36+', min: 36, max: Infinity },
      ]
      const workEx = wxDefs.reduce((acc, d) => { acc[d.key] = { total: 0 }; return acc }, {})
      scoped.forEach(s => {
        const k = wxKey(parseFloat(getVal(s, 'wx')))
        if (k) workEx[k].total++
      })
      // s1=24mo→24-36, s2=0mo→0-6, s3=36mo→36+, s4=12mo→12-24
      expect(workEx['0-6'].total).toBe(1)
      expect(workEx['12-24'].total).toBe(1)
      expect(workEx['24-36'].total).toBe(1)
      expect(workEx['36+'].total).toBe(1)
    })

    it('counts freshers (wx < 12 months)', () => {
      const wxs = scoped.map(s => parseFloat(getVal(s, 'wx'))).filter(v => Number.isFinite(v) && v >= 0)
      const freshers = wxs.filter(v => v < 12).length
      expect(freshers).toBe(1) // s2=0 only; s4=12 is NOT < 12
    })

    it('counts experienced (wx >= 12 months)', () => {
      const wxs = scoped.map(s => parseFloat(getVal(s, 'wx'))).filter(v => Number.isFinite(v) && v >= 0)
      const experienced = wxs.filter(v => v >= 12).length
      expect(experienced).toBe(3) // s1=24, s3=36, s4=12
    })
  })

  describe('age distribution', () => {
    const ageKeyOf = (a) => {
      if (a == null) return null
      if (a <= 22) return '≤22'
      if (a <= 26) return String(a)
      return '27+'
    }

    it('buckets age ≤22 correctly', () => expect(ageKeyOf(22)).toBe('≤22'))
    it('buckets age 23 correctly', () => expect(ageKeyOf(23)).toBe('23'))
    it('buckets age 25 correctly', () => expect(ageKeyOf(25)).toBe('25'))
    it('buckets age 27 correctly', () => expect(ageKeyOf(27)).toBe('27+'))
    it('buckets age 30 correctly', () => expect(ageKeyOf(30)).toBe('27+'))
    it('returns null for null age', () => expect(ageKeyOf(null)).toBeNull())

    it('derives age from direct age field', () => {
      const getAge = (s) => {
        const direct = parseFloat(getVal(s, 'age'))
        if (!isNaN(direct) && direct > 0) return Math.round(direct)
        return null
      }
      expect(getAge(STUDENTS[0])).toBe(25)
      expect(getAge(STUDENTS[1])).toBe(23)
    })

    it('computes average age across cohort', () => {
      const getAge = (s) => {
        const direct = parseFloat(getVal(s, 'age'))
        if (!isNaN(direct) && direct > 0) return Math.round(direct)
        return null
      }
      const ageVals = scoped.map(getAge).filter(Boolean)
      const avgAge = ageVals.length ? (ageVals.reduce((a, b) => a + b, 0) / ageVals.length).toFixed(1) : '—'
      // s1=25, s2=23, s3=27, s4=24 → avg=24.75
      expect(avgAge).toBe('24.8')
    })
  })

  describe('gender breakdown', () => {
    const genderOf = (s) => {
      const g = String(getVal(s, 'gender') || '').trim().toLowerCase()
      return g.startsWith('m') ? 'male' : g.startsWith('f') ? 'female' : 'other'
    }

    it('classifies Male correctly', () => expect(genderOf({ gender: 'Male' })).toBe('male'))
    it('classifies Female correctly', () => expect(genderOf({ gender: 'Female' })).toBe('female'))
    it('classifies lowercase male correctly', () => expect(genderOf({ gender: 'male' })).toBe('male'))
    it('classifies unknown as other', () => expect(genderOf({ gender: 'Non-binary' })).toBe('other'))
    it('classifies empty as other', () => expect(genderOf({})).toBe('other'))

    it('counts females correctly across scoped cohort', () => {
      const females = scoped.filter(s => String(getVal(s, 'gender') || '').trim().toLowerCase().startsWith('f')).length
      expect(females).toBe(2) // s2, s4
    })

    it('computes female percentage', () => {
      const females = scoped.filter(s => String(getVal(s, 'gender') || '').trim().toLowerCase().startsWith('f')).length
      const femalePct = scoped.length ? Math.round(females / scoped.length * 100) : 0
      expect(femalePct).toBe(50)
    })
  })

  describe('PWD count', () => {
    it('counts students with pwd=yes', () => {
      const pwdCount = scoped.filter(s => (getVal(s, 'pwd') || '').toLowerCase() === 'yes').length
      expect(pwdCount).toBe(1) // s3
    })
  })

  describe('company breakdown', () => {
    it('groups placed students by final company', () => {
      const placed = scoped.filter(s => s._placed_final)
      const companies = {}
      placed.forEach(s => {
        const c = s._placement_final?.company || 'Unknown'
        companies[c] = (companies[c] || 0) + 1
      })
      expect(companies['Goldman Sachs']).toBe(1)
      expect(companies['Tata Consultancy Services']).toBe(1)
    })

    it('handles students with no placement data', () => {
      const placed = scoped.filter(s => s._placed_final)
      const companies = {}
      placed.forEach(s => {
        const c = s._placement_final?.company || 'Unknown'
        companies[c] = (companies[c] || 0) + 1
      })
      expect(companies['Unknown']).toBeUndefined()
    })
  })

  describe('status-gender cross-tab', () => {
    it('builds statusGender cross-tab for summer', () => {
      const genderOf = (s) => {
        const g = String(getVal(s, 'gender') || '').trim().toLowerCase()
        return g.startsWith('m') ? 'male' : g.startsWith('f') ? 'female' : 'other'
      }
      const isPlaced = (s) => s._placed_summer
      const statusGender = {
        ytp:    { total: 0, male: 0, female: 0, other: 0 },
        placed: { total: 0, male: 0, female: 0, other: 0 },
      }
      scoped.forEach(s => {
        const st = isPlaced(s) ? 'placed' : 'ytp'
        const g  = genderOf(s)
        statusGender[st].total++
        statusGender[st][g]++
      })
      expect(statusGender.placed.total).toBe(2) // s1 (M), s2 (F)
      expect(statusGender.placed.male).toBe(1)
      expect(statusGender.placed.female).toBe(1)
      expect(statusGender.ytp.total).toBe(2) // s3 (M), s4 (F)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. PlacedPage — package parsing, stats, company grouping
// ══════════════════════════════════════════════════════════════════════════════

describe('PlacedPage', () => {
  const scoped = DELHI_IB_STUDENTS

  describe('placed filter', () => {
    it('filters summer placed students', () => {
      const placed = scoped.filter(s => s._placed_summer)
      expect(placed).toHaveLength(2)
      expect(placed.map(s => s._id)).toContain('s1')
      expect(placed.map(s => s._id)).toContain('s2')
    })

    it('filters final placed students', () => {
      const placed = scoped.filter(s => s._placed_final)
      expect(placed).toHaveLength(2)
      expect(placed.map(s => s._id)).toContain('s1')
      expect(placed.map(s => s._id)).toContain('s3')
    })

    it('excludes unplaced students from placed list', () => {
      const placed = scoped.filter(s => s._placed_final)
      expect(placed.map(s => s._id)).not.toContain('s4')
    })

    it('applies company filter on top of placed filter', () => {
      const placed = scoped.filter(s => s._placed_final)
      const filtered = placed.filter(s =>
        (s._placement_final?.company || '').toLowerCase().includes('goldman')
      )
      expect(filtered).toHaveLength(1)
      expect(filtered[0]._id).toBe('s1')
    })
  })

  describe('parsePackage()', () => {
    const parsePackage = (pkg, isSummer) => {
      const cleaned = String(pkg).replace(/,/g, '')
      const m = cleaned.match(/[\d.]+/)
      if (!m) return null
      const val = parseFloat(m[0])
      if (!isSummer && val > 1000) return parseFloat((val / 100000).toFixed(2))
      return val
    }

    it('parses summer stipend as raw number (₹/month)', () => {
      expect(parsePackage('60000', true)).toBe(60000)
    })

    it('parses summer stipend with commas', () => {
      expect(parsePackage('60,000', true)).toBe(60000)
    })

    it('converts final CTC from absolute rupees to LPA', () => {
      // 3250000 → 32.5 LPA
      expect(parsePackage('3250000', false)).toBeCloseTo(32.5, 1)
    })

    it('treats final CTC <= 1000 as already LPA', () => {
      expect(parsePackage('32.5', false)).toBe(32.5)
    })

    it('returns null for non-numeric package', () => {
      expect(parsePackage('TBD', false)).toBeNull()
      expect(parsePackage('—', false)).toBeNull()
    })

    it('parses package with LPA suffix', () => {
      // "32.5 LPA" → matches /[\d.]+/ → 32.5
      expect(parsePackage('32.5 LPA', false)).toBe(32.5)
    })

    it('parses package with ₹ prefix', () => {
      expect(parsePackage('₹50,000', true)).toBe(50000)
    })
  })

  describe('stats computation', () => {
    const isSummer = false
    const parsePackage = (pkg) => {
      const cleaned = String(pkg).replace(/,/g, '')
      const m = cleaned.match(/[\d.]+/)
      if (!m) return null
      const val = parseFloat(m[0])
      if (!isSummer && val > 1000) return parseFloat((val / 100000).toFixed(2))
      return val
    }

    it('computes average final CTC correctly', () => {
      const placed = scoped.filter(s => s._placed_final)
      const placements = placed.map(s => getPlacement(s, 'final'))
      const withPackage = placements.filter(p => p.package && /[\d]/.test(p.package))
      const vals = withPackage.map(p => parsePackage(p.package)).filter(v => v !== null && v > 0)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      // s1: 3250000→32.5, s3: 1500000→15.0 → avg = 23.75
      expect(avg).toBeCloseTo(23.75, 1)
    })

    it('computes max final CTC correctly', () => {
      const placed = scoped.filter(s => s._placed_final)
      const placements = placed.map(s => getPlacement(s, 'final'))
      const withPackage = placements.filter(p => p.package && /[\d]/.test(p.package))
      const vals = withPackage.map(p => parsePackage(p.package)).filter(v => v !== null && v > 0)
      expect(Math.max(...vals)).toBeCloseTo(32.5, 1)
    })

    it('returns empty stats for no placed students', () => {
      const placed = []
      const placements = placed.map(s => getPlacement(s, 'final'))
      const withPackage = placements.filter(p => p.package && /[\d]/.test(p.package))
      const vals = withPackage.map(p => parsePackage(p.package)).filter(v => v !== null && v > 0)
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      expect(avg).toBeNull()
    })

    it('computes top sector correctly', () => {
      const placed = scoped.filter(s => s._placed_final)
      const placements = placed.map(s => getPlacement(s, 'final'))
      const sectorCounts = {}
      placements.forEach(p => { if (p.sector) sectorCounts[p.sector] = (sectorCounts[p.sector] || 0) + 1 })
      const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]
      // s1→BFSI, s3→IT/Tech — both 1 occurrence, first alphabetically wins
      expect(topSector).toBeDefined()
      expect(topSector[1]).toBe(1)
    })

    it('counts international placements', () => {
      const placed = scoped.filter(s => s._placed_final)
      const placements = placed.map(s => getPlacement(s, 'final'))
      const international = placements.filter(p => p.location === 'International').length
      expect(international).toBe(0)
    })

    it('computes placement percentage against total cohort', () => {
      const totalInCohort = scoped.length
      const placed = scoped.filter(s => s._placed_final)
      const pct = totalInCohort ? Math.round(placed.length / totalInCohort * 100) : 0
      expect(pct).toBe(50)
    })
  })

  describe('companyGroups()', () => {
    it('groups placed students by company for finals', () => {
      const placed = scoped.filter(s => s._placed_final)
      const map = {}
      placed.forEach(s => {
        const pl = getPlacement(s, 'final')
        const co = pl.company || 'Unknown'
        if (!map[co]) map[co] = { company: co, students: [], roles: {}, packages: [] }
        map[co].students.push(s)
        if (pl.role) map[co].roles[pl.role] = (map[co].roles[pl.role] || 0) + 1
      })
      expect(Object.keys(map)).toHaveLength(2)
      expect(map['Goldman Sachs'].students).toHaveLength(1)
      expect(map['Tata Consultancy Services'].students).toHaveLength(1)
    })

    it('computes topRole for company', () => {
      const roles = { 'Analyst': 3, 'Manager': 1 }
      const topRole = Object.entries(roles).sort((a, b) => b[1] - a[1])[0]
      expect(topRole[0]).toBe('Analyst')
    })

    it('computes avgPkg for company', () => {
      const packages = [32.5, 28.0, 35.0]
      const avgPkg = (packages.reduce((a, b) => a + b, 0) / packages.length).toFixed(1)
      expect(avgPkg).toBe('31.8')
    })

    it('sorts groups by count descending', () => {
      const groups = [
        { company: 'A', count: 1 },
        { company: 'B', count: 5 },
        { company: 'C', count: 2 },
      ]
      groups.sort((a, b) => b.count - a.count)
      expect(groups[0].company).toBe('B')
      expect(groups[1].company).toBe('C')
    })
  })

  describe('filteredCompanies()', () => {
    const companyGroups = [
      { company: 'McKinsey & Company', sector: 'Consulting', topRole: 'Analyst', count: 3 },
      { company: 'Goldman Sachs', sector: 'BFSI', topRole: 'Associate', count: 2 },
      { company: 'Hindustan Unilever', sector: 'FMCG', topRole: 'Manager', count: 1 },
    ]
    const filterCompanies = (groups, search) => {
      if (!search) return groups
      const q = search.toLowerCase()
      return groups.filter(g =>
        g.company.toLowerCase().includes(q) ||
        (g.sector || '').toLowerCase().includes(q) ||
        (g.topRole || '').toLowerCase().includes(q)
      )
    }

    it('returns all groups when search is empty', () => {
      expect(filterCompanies(companyGroups, '')).toHaveLength(3)
    })

    it('filters by company name', () => {
      const result = filterCompanies(companyGroups, 'goldman')
      expect(result).toHaveLength(1)
      expect(result[0].company).toBe('Goldman Sachs')
    })

    it('filters by sector', () => {
      const result = filterCompanies(companyGroups, 'consulting')
      expect(result).toHaveLength(1)
      expect(result[0].company).toBe('McKinsey & Company')
    })

    it('filters by role', () => {
      const result = filterCompanies(companyGroups, 'analyst')
      expect(result).toHaveLength(1)
    })

    it('returns empty for no match', () => {
      expect(filterCompanies(companyGroups, 'zzz')).toHaveLength(0)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. ApprovalsPage — changeDescription, fmtTime, filtering
// ══════════════════════════════════════════════════════════════════════════════

describe('ApprovalsPage', () => {
  function seasonLabel(s) {
    return s === 'summer' ? 'Summer' : 'Final'
  }
  function cohortLabel(id) {
    if (!id) return ''
    const parts = id.split('-')
    if (parts.length < 3) return id
    return `${parts[0]} ${parts[2]} ${parts[1]}`
  }

  function changeDescription(c) {
    const cohortId = c.cohort
    const cohortPart = cohortId ? ` [${cohortId}]` : ''
    const seasonPart = c.season ? ` (${seasonLabel(c.season)})` : ''
    switch (c.type) {
      case 'place':
      case 'place_from_activity': {
        const company = c.placementDetails?.company || c.company || 'Unknown company'
        const via = c.placementDetails?.via ? ` via ${c.placementDetails.via}` : ''
        const opp = c.opportunityTitle ? ` · ${c.opportunityTitle}` : ''
        return `${cohortPart}${seasonPart} Place ${c.studentName} (${c.studentRoll}) → ${company}${via}${opp}`
      }
      case 'unplace':  return `${cohortPart}${seasonPart} Unplace ${c.studentName} (${c.studentRoll}) from ${c.currentCompany}`
      case 'delete':   return `${cohortPart} Permanently delete ${c.studentName} (${c.studentRoll})`
      case 'import': {
        const cl = cohortId ? cohortLabel(cohortId) : ''
        return `${cl ? `[${cl}] ` : ''}${c.replaceExisting ? 'Replace existing and import' : 'Import'} ${c.rowCount} student${c.rowCount !== 1 ? 's' : ''} from file`
      }
      case 'clearAll': {
        const cl = cohortId ? cohortLabel(cohortId) : ''
        return `${cl ? `[${cl}] ` : ''}Delete all ${c.studentCount} students from database`
      }
      default: return c.type
    }
  }

  function fmtTime(ts) {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  describe('changeDescription()', () => {
    it('describes a place change with company and via', () => {
      const desc = changeDescription(PENDING_CHANGES[0])
      expect(desc).toContain('Place Sneha Patel')
      expect(desc).toContain('D27-004')
      expect(desc).toContain('BCG')
      expect(desc).toContain('Campus Drive')
      expect(desc).toContain('[27-Delhi-IB]')
      expect(desc).toContain('(Final)')
    })

    it('describes an unplace change', () => {
      const desc = changeDescription(PENDING_CHANGES[1])
      expect(desc).toContain('Unplace Priya Sharma')
      expect(desc).toContain('Deloitte')
      expect(desc).toContain('(Summer)')
    })

    it('describes a delete change', () => {
      const desc = changeDescription(PENDING_CHANGES[3])
      expect(desc).toContain('Permanently delete Rohit Kumar')
      expect(desc).toContain('D27-003')
    })

    it('describes an import change with plural students', () => {
      const desc = changeDescription(PENDING_CHANGES[2])
      expect(desc).toContain('Import 60 students from file')
    })

    it('uses singular for 1 student import', () => {
      const change = { type: 'import', cohort: '27-Delhi-IB', rowCount: 1, replaceExisting: false }
      const desc = changeDescription(change)
      expect(desc).toContain('Import 1 student from file')
      expect(desc).not.toContain('students')
    })

    it('handles place_from_activity type same as place', () => {
      const change = {
        type: 'place_from_activity',
        cohort: '27-Delhi-IB',
        season: 'final',
        studentName: 'Test Student',
        studentRoll: 'T001',
        placementDetails: { company: 'Accenture', via: 'Activity' },
        opportunityTitle: 'Strategy Role',
      }
      const desc = changeDescription(change)
      expect(desc).toContain('Place Test Student')
      expect(desc).toContain('Accenture')
      expect(desc).toContain('Strategy Role')
    })

    it('uses Unknown company when placementDetails missing', () => {
      const change = {
        type: 'place',
        cohort: '27-Delhi-IB',
        season: 'final',
        studentName: 'Test',
        studentRoll: 'T001',
      }
      const desc = changeDescription(change)
      expect(desc).toContain('Unknown company')
    })
  })

  describe('fmtTime()', () => {
    it('returns — for falsy input', () => {
      expect(fmtTime(null)).toBe('—')
      expect(fmtTime(undefined)).toBe('—')
      expect(fmtTime('')).toBe('—')
    })

    it('handles Firestore timestamp with toDate()', () => {
      const ts = { toDate: () => new Date('2025-11-25T10:00:00Z') }
      const result = fmtTime(ts)
      expect(result).toContain('Nov')
      expect(result).toContain('25')
    })

    it('handles raw Date string', () => {
      const result = fmtTime('2025-10-01T08:00:00Z')
      expect(result).toContain('Oct')
    })
  })

  describe('filtered changes logic', () => {
    const changes = PENDING_CHANGES

    it('filters by status=pending', () => {
      const filtered = changes.filter(c => c.status === 'pending')
      expect(filtered).toHaveLength(3)
    })

    it('filters by status=approved', () => {
      const filtered = changes.filter(c => c.status === 'approved')
      expect(filtered).toHaveLength(1)
    })

    it('filters by cohort scope', () => {
      const cohortScoped = changes.filter(c => c.cohort === '27-Delhi-IB')
      expect(cohortScoped).toHaveLength(4)
    })

    it('chains cohort + status filter', () => {
      const cohortScoped = changes.filter(c => c.cohort === '27-Delhi-IB')
      const filtered = cohortScoped.filter(c => c.status === 'pending')
      expect(filtered).toHaveLength(2)
    })

    it('counts pending for tab badge', () => {
      const cohortScoped = changes.filter(c => c.cohort === '27-Delhi-IB')
      const pendingCount = cohortScoped.filter(c => c.status === 'pending').length
      expect(pendingCount).toBe(2)
    })

    it('all tab returns all cohort-scoped changes', () => {
      const cohortScoped = changes.filter(c => c.cohort === '27-Delhi-IB')
      expect(cohortScoped).toHaveLength(4)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. ActivityPage — oppToRow transform, opportunity filter
// ══════════════════════════════════════════════════════════════════════════════

describe('ActivityPage', () => {
  function oppToRow(opp) {
    const date = (ts) => ts?.toDate ? ts.toDate().toISOString().slice(0, 10) : (ts || '')
    return {
      title:    opp.title,
      company:  opp.company,
      type:     opp.type,
      stage:    opp.stage,
      sector:   opp.sector,
      roles:    opp.roles || '',
      ctcRange: opp.ctcRange || '',
      deadline: date(opp.deadline),
      notes:    opp.notes || '',
    }
  }

  describe('oppToRow()', () => {
    it('transforms opportunity to flat export row', () => {
      const row = oppToRow(OPPORTUNITIES[0])
      expect(row.title).toBe('Management Consulting Role')
      expect(row.company).toBe('BCG')
      expect(row.stage).toBe('Shortlist Released')
      expect(row.deadline).toBe('2025-12-15')
    })

    it('handles null deadline', () => {
      const row = oppToRow(OPPORTUNITIES[2])
      expect(row.deadline).toBe('')
    })

    it('handles missing optional fields', () => {
      const opp = { title: 'Test', company: 'Co', type: 'Drive', stage: 'Exploring', sector: 'IT' }
      const row = oppToRow(opp)
      expect(row.roles).toBe('')
      expect(row.ctcRange).toBe('')
      expect(row.notes).toBe('')
    })

    it('formats Firestore timestamp deadline correctly', () => {
      const row = oppToRow(OPPORTUNITIES[1])
      expect(row.deadline).toBe('2025-11-30')
    })
  })

  describe('opportunity filter', () => {
    const filterOpps = (opps, { search, stage, sector }) => {
      return opps.filter(o => {
        if (stage && o.stage !== stage) return false
        if (sector && o.sector !== sector) return false
        if (search) {
          const q = search.toLowerCase()
          if (!o.title.toLowerCase().includes(q) && !o.company.toLowerCase().includes(q)) return false
        }
        return true
      })
    }

    it('returns all when no filters', () => {
      expect(filterOpps(OPPORTUNITIES, {})).toHaveLength(3)
    })

    it('filters by stage', () => {
      const result = filterOpps(OPPORTUNITIES, { stage: 'Offer Released' })
      expect(result).toHaveLength(1)
      expect(result[0].company).toBe('Goldman Sachs')
    })

    it('filters by sector', () => {
      const result = filterOpps(OPPORTUNITIES, { sector: 'Consulting' })
      expect(result).toHaveLength(1)
      expect(result[0].company).toBe('BCG')
    })

    it('filters by search term (company)', () => {
      const result = filterOpps(OPPORTUNITIES, { search: 'goldman' })
      expect(result).toHaveLength(1)
    })

    it('filters by search term (title)', () => {
      const result = filterOpps(OPPORTUNITIES, { search: 'summer internship' })
      expect(result).toHaveLength(1)
      expect(result[0].company).toBe('Hindustan Unilever')
    })

    it('returns empty for unmatched search', () => {
      expect(filterOpps(OPPORTUNITIES, { search: 'zzzzz' })).toHaveLength(0)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. Permissions — role-based access invariants
// ══════════════════════════════════════════════════════════════════════════════

describe('Permissions invariants', () => {
  // Mirrors PAGE_ACCESS from permissions.js
  const PAGE_ACCESS = {
    roster:      ['admin', 'committee', 'tpo'],
    placed:      ['admin', 'committee', 'tpo', 'faculty_coordinator'],
    approvals:   ['admin', 'committee'],
    analytics:   ['admin', 'committee', 'faculty_coordinator'],
    activity:    ['admin', 'committee', 'tpo'],
    tpo:         ['admin', 'committee', 'tpo', 'faculty_coordinator'],
    admin:       ['admin'],
    remapper:    ['admin', 'committee'],
    intel:       ['admin', 'committee', 'tpo', 'faculty_coordinator'],
    about:       ['admin', 'committee', 'tpo', 'faculty_coordinator'],
  }

  const ACTION_ACCESS = {
    writeIntel:  ['admin', 'committee'],
    uploadIntel: ['admin'],
    deleteIntel: ['admin'],
  }

  const ROLES = ['admin', 'committee', 'tpo', 'faculty_coordinator']

  describe('page access', () => {
    it('admin has access to all pages', () => {
      Object.entries(PAGE_ACCESS).forEach(([page, roles]) => {
        expect(roles).toContain('admin')
      })
    })

    it('faculty_coordinator has access to intel page', () => {
      expect(PAGE_ACCESS.intel).toContain('faculty_coordinator')
    })

    it('faculty_coordinator cannot access approvals', () => {
      expect(PAGE_ACCESS.approvals).not.toContain('faculty_coordinator')
    })

    it('faculty_coordinator cannot access admin panel', () => {
      expect(PAGE_ACCESS.admin).not.toContain('faculty_coordinator')
    })

    it('tpo cannot access approvals', () => {
      expect(PAGE_ACCESS.approvals).not.toContain('tpo')
    })

    it('tpo cannot access admin panel', () => {
      expect(PAGE_ACCESS.admin).not.toContain('tpo')
    })

    it('committee cannot access admin panel', () => {
      expect(PAGE_ACCESS.admin).not.toContain('committee')
    })

    it('all roles can access intel page', () => {
      ROLES.forEach(r => {
        expect(PAGE_ACCESS.intel).toContain(r)
      })
    })

    it('all roles can access placed page', () => {
      ROLES.forEach(r => {
        expect(PAGE_ACCESS.placed).toContain(r)
      })
    })
  })

  describe('action access', () => {
    it('only admin can upload intel', () => {
      expect(ACTION_ACCESS.uploadIntel).toEqual(['admin'])
    })

    it('only admin can delete intel', () => {
      expect(ACTION_ACCESS.deleteIntel).toEqual(['admin'])
    })

    it('admin and committee can write intel', () => {
      expect(ACTION_ACCESS.writeIntel).toContain('admin')
      expect(ACTION_ACCESS.writeIntel).toContain('committee')
    })

    it('tpo cannot write intel', () => {
      expect(ACTION_ACCESS.writeIntel).not.toContain('tpo')
    })

    it('faculty_coordinator cannot write intel', () => {
      expect(ACTION_ACCESS.writeIntel).not.toContain('faculty_coordinator')
    })
  })

  describe('faculty_coordinator role key invariant', () => {
    it('role key is exactly faculty_coordinator (never renamed)', () => {
      expect(ROLES).toContain('faculty_coordinator')
      expect(ROLES).not.toContain('faculty_incharge')
      expect(ROLES).not.toContain('facultyCoordinator')
    })

    it('faculty_coordinator appears in intel page access', () => {
      expect(PAGE_ACCESS.intel).toContain('faculty_coordinator')
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. RosterPage — student cohort scoping
// ══════════════════════════════════════════════════════════════════════════════

describe('RosterPage scoping', () => {
  it('scopes students to selected cohorts', () => {
    const selectedCohorts = ['27-Delhi-IB']
    const ids = new Set(selectedCohorts)
    const scoped = STUDENTS.filter(s => ids.has(studentCohort(s)))
    expect(scoped).toHaveLength(4) // s1, s2, s3, s4
  })

  it('returns empty when no cohort match', () => {
    const selectedCohorts = ['99-Delhi-IB']
    const ids = new Set(selectedCohorts)
    const scoped = STUDENTS.filter(s => ids.has(studentCohort(s)))
    expect(scoped).toHaveLength(0)
  })

  it('scopes multiple cohorts simultaneously', () => {
    const selectedCohorts = ['27-Delhi-IB', '27-Delhi-BA']
    const ids = new Set(selectedCohorts)
    const scoped = STUDENTS.filter(s => ids.has(studentCohort(s)))
    expect(scoped).toHaveLength(5) // s1, s2, s3, s4, s5
  })

  it('scopes Kakinada cohort independently', () => {
    const selectedCohorts = ['27-Kakinada-IB']
    const ids = new Set(selectedCohorts)
    const scoped = STUDENTS.filter(s => ids.has(studentCohort(s)))
    expect(scoped).toHaveLength(1) // s6
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. Edge cases across pages
// ══════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('handles students with both placements (double-placed)', () => {
    const s = STUDENTS[0] // s1: both summer and final placed
    expect(s._placed_summer).toBe(true)
    expect(s._placed_final).toBe(true)
    expect(s._placement_summer?.company).toBe('McKinsey & Company')
    expect(s._placement_final?.company).toBe('Goldman Sachs')
  })

  it('treats null _placement_final as not placed', () => {
    const s = STUDENTS[1] // s2: summer only
    expect(s._placed_final).toBe(false)
    expect(s._placement_final).toBeNull()
    const pl = getPlacement(s, 'final')
    expect(pl).toEqual({})
  })

  it('placement stats ignore students with null package', () => {
    const placements = [
      { package: null },
      { package: '' },
      { package: '3000000' },
    ]
    const withPackage = placements.filter(p => p.package && /[\d]/.test(p.package))
    expect(withPackage).toHaveLength(1)
  })

  it('company grouping handles Unknown company gracefully', () => {
    const placed = [{ _placed_final: true, _placement_final: { company: '' } }]
    const map = {}
    placed.forEach(s => {
      const pl = s._placement_final || {}
      const co = pl.company || 'Unknown'
      if (!map[co]) map[co] = { students: [] }
      map[co].students.push(s)
    })
    expect(map['Unknown']).toBeDefined()
  })

  it('international placement count across full student set', () => {
    const allPlaced = STUDENTS.filter(s => s._placed_final)
    const placements = allPlaced.map(s => getPlacement(s, 'final'))
    const international = placements.filter(p => p.location === 'International').length
    expect(international).toBe(1) // s6: Kakinada → McKinsey International
  })
})
