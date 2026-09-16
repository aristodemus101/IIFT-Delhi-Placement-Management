// Pure data-shaping helpers for the Placement Trends analytics view.
// No Firestore/React here — takes plain student docs, returns plain data.

import { getVal } from './columns'

// ── Date bucketing ────────────────────────────────────────────────────────────

// ISO week key, e.g. '2026-W07'. Monday-start week per ISO 8601.
export function isoWeekKey(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return null
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7 // Mon=0..Sun=6
  target.setDate(target.getDate() - dayNr + 3) // Thursday of this week
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diffWeeks = Math.round((target - firstThursday) / (7 * 86400000))
  const week = diffWeeks + 1
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`
}

// Start-of-week (Monday) date string for a given date string — used for chart x-axis labels.
export function weekStartDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return null
  const dayNr = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dayNr)
  // Build the date string from local getters — toISOString() converts to UTC
  // and can roll the date back a day depending on the runtime's timezone offset.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthKey(dateStr) {
  if (!dateStr) return null
  return dateStr.slice(0, 7) // 'YYYY-MM'
}

export function bucketKey(dateStr, granularity) {
  return granularity === 'month' ? monthKey(dateStr) : isoWeekKey(dateStr)
}

// Human label for a bucket key
export function bucketLabel(key, granularity) {
  if (!key) return ''
  if (granularity === 'month') {
    const [y, m] = key.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }
  // week: 'YYYY-Www' → show as 'Www (yy)'
  const [y, w] = key.split('-W')
  return `W${w} '${y.slice(-2)}`
}

// ── Extract placement events from students ────────────────────────────────────

// One event per placement: { roll, name, cohort, company, sector, date, cycle }
export function extractPlacementEvents(students, { cycle = 'all' } = {}) {
  const events = []
  for (const s of students) {
    const cohort = s.cohort || 'unknown'
    const roll = getVal(s, 'roll')
    const name = getVal(s, 'name')

    if ((cycle === 'all' || cycle === 'summer') && s._placed_summer && s._placement_summer?.date) {
      events.push({
        roll, name, cohort,
        company: s._placement_summer.company || 'Unknown',
        sector:  s._placement_summer.sector || 'Unspecified',
        date:    s._placement_summer.date,
        cycle:   'summer',
      })
    }
    if ((cycle === 'all' || cycle === 'final') && s._placed_final && s._placement_final?.date) {
      events.push({
        roll, name, cohort,
        company: s._placement_final.company || 'Unknown',
        sector:  s._placement_final.sector || 'Unspecified',
        date:    s._placement_final.date,
        cycle:   'final',
      })
    }
  }
  return events
}

// ── Timeline series: one point per bucket per cohort ──────────────────────────

// Returns: { buckets: string[] (sorted keys), series: { [cohort]: number[] } (aligned to buckets) }
export function buildTimeline(events, { granularity = 'week', cohorts = null } = {}) {
  const cohortSet = cohorts && cohorts.length ? new Set(cohorts) : null
  const filtered = cohortSet ? events.filter(e => cohortSet.has(e.cohort)) : events

  const bucketSet = new Set()
  const byCohortBucket = {} // cohort -> bucket -> count

  for (const e of filtered) {
    const key = bucketKey(e.date, granularity)
    if (!key) continue
    bucketSet.add(key)
    if (!byCohortBucket[e.cohort]) byCohortBucket[e.cohort] = {}
    byCohortBucket[e.cohort][key] = (byCohortBucket[e.cohort][key] || 0) + 1
  }

  const buckets = [...bucketSet].sort()
  const series = {}
  for (const cohort of Object.keys(byCohortBucket)) {
    series[cohort] = buckets.map(b => byCohortBucket[cohort][b] || 0)
  }

  return { buckets, series }
}

// Cumulative version of a series (running total per bucket)
export function cumulativeSeries(series) {
  const out = {}
  for (const [cohort, values] of Object.entries(series)) {
    let running = 0
    out[cohort] = values.map(v => (running += v))
  }
  return out
}

// ── Heatmap matrix: cohort (row) × bucket (col) → count ───────────────────────

// Takes an already-built { buckets, series } (e.g. from buildTimeline) rather
// than recomputing it — callers that already have a timeline for the same
// events/granularity/cohorts should reuse it instead of paying for a second
// identical pass over events.
export function heatmapMatrixFromTimeline({ buckets, series }, { cohorts = null } = {}) {
  // If specific cohorts were requested, show a row for every one of them (even
  // an all-zero row for a cohort with no events in this window). Otherwise,
  // show a row for every cohort that actually has data.
  const rows = cohorts && cohorts.length ? cohorts : Object.keys(series)
  const matrix = rows.map(cohort => ({
    cohort,
    values: buckets.map((_, i) => (series[cohort] || [])[i] || 0),
  }))
  const max = Math.max(1, ...matrix.flatMap(r => r.values))
  return { buckets, matrix, max }
}

// Convenience wrapper for callers that don't already have a timeline —
// computes it internally. Prefer heatmapMatrixFromTimeline when a timeline
// for the same inputs already exists.
export function buildHeatmapMatrix(events, { granularity = 'week', cohorts = null } = {}) {
  const timeline = buildTimeline(events, { granularity, cohorts })
  return heatmapMatrixFromTimeline(timeline, { cohorts })
}

// ── Tally: cohort × cycle summary counts, plus top companies/sectors ──────────

export function buildTally(events, { cohorts = null } = {}) {
  const cohortSet = cohorts && cohorts.length ? new Set(cohorts) : null
  const filtered = cohortSet ? events.filter(e => cohortSet.has(e.cohort)) : events

  const byCohort = {}
  const companyCounts = {}
  const sectorCounts = {}

  for (const e of filtered) {
    if (!byCohort[e.cohort]) byCohort[e.cohort] = { summer: 0, final: 0, total: 0 }
    byCohort[e.cohort][e.cycle] = (byCohort[e.cohort][e.cycle] || 0) + 1
    byCohort[e.cohort].total += 1

    companyCounts[e.company] = (companyCounts[e.company] || 0) + 1
    sectorCounts[e.sector] = (sectorCounts[e.sector] || 0) + 1
  }

  const topCompanies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return { byCohort, topCompanies, topSectors, totalEvents: filtered.length }
}

// ── Stats & simple linear projection ──────────────────────────────────────────

// Given a cumulative series (sorted ascending buckets) and the cohort's total
// student count, project the bucket index at which 100% would be reached using
// simple linear regression over the last N points (recent velocity).
export function projectCompletion(cumulativeValues, totalStudents, { lookback = 6 } = {}) {
  if (!totalStudents || cumulativeValues.length < 2) return null
  const n = cumulativeValues.length
  const recent = cumulativeValues.slice(Math.max(0, n - lookback))
  const m = recent.length
  if (m < 2) return null

  // Linear regression: x = 0..m-1, y = recent values
  const xs = recent.map((_, i) => i)
  const meanX = xs.reduce((a, b) => a + b, 0) / m
  const meanY = recent.reduce((a, b) => a + b, 0) / m
  let num = 0, den = 0
  for (let i = 0; i < m; i++) {
    num += (xs[i] - meanX) * (recent[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den // placements per bucket (recent velocity)
  const lastValue = recent[m - 1]

  if (slope <= 0) {
    return { velocity: slope, bucketsToComplete: null, projectedPct: (lastValue / totalStudents) * 100 }
  }

  const remaining = totalStudents - lastValue
  const bucketsToComplete = remaining > 0 ? Math.ceil(remaining / slope) : 0

  return {
    velocity: slope,
    bucketsToComplete,
    projectedPct: Math.min(100, (lastValue / totalStudents) * 100),
  }
}
