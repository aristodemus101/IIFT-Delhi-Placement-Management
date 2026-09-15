import { describe, it, expect } from 'vitest'
import {
  isoWeekKey, weekStartDate, monthKey, bucketKey, bucketLabel,
  extractPlacementEvents, buildTimeline, cumulativeSeries,
  buildHeatmapMatrix, buildTally, projectCompletion,
} from '../lib/placementTrends'

// ─── Date bucketing ────────────────────────────────────────────────────────────

describe('isoWeekKey', () => {
  it('returns null for empty/invalid input', () => {
    expect(isoWeekKey('')).toBeNull()
    expect(isoWeekKey(null)).toBeNull()
    expect(isoWeekKey('not-a-date')).toBeNull()
  })

  it('computes ISO week for a mid-week date', () => {
    // 2026-08-14 is a Friday, ISO week 33
    expect(isoWeekKey('2026-08-14')).toBe('2026-W33')
  })

  it('same ISO week for all days Mon–Sun', () => {
    // Week of 2026-08-10 (Mon) .. 2026-08-16 (Sun)
    const days = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16']
    const keys = days.map(isoWeekKey)
    expect(new Set(keys).size).toBe(1)
  })

  it('handles year-boundary weeks correctly (ISO week 1 can start in prior Dec)', () => {
    // 2025-12-29 (Mon) belongs to ISO week 1 of 2026
    expect(isoWeekKey('2025-12-29')).toBe('2026-W01')
  })
})

describe('weekStartDate', () => {
  it('returns the Monday of the given date\'s week', () => {
    expect(weekStartDate('2026-08-14')).toBe('2026-08-10') // Friday -> Monday
    expect(weekStartDate('2026-08-10')).toBe('2026-08-10') // Monday -> itself
  })

  it('returns null for invalid input', () => {
    expect(weekStartDate('')).toBeNull()
    expect(weekStartDate(undefined)).toBeNull()
  })
})

describe('monthKey', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKey('2026-08-14')).toBe('2026-08')
  })
  it('returns null for empty input', () => {
    expect(monthKey('')).toBeNull()
  })
})

describe('bucketKey', () => {
  it('dispatches to week or month based on granularity', () => {
    expect(bucketKey('2026-08-14', 'month')).toBe('2026-08')
    expect(bucketKey('2026-08-14', 'week')).toBe('2026-W33')
  })
})

describe('bucketLabel', () => {
  it('formats week keys', () => {
    expect(bucketLabel('2026-W33', 'week')).toBe("W33 '26")
  })
  it('formats month keys', () => {
    expect(bucketLabel('2026-08', 'month')).toMatch(/Aug.*26/)
  })
  it('returns empty string for falsy key', () => {
    expect(bucketLabel('', 'week')).toBe('')
    expect(bucketLabel(null, 'month')).toBe('')
  })
})

// ─── extractPlacementEvents ────────────────────────────────────────────────────

function student({ roll, name, cohort, summer, final }) {
  return {
    cohort,
    'Roll No.': roll,
    'Full Name': name,
    _placed_summer: !!summer,
    _placement_summer: summer || null,
    _placed_final: !!final,
    _placement_final: final || null,
  }
}

describe('extractPlacementEvents', () => {
  const students = [
    student({
      roll: '1A', name: 'Alice', cohort: '28-Delhi-IB',
      summer: { company: 'Goldman Sachs', sector: 'Banking', date: '2026-08-14' },
    }),
    student({
      roll: '2A', name: 'Bob', cohort: '28-Delhi-IB',
      final: { company: 'McKinsey', sector: 'Consulting', date: '2026-09-01' },
    }),
    student({
      roll: '3A', name: 'Carol', cohort: '27-Delhi-BA',
      summer: { company: 'HUL', sector: 'FMCG', date: '2025-06-20' },
      final: { company: 'HUL', sector: 'FMCG', date: '2026-01-05' },
    }),
    // Not placed at all
    student({ roll: '4A', name: 'Dan', cohort: '28-Delhi-IB' }),
  ]

  it('extracts one event per placement, cycle=all includes both summer and final', () => {
    const events = extractPlacementEvents(students, { cycle: 'all' })
    expect(events).toHaveLength(4)
  })

  it('filters to summer-only', () => {
    const events = extractPlacementEvents(students, { cycle: 'summer' })
    expect(events).toHaveLength(2)
    expect(events.every(e => e.cycle === 'summer')).toBe(true)
  })

  it('filters to final-only', () => {
    const events = extractPlacementEvents(students, { cycle: 'final' })
    expect(events).toHaveLength(2)
    expect(events.every(e => e.cycle === 'final')).toBe(true)
  })

  it('skips placement flags with no date', () => {
    const noDate = [student({ roll: '5A', name: 'Eve', cohort: '28-Delhi-IB', summer: { company: 'X', sector: 'Y', date: '' } })]
    expect(extractPlacementEvents(noDate)).toHaveLength(0)
  })

  it('preserves roll, name, cohort, company, sector, date on each event', () => {
    const events = extractPlacementEvents(students, { cycle: 'summer' })
    const alice = events.find(e => e.roll === '1A')
    expect(alice).toMatchObject({
      roll: '1A', name: 'Alice', cohort: '28-Delhi-IB',
      company: 'Goldman Sachs', sector: 'Banking', date: '2026-08-14', cycle: 'summer',
    })
  })
})

// ─── buildTimeline ─────────────────────────────────────────────────────────────

describe('buildTimeline', () => {
  const events = [
    { cohort: 'A', date: '2026-08-10' }, // W33
    { cohort: 'A', date: '2026-08-11' }, // W33
    { cohort: 'A', date: '2026-08-18' }, // W34
    { cohort: 'B', date: '2026-08-10' }, // W33
  ]

  it('buckets events by ISO week per cohort', () => {
    const { buckets, series } = buildTimeline(events, { granularity: 'week' })
    expect(buckets).toEqual(['2026-W33', '2026-W34'])
    expect(series.A).toEqual([2, 1])
    expect(series.B).toEqual([1, 0])
  })

  it('filters to only the given cohorts', () => {
    const { series } = buildTimeline(events, { granularity: 'week', cohorts: ['A'] })
    expect(Object.keys(series)).toEqual(['A'])
  })

  it('returns empty buckets/series for empty input', () => {
    const { buckets, series } = buildTimeline([], { granularity: 'week' })
    expect(buckets).toEqual([])
    expect(series).toEqual({})
  })

  it('ignores events with unparsable dates', () => {
    const { buckets } = buildTimeline([{ cohort: 'A', date: '' }], { granularity: 'week' })
    expect(buckets).toEqual([])
  })
})

describe('cumulativeSeries', () => {
  it('produces a running total per cohort', () => {
    const out = cumulativeSeries({ A: [1, 2, 0, 3], B: [0, 1, 1] })
    expect(out.A).toEqual([1, 3, 3, 6])
    expect(out.B).toEqual([0, 1, 2])
  })

  it('handles empty series', () => {
    expect(cumulativeSeries({})).toEqual({})
    expect(cumulativeSeries({ A: [] })).toEqual({ A: [] })
  })
})

// ─── buildHeatmapMatrix ─────────────────────────────────────────────────────────

describe('buildHeatmapMatrix', () => {
  const events = [
    { cohort: 'A', date: '2026-08-10' },
    { cohort: 'A', date: '2026-08-18' },
    { cohort: 'B', date: '2026-08-10' },
  ]

  it('builds a row per cohort aligned to shared buckets', () => {
    const { buckets, matrix, max } = buildHeatmapMatrix(events, { granularity: 'week' })
    expect(buckets).toEqual(['2026-W33', '2026-W34'])
    const rowA = matrix.find(r => r.cohort === 'A')
    const rowB = matrix.find(r => r.cohort === 'B')
    expect(rowA.values).toEqual([1, 1])
    expect(rowB.values).toEqual([1, 0])
    expect(max).toBe(1)
  })

  it('max reflects the highest single-cell count', () => {
    const stacked = [
      { cohort: 'A', date: '2026-08-10' },
      { cohort: 'A', date: '2026-08-10' },
      { cohort: 'A', date: '2026-08-10' },
    ]
    const { max } = buildHeatmapMatrix(stacked, { granularity: 'week' })
    expect(max).toBe(3)
  })

  it('shows an all-zero row for a requested cohort with no events in the window', () => {
    const { matrix } = buildHeatmapMatrix(events, { granularity: 'week', cohorts: ['A', 'C'] })
    const rowC = matrix.find(r => r.cohort === 'C')
    expect(rowC).toBeDefined()
    expect(rowC.values.every(v => v === 0)).toBe(true)
  })
})

// ─── buildTally ─────────────────────────────────────────────────────────────────

describe('buildTally', () => {
  const events = [
    { cohort: 'A', cycle: 'summer', company: 'Goldman', sector: 'Banking' },
    { cohort: 'A', cycle: 'final', company: 'Goldman', sector: 'Banking' },
    { cohort: 'A', cycle: 'summer', company: 'McKinsey', sector: 'Consulting' },
    { cohort: 'B', cycle: 'final', company: 'HUL', sector: 'FMCG' },
  ]

  it('tallies cycle counts and totals per cohort', () => {
    const { byCohort } = buildTally(events)
    expect(byCohort.A).toEqual({ summer: 2, final: 1, total: 3 })
    expect(byCohort.B).toEqual({ summer: 0, final: 1, total: 1 })
  })

  it('ranks top companies and sectors by frequency', () => {
    const { topCompanies, topSectors } = buildTally(events)
    expect(topCompanies[0]).toEqual(['Goldman', 2])
    expect(topSectors[0]).toEqual(['Banking', 2])
  })

  it('respects cohort filter', () => {
    const { byCohort, totalEvents } = buildTally(events, { cohorts: ['A'] })
    expect(Object.keys(byCohort)).toEqual(['A'])
    expect(totalEvents).toBe(3)
  })
})

// ─── projectCompletion ───────────────────────────────────────────────────────────

describe('projectCompletion', () => {
  it('returns null when total students is falsy', () => {
    expect(projectCompletion([1, 2, 3], 0)).toBeNull()
    expect(projectCompletion([1, 2, 3], null)).toBeNull()
  })

  it('returns null with fewer than 2 data points', () => {
    expect(projectCompletion([5], 100)).toBeNull()
    expect(projectCompletion([], 100)).toBeNull()
  })

  it('projects forward at constant positive velocity', () => {
    // +10/bucket, currently at 50/100 → need 5 more buckets
    const cum = [10, 20, 30, 40, 50]
    const result = projectCompletion(cum, 100)
    expect(result.velocity).toBeCloseTo(10, 5)
    expect(result.bucketsToComplete).toBe(5)
  })

  it('reports 0 buckets to complete once total is reached', () => {
    const cum = [50, 100, 100]
    const result = projectCompletion(cum, 100)
    expect(result.bucketsToComplete).toBe(0)
  })

  it('returns null bucketsToComplete when velocity is zero or negative (flat/plateaued)', () => {
    const flat = [10, 10, 10, 10]
    const result = projectCompletion(flat, 100)
    expect(result.bucketsToComplete).toBeNull()
    expect(result.velocity).toBeLessThanOrEqual(0)
  })

  it('projectedPct is capped at 100', () => {
    const cum = [90, 100, 110] // shouldn't exceed total in practice, but guard anyway
    const result = projectCompletion(cum, 100)
    expect(result.projectedPct).toBeLessThanOrEqual(100)
  })

  it('only considers the lookback window for velocity', () => {
    // First jump is huge but old; last 3 points are flat — lookback=3 should see it as flat
    const cum = [0, 90, 91, 92, 93]
    const result = projectCompletion(cum, 1000, { lookback: 3 })
    // slope over last 3 points [91,92,93] is ~1/bucket, not the big early jump
    expect(result.velocity).toBeCloseTo(1, 1)
  })
})
