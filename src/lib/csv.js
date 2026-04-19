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

  if (ext === 'csv' || ext === 'tsv') {
    return parseDelimitedFile(file, ext === 'tsv' ? '\t' : ',')
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(file)
  }

  throw new Error('Unsupported file format. Use CSV, TSV, XLS, or XLSX.')
}

function parseDelimitedFile(file, delimiter) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      transformHeader: h => (h || '').trim(),
      complete: r => {
        const headers = normalizeHeaders(r.meta?.fields || [])
        const rows = (r.data || []).map(row => {
          const out = {}
          headers.forEach(h => { out[h] = row[h] ?? '' })
          return out
        })
        resolve({ rows, headers })
      },
      error: reject,
    })
  })
}

async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('No sheet found in workbook')

  const ws = workbook.Sheets[firstSheet]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  if (!matrix.length) return { rows: [], headers: [] }

  const headers = normalizeHeaders((matrix[0] || []).map(v => String(v || '').trim()))
  const rows = matrix.slice(1)
    .filter(r => Array.isArray(r) && r.some(v => String(v || '').trim() !== ''))
    .map(r => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
      return obj
    })

  return { rows, headers }
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
  // Remove internal _ fields
  const clean = rows.map(r => {
    const obj = { ...r }
    Object.keys(obj).filter(k => k.startsWith('_')).forEach(k => delete obj[k])
    return obj
  })
  const csv = Papa.unparse(clean)
  downloadString(csv, filename)
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

function downloadString(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
