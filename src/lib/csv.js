// src/lib/csv.js
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { OUR_COLS } from './columns'

export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: r => resolve(r.data),
      error: reject
    })
  })
}

export async function parseDataFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()

  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    return parseDelimitedFile(file, ext)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(file)
  }

  throw new Error('Unsupported file format. Use CSV, TSV, TXT, XLS, or XLSX.')
}

async function parseDelimitedFile(file, ext) {
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
  return buildTableFromMatrix(matrix)
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

async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('No sheet found in workbook')

  const ws = workbook.Sheets[firstSheet]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  return buildTableFromMatrix(matrix)
}

function buildTableFromMatrix(matrix) {
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
  const rows = rowsArr
    .slice(headerIdx + 1)
    .filter(r => Array.isArray(r) && labeled.some(c => cleanCell(r[c.idx]) !== ''))
    .map(r => {
      const obj = {}
      labeled.forEach((c, i) => {
        obj[headers[i]] = cleanCell(r[c.idx])
      })
      return obj
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

function cleanCell(value) {
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

export function exportToExcel(rows, filename) {
  if (!rows.length) return
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
