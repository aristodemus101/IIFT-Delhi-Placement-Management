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

// Canonical cohort ID: 'D27-Delhi-IB'
export function makeCohortId(yearCode, campus, programme) {
  if (!yearCode) return ''
  const parts = [yearCode]
  if (campus) parts.push(campus.replace(/\s+/g, ''))   // 'Gift City' → 'GiftCity'
  if (programme) parts.push(programme)
  return parts.join('-')
}

// Parse 'D27-Delhi-IB' → { yearCode: 'D27', campus: 'Delhi', programme: 'IB' }
// Parse 'D27-GiftCity-IB' → { yearCode: 'D27', campus: 'Gift City', programme: 'IB' }
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
  // Graduating year typically = current calendar year + 1 for first-year students
  // We offer a ±2 window around the current year
  const base = currentYear - 2000  // e.g. 2027 → 27
  const options = []
  for (let d = base - 2; d <= base + 2; d++) {
    options.push({ value: `D${d}`, label: `D${d} (${2000 + d})` })
  }
  return options
}

// ── New cohort + season helpers ─────────────────────────────────────────────

export function cohortLabel(id) {
  if (!id) return 'No cohort'
  // 'D27-Delhi-IB' → 'D27 Delhi IB', 'D27-GiftCity-IB' → 'D27 Gift City IB'
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

// ── Legacy / compatibility helpers ──────────────────────────────────────────

export function makeBatchId(year, type) {
  return `${year}_${type}` // e.g. '2025_summer'
}

export function parseBatchId(id) {
  const [year, type] = (id || '').split('_')
  return { year: parseInt(year) || 0, type: type || 'final' }
}

export function batchLabel(id) {
  if (!id) return 'No cohort'
  // New cohort IDs have no underscore (e.g. 'D27', 'D28')
  if (!String(id).includes('_')) return cohortLabel(id)
  // Legacy batch IDs: '2025_summer' → 'Summer 2025'
  const { year, type } = parseBatchId(id)
  return `${type === 'summer' ? 'Summer' : 'Final'} ${year}`
}

export function batchShortLabel(id) {
  if (!id) return ''
  if (!String(id).includes('_')) return id
  const { year, type } = parseBatchId(id)
  return `${type === 'summer' ? 'Summer' : 'Final'} '${String(year).slice(-2)}`
}

export function schemaDocIdForBatch(batchId) {
  return `columnSchema_${batchId}`
}

// legacy normalizer — only used during migration/fallback
export function normalizeBatch(value) {
  if (!value) return 'final'
  if (String(value).includes('_')) return value // already new format
  return value // return as-is for old 'summer'/'final' strings
}

// Legacy constants kept for any remaining references during migration
export const BATCH_VALUES = {
  SUMMER: 'summer',
  FINAL: 'final',
}

export const BATCH_OPTIONS = [
  { value: BATCH_VALUES.SUMMER, label: 'Summer Batch', short: 'Summer', accent: 'var(--amber-text)' },
  { value: BATCH_VALUES.FINAL, label: 'Final Batch', short: 'Final', accent: 'var(--accent)' },
]
