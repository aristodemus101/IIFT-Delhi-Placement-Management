// Intel module: column mapping, deduplication, batch upload, and fuzzy matching.
//
// Schema invariants:
//  - One Firestore doc per (recruiterId × collegeName × placementYear × placementCycle × program).
//    The same company visiting 5 colleges = 5 docs. This is intentional: each doc
//    represents one appearance of a recruiter at one institution in one cycle.
//  - _deleted: true = soft-deleted. Never hard-delete from the client except admin explicit.
//  - importBatch: UUID tying all rows from one upload together for audit / rollback.

import { db } from './firebase'
import {
  collection, doc, writeBatch, serverTimestamp,
  query, where, getDocs, updateDoc, setDoc,
} from 'firebase/firestore'

// ── Canonical column header map ───────────────────────────────────────────────
// Maps every known header variant (case-insensitive) to our internal field key.
const HEADER_MAP = {
  'recruiter id':            'recruiterId',
  'recruiterid':             'recruiterId',
  'id':                      'recruiterId',
  'recruiter name':          'recruiterName',
  'recruitername':           'recruiterName',
  'company':                 'recruiterName',
  'company name':            'recruiterName',
  'alias':                   'alias',
  'placement year':          'placementYear',
  'year':                    'placementYear',
  'academic batch':          'academicBatch',
  'batch':                   'academicBatch',
  'placement cycle':         'placementCycle',
  'cycle':                   'placementCycle',
  'college name':            'collegeName',
  'college':                 'collegeName',
  'institution':             'collegeName',
  'campus':                  'campus',
  'program':                 'program',
  'programme':               'program',
  'sector':                  'sector',
  'industry':                'sector',
  'function':                'function',
  'role mentioned':          'rolesMentioned',
  'role':                    'rolesMentioned',
  'roles':                   'rolesMentioned',
  'recruiter type':          'recruiterType',
  'type':                    'recruiterType',
  'international opportunity': 'internationalOpp',
  'international':           'internationalOpp',
  'international location':  'internationalLoc',
  'number of offers':        'numberOfOffers',
  'offers':                  'numberOfOffers',
  'no of offers':            'numberOfOffers',
  'source report':           'sourceReport',
  'source':                  'sourceReport',
  'source type':             'sourceType',
  'evidence':                'evidence',
  'remarks':                 'remarks',
  'compensation':            'compensation',
  'ctc':                     'compensation',
  'package':                 'compensation',
  'poc name':                'pocName',
  'poc':                     'pocName',
  'poc email':               'pocEmail',
  'poc phone':               'pocPhone',
  'notes':                   'notes',
}

// ── Deduplication key ─────────────────────────────────────────────────────────
// Uniquely identifies one recruiter-appearance at one college in one cycle.
// Same company at 5 colleges = 5 different keys (by design).
export function dedupKey(row) {
  const id   = normalizeId(row.recruiterId || row.recruiterName || '')
  const col  = (row.collegeName || '').trim().toUpperCase()
  const yr   = String(row.placementYear || '').trim()
  const cyc  = (row.placementCycle || '').trim().toUpperCase()
  const prog = (row.program || '').trim().toUpperCase()
  return [id, col, yr, cyc, prog].join('::')
}

// ── ID normaliser ─────────────────────────────────────────────────────────────
// Strips spaces, punctuation, lowercases. Used for fuzzy IIFT matching.
export function normalizeId(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

// ── Fuzzy token match ─────────────────────────────────────────────────────────
// Returns true if any token in `a` appears in `b` or vice versa (length >= 4).
// Handles "Asian Paints" vs "Asian Paints India" etc.
export function fuzzyMatch(a, b) {
  if (!a || !b) return false
  const na = normalizeId(a)
  const nb = normalizeId(b)
  if (na === nb) return true
  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return true
  // Token overlap: split on word boundaries and check meaningful tokens
  const tokA = String(a).toUpperCase().split(/\W+/).filter(t => t.length >= 4)
  const tokB = String(b).toUpperCase().split(/\W+/).filter(t => t.length >= 4)
  return tokA.some(t => tokB.some(u => t.includes(u) || u.includes(t)))
}

// ── Parse Excel/CSV rows into canonical intel records ─────────────────────────
export function parseIntelRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return { records: [], warnings: [] }

  // Detect headers from first row
  const headers = Object.keys(rawRows[0])
  const colMap = {}
  headers.forEach(h => {
    const key = HEADER_MAP[h.toLowerCase().trim()]
    if (key) colMap[h] = key
  })

  const parsed = []
  const warnings = []

  rawRows.forEach((raw, idx) => {
    const row = {}
    Object.entries(raw).forEach(([h, v]) => {
      const key = colMap[h]
      if (key) row[key] = v
    })

    // Require at minimum a name or ID
    if (!row.recruiterId && !row.recruiterName) {
      warnings.push(`Row ${idx + 2}: skipped — no Recruiter ID or Name`)
      return
    }

    // Derive recruiterId from name if missing
    if (!row.recruiterId && row.recruiterName) {
      row.recruiterId = normalizeId(row.recruiterName)
    }

    // Coerce types
    if (row.placementYear) row.placementYear = parseInt(row.placementYear, 10) || null
    if (row.numberOfOffers) row.numberOfOffers = parseInt(row.numberOfOffers, 10) || null
    if (row.internationalOpp) {
      const v = String(row.internationalOpp).toLowerCase()
      row.internationalOpp = v === 'yes' || v === 'true' || v === '1'
    } else {
      row.internationalOpp = false
    }

    // Normalize strings
    ;['recruiterId', 'recruiterName', 'alias', 'placementCycle', 'collegeName',
      'campus', 'program', 'sector', 'function', 'rolesMentioned', 'recruiterType',
      'internationalLoc', 'sourceReport', 'sourceType', 'evidence', 'remarks',
      'academicBatch', 'compensation', 'pocName', 'pocEmail', 'pocPhone', 'notes',
    ].forEach(k => {
      if (row[k] !== undefined) row[k] = String(row[k] || '').trim()
    })

    parsed.push(row)
  })

  return { records: parsed, warnings }
}

// ── Batch upload to Firestore ─────────────────────────────────────────────────
// Handles Firestore's 500-op-per-batch limit.
// Uses dedup key to upsert: if a doc with that key already exists, update it.
// Progress callback: (done, total) => void
export async function uploadIntelBatch({ records, user, importBatchId, onProgress }) {
  if (!records.length) return { inserted: 0, updated: 0, errors: [] }

  const FIRESTORE_BATCH_SIZE = 499 // leave 1 slot for safety
  const intelCol = collection(db, 'intel')
  const now = serverTimestamp()
  const errors = []
  let inserted = 0
  let updated = 0

  // Step 1: build dedup key → Firestore doc ID map by querying existing records.
  // We query by importBatch is not relevant here — we need to find any existing
  // doc with matching dedup key. We store the dedupKey as a field for O(1) lookup.
  const allKeys = records.map(dedupKey)
  // Query in chunks of 30 (Firestore 'in' limit)
  const existingMap = {}
  const keyChunks = chunkArray(allKeys, 30)
  for (const chunk of keyChunks) {
    // Query by _dedupKey only — no _deleted filter, so no composite index needed.
    // We intentionally match soft-deleted docs too: if a record was deleted and
    // re-uploaded, we update it in place rather than creating a duplicate.
    const q = query(intelCol, where('_dedupKey', 'in', chunk))
    const snap = await getDocs(q)
    snap.forEach(d => { existingMap[d.data()._dedupKey] = d.id })
  }

  // Step 2: split into Firestore batches of 499 ops
  const recordChunks = chunkArray(records, FIRESTORE_BATCH_SIZE)
  let done = 0

  for (const chunk of recordChunks) {
    const batch = writeBatch(db)
    for (const record of chunk) {
      const key = dedupKey(record)
      const existingId = existingMap[key]
      const docRef = existingId
        ? doc(db, 'intel', existingId)
        : doc(intelCol)         // auto-ID for new docs

      const payload = {
        recruiterId:     record.recruiterId    || '',
        recruiterName:   record.recruiterName  || '',
        alias:           record.alias          || '',
        placementYear:   record.placementYear  || null,
        academicBatch:   record.academicBatch  || '',
        placementCycle:  record.placementCycle || '',
        collegeName:     record.collegeName    || '',
        campus:          record.campus         || '',
        program:         record.program        || '',
        sector:          record.sector         || '',
        function:        record.function       || '',
        rolesMentioned:  record.rolesMentioned || '',
        recruiterType:   record.recruiterType  || '',
        internationalOpp: record.internationalOpp || false,
        internationalLoc: record.internationalLoc || '',
        numberOfOffers:  record.numberOfOffers || null,
        sourceReport:    record.sourceReport   || '',
        sourceType:      record.sourceType     || '',
        evidence:        record.evidence       || '',
        remarks:         record.remarks        || '',
        compensation:    record.compensation   || '',
        poc: {
          name:  record.pocName  || '',
          email: record.pocEmail || '',
          phone: record.pocPhone || '',
        },
        notes:           record.notes          || '',
        importBatch:     importBatchId,
        _dedupKey:       key,
        _deleted:        false,
        updatedAt:       now,
        updatedBy:       user.uid,
      }

      if (existingId) {
        batch.update(docRef, payload)
        updated++
      } else {
        batch.set(docRef, { ...payload, createdAt: now, createdBy: user.uid })
        inserted++
      }
    }

    try {
      await batch.commit()
    } catch (e) {
      errors.push(e.message)
    }
    done += chunk.length
    onProgress?.(done, records.length)
  }

  return { inserted, updated, errors }
}

// ── Soft delete ───────────────────────────────────────────────────────────────
export async function softDeleteIntel(docId, user) {
  await updateDoc(doc(db, 'intel', docId), {
    _deleted: true,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  })
}

// ── Save single record (add or edit) ─────────────────────────────────────────
export async function saveIntelRecord(data, user, existingId = null) {
  const key = dedupKey(data)
  const payload = {
    ...blankIntelRecord(),
    ...data,
    _dedupKey:  key,
    _deleted:   false,
    updatedAt:  serverTimestamp(),
    updatedBy:  user.uid,
  }
  if (existingId) {
    await updateDoc(doc(db, 'intel', existingId), payload)
    return existingId
  } else {
    const ref = doc(collection(db, 'intel'))
    await setDoc(ref, { ...payload, createdAt: serverTimestamp(), createdBy: user.uid })
    return ref.id
  }
}

// ── Blank record shape ────────────────────────────────────────────────────────
export function blankIntelRecord() {
  return {
    recruiterId:     '',
    recruiterName:   '',
    alias:           '',
    placementYear:   null,
    academicBatch:   '',
    placementCycle:  'Finals',
    collegeName:     '',
    campus:          '',
    program:         '',
    sector:          '',
    function:        '',
    rolesMentioned:  '',
    recruiterType:   '',
    internationalOpp: false,
    internationalLoc: '',
    numberOfOffers:  null,
    sourceReport:    '',
    sourceType:      '',
    evidence:        '',
    remarks:         '',
    compensation:    '',
    poc:             { name: '', email: '', phone: '' },
    notes:           '',
    importBatch:     '',
    _deleted:        false,
  }
}

// ── Known sector list (expandable) ───────────────────────────────────────────
export const INTEL_SECTORS = [
  'FMCG', 'BFSI', 'Consulting', 'IT / Tech', 'E-Commerce', 'Manufacturing',
  'Healthcare / Pharma', 'Media & Entertainment', 'Retail', 'Real Estate',
  'Energy / Infrastructure', 'Logistics', 'Education', 'Government / PSU', 'Other',
]

export const INTEL_CYCLES = ['Finals', 'Summer', 'Lateral']

// ── Utility ───────────────────────────────────────────────────────────────────
function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
