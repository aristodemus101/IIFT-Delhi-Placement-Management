// Helpers only — no hardcoded batch values anymore

// ── Cohort schema ────────────────────────────────────────────────────────────

export const CAMPUSES = ['Delhi', 'Kakinada', 'Gift City', 'Kolkata']
export const PROGRAMMES = ['IB', 'BA']

// Which campuses offer each programme
export const CAMPUS_PROGRAMMES = {
  IB: ['Delhi', 'Kakinada', 'Gift City', 'Kolkata'],
  BA: ['Delhi'],
}

// Returns valid campuses for a given programme (or all campuses if no programme selected)
export function campusesForProgramme(programme) {
  if (!programme) return CAMPUSES
  return CAMPUS_PROGRAMMES[programme] || CAMPUSES
}

// Returns valid programmes for a given campus
export function programmesForCampus(campus) {
  return PROGRAMMES.filter(p => (CAMPUS_PROGRAMMES[p] || []).includes(campus))
}

// Canonical cohort ID: '27-Delhi-IB'
export function makeCohortId(yearCode, campus, programme) {
  if (!yearCode) return ''
  const parts = [yearCode]
  if (campus) parts.push(campus.replace(/\s+/g, ''))   // 'Gift City' → 'GiftCity'
  if (programme) parts.push(programme)
  return parts.join('-')
}

// Parse '27-Delhi-IB' → { yearCode: '27', campus: 'Delhi', programme: 'IB' }
// Parse '27-GiftCity-IB' → { yearCode: '27', campus: 'Gift City', programme: 'IB' }
export function parseCohortId(id) {
  if (!id) return { yearCode: '', campus: '', programme: '' }
  const parts = String(id).split('-')
  const yearCode = parts[0] || ''
  // Last part is programme if it matches a known programme
  const last = parts[parts.length - 1]
  const programme = PROGRAMMES.includes(last) ? last : ''
  // Middle parts form the campus (re-space 'GiftCity' → 'Gift City')
  const campusParts = programme ? parts.slice(1, -1) : parts.slice(1)
  const campusRaw = campusParts.join('-')
  // Re-expand known collapsed campus names
  const campus = campusRaw === 'GiftCity' ? 'Gift City' : campusRaw
  return { yearCode, campus, programme }
}

// Returns year options centred on current graduating year ± 2
export function cohortYearOptions() {
  const currentYear = new Date().getFullYear()
  const base = currentYear - 2000  // e.g. 2027 → 27
  const options = []
  for (let d = base - 2; d <= base + 2; d++) {
    options.push({ value: `${d}`, label: `${d} (${2000 + d})` })
  }
  return options
}

// ── Cohort + season helpers ──────────────────────────────────────────────────

export function cohortLabel(id) {
  if (!id) return 'No cohort'
  const { yearCode, campus, programme } = parseCohortId(id)
  const parts = [yearCode, campus, programme].filter(Boolean)
  return parts.join(' ')
}

// Returns the programme part, e.g. 'D27-Delhi-IB' → 'IB'
export function cohortProgramme(id) {
  return parseCohortId(id).programme
}

// Returns the campus part, e.g. 'D27-Delhi-IB' → 'Delhi'
export function cohortCampus(id) {
  return parseCohortId(id).campus
}

export function cohortYear(id) {
  if (!id) return 0
  const digits = String(id).replace(/[^0-9]/g, '')
  const n = parseInt(digits)
  if (isNaN(n)) return 0
  return 2000 + n
}

export function seasonLabel(season) {
  if (season === 'summer') return 'Summer Internship'
  if (season === 'final')  return 'Final Placement'
  return season || 'Unknown Season'
}

export function seasonShort(season) {
  if (season === 'summer') return 'Summer'
  if (season === 'final')  return 'Final'
  return season || ''
}

export function schemaDocIdForBatch(batchId) {
  return `columnSchema_${batchId}`
}


