export const BATCH_VALUES = {
  SUMMER: 'summer',
  FINAL: 'final',
}

export const BATCH_OPTIONS = [
  { value: BATCH_VALUES.SUMMER, label: 'Summer Batch', short: 'Summer', accent: 'var(--amber-text)' },
  { value: BATCH_VALUES.FINAL, label: 'Final Batch', short: 'Final', accent: 'var(--accent)' },
]

export function normalizeBatch(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === BATCH_VALUES.SUMMER) return BATCH_VALUES.SUMMER
  if (raw === BATCH_VALUES.FINAL) return BATCH_VALUES.FINAL
  return BATCH_VALUES.FINAL
}

export function batchLabel(value) {
  const normalized = normalizeBatch(value)
  const found = BATCH_OPTIONS.find(b => b.value === normalized)
  return found ? found.label : 'Final Batch'
}

export function batchShortLabel(value) {
  const normalized = normalizeBatch(value)
  const found = BATCH_OPTIONS.find(b => b.value === normalized)
  return found ? found.short : 'Final'
}

export function schemaDocIdForBatch(value) {
  const normalized = normalizeBatch(value)
  return `columnSchema_${normalized}`
}
