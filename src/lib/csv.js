// src/lib/csv.js
import Papa from 'papaparse'
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
