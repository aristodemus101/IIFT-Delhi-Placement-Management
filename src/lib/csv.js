// src/lib/csv.js
import Papa from 'papaparse'
import { OUR_COLS } from './columns'

// xlsx is ~500 KB — import it dynamically so it only loads when a user
// actually opens an Excel file or triggers an Excel export.
const getXLSX = () => import('xlsx')

export function parseCSVFile(file, meta = {}) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: r => {
        const rows = Array.isArray(r.data) ? r.data.map(row => attachMeta(row, meta)) : []
        resolve(rows)
      },
      error: reject
    })
  })
}

export async function parseDataFile(file, meta = {}) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()

  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    return parseDelimitedFile(file, ext, meta)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(file, meta)
  }

  throw new Error('Unsupported file format. Use CSV, TSV, TXT, XLS, or XLSX.')
}

async function parseDelimitedFile(file, ext, meta = {}) {
  const text = await file.text()
  const delimiter = detectDelimiter(text, ext)

  const parsed = Papa.parse(text, {
    header: false,
    delimiter,
    skipEmptyLines: false,
  })

  if (parsed.errors?.length) {
    const first = parsed.errors[0]
    throw new Error(first?.message || 'Failed to parse delimited file')
  }

  const matrix = (parsed.data || []).map(r => Array.isArray(r) ? r : [r])
  return buildTableFromMatrix(matrix, meta)
}

function detectDelimiter(text, ext) {
  if (ext === 'tsv') return '\t'
  if (ext === 'csv') return ','

  const sampleLines = String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 5)

  if (!sampleLines.length) return ','

  const candidates = [
    { delim: '\t', score: 0 },
    { delim: ',', score: 0 },
    { delim: ';', score: 0 },
    { delim: '|', score: 0 },
  ]

  sampleLines.forEach(line => {
    candidates.forEach(c => {
      const cols = line.split(c.delim).length
      c.score += cols > 1 ? cols : 0
    })
  })

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].score > 0 ? candidates[0].delim : ','
}

async function parseExcelFile(file, meta = {}) {
  const XLSX = await getXLSX()
  const buffer = await file.arrayBuffer()
  // cellDates: true → SheetJS converts date-typed cells to JS Date objects
  // instead of leaving them as Excel serial integers (e.g. 44869 → 2022-11-03)
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('No sheet found in workbook')

  const ws = workbook.Sheets[firstSheet]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  return buildTableFromMatrix(matrix, meta)
}

function buildTableFromMatrix(matrix, meta = {}) {
  const rowsArr = Array.isArray(matrix) ? matrix : []
  if (!rowsArr.length) return { rows: [], headers: [] }

  const headerIdx = findHeaderRowIndex(rowsArr)
  if (headerIdx === -1) return { rows: [], headers: [] }

  const headerRow = rowsArr[headerIdx] || []
  const headerCells = headerRow.map((cell, idx) => ({
    idx,
    raw: cleanCell(cell),
  }))

  // Ignore empty header cells so the roster schema mirrors actual labeled columns.
  const labeled = headerCells.filter(c => c.raw)
  if (!labeled.length) return { rows: [], headers: [] }

  const headers = normalizeHeaders(labeled.map(c => c.raw))

  // Mark which column indices look like date columns (header contains "date" or "dob")
  // so we can coerce stray Excel serials (e.g. from CSVs) to ISO strings.
  const dateColIndices = new Set(
    labeled
      .filter(c => /date|dob|birth/i.test(c.raw))
      .map(c => c.idx)
  )

  const rows = rowsArr
    .slice(headerIdx + 1)
    .filter(r => Array.isArray(r) && labeled.some(c => cleanCell(r[c.idx]) !== ''))
    .map(r => {
      const obj = {}
      labeled.forEach((c, i) => {
        const raw = r[c.idx]
        // Coerce bare Excel serial integers in date columns to ISO date strings.
        // cellDates:true handles most cases; this catches CSVs and unformatted cells.
        if (dateColIndices.has(c.idx) && typeof raw === 'number' && Number.isInteger(raw) && raw > 1 && raw < 73050) {
          obj[headers[i]] = excelSerialToISO(raw)
        } else {
          obj[headers[i]] = cleanCell(raw)
        }
      })
      return attachMeta(obj, meta)
    })

  return { rows, headers }
}

function findHeaderRowIndex(matrix) {
  const limit = Math.min(matrix.length, 25)
  let bestIdx = -1
  let bestScore = -1

  for (let i = 0; i < limit; i += 1) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : []
    if (!row.length) continue

    const cleaned = row.map(cleanCell)
    const nonEmpty = cleaned.filter(Boolean)
    if (nonEmpty.length < 2) continue

    const textLike = nonEmpty.filter(v => /[A-Za-z]/.test(v)).length
    const score = nonEmpty.length * 2 + textLike

    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  return bestIdx
}

// Convert an Excel serial integer to an ISO date string (YYYY-MM-DD).
// Formula: serial - 25569 gives days since Unix epoch (1970-01-01),
// matching SheetJS's own internal conversion.
function excelSerialToISO(serial) {
  const utcMs = (serial - 25569) * 86400 * 1000
  const d = new Date(utcMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function cleanCell(value) {
  // SheetJS with cellDates:true yields JS Date objects for date-typed cells
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .trim()
}

function normalizeHeaders(headers) {
  const seen = new Set()
  const out = []
  headers.forEach((raw, idx) => {
    const base = String(raw || '').trim() || `Column ${idx + 1}`
    let candidate = base
    let n = 2
    while (seen.has(candidate)) {
      candidate = `${base} (${n})`
      n += 1
    }
    seen.add(candidate)
    out.push(candidate)
  })
  return out
}

function attachMeta(row, meta = {}) {
  if (!meta || typeof meta !== 'object') return row
  const out = { ...row }
  Object.keys(meta).forEach(k => {
    try {
      const val = meta[k]
      if (val === undefined || val === null) return
      const cur = out[k]
      if (cur === undefined || cur === null || String(cur).trim() === '') {
        out[k] = val
      }
    } catch (e) {
      // ignore malformed meta values
    }
  })
  return out
}

export function exportToCSV(rows, filename) {
  if (!rows.length) return
  const clean = stripInternalFields(rows)
  const csv = Papa.unparse(clean)
  downloadString(csv, filename, 'text/csv;charset=utf-8;')
}

export function exportToTSV(rows, filename) {
  if (!rows.length) return
  const clean = stripInternalFields(rows)
  const tsv = Papa.unparse(clean, { delimiter: '\t' })
  downloadString(tsv, filename, 'text/tab-separated-values;charset=utf-8;')
}

export async function exportToExcel(rows, filename) {
  if (!rows.length) return
  const XLSX = await getXLSX()
  const clean = stripInternalFields(rows)
  const ws = XLSX.utils.json_to_sheet(clean)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Roster')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadBlob(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export function exportRemapped(rows, mappings, filename) {
  const headers = mappings.map(m => m.companyCol)
  const clean = rows.map(s => {
    const obj = {}
    mappings.forEach(m => {
      if (m.ourKey) {
        const col = OUR_COLS.find(c => c.key === m.ourKey)
        obj[m.companyCol] = col ? (col.path(s) || '') : ''
      } else {
        obj[m.companyCol] = ''
      }
    })
    return obj
  })
  const csv = Papa.unparse(clean, { columns: headers })
  downloadString(csv, filename)
}

function stripInternalFields(rows) {
  return rows.map(r => {
    const obj = { ...r }
    Object.keys(obj).filter(k => k.startsWith('_')).forEach(k => delete obj[k])
    return obj
  })
}

function downloadString(text, filename, mime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([text], { type: mime })
  downloadBlob(blob, filename, mime)
}

function downloadBlob(data, filename, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
