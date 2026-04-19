const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function api(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`)
  return json
}

function fmt(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  } catch { return '' }
}

function fullName(s) {
  return s['Full Name'] || `${s['First Name'] || ''} ${s['Last Name'] || ''}`.trim()
}

export function changeDescription(c) {
  switch (c.type) {
    case 'place':    return `Placed ${c.studentName} (${c.studentRoll}) → ${c.company}`
    case 'unplace':  return `Unplaced ${c.studentName} from ${c.currentCompany}`
    case 'delete':   return `Deleted ${c.studentName} (${c.studentRoll})`
    case 'import':   return `Imported ${c.rowCount} student${c.rowCount !== 1 ? 's' : ''}`
    case 'clearAll': return `Cleared all ${c.studentCount} students`
    default:         return c.type
  }
}

// ── Spreadsheet bootstrap ────────────────────────────────────────────────────

export async function getOrCreateSpreadsheet(token) {
  const stored = localStorage.getItem('placementos_sheet_id')

  if (stored) {
    try {
      await api('GET', `${BASE}/${stored}?fields=spreadsheetId`, token)
      return stored
    } catch { /* deleted or inaccessible — create new */ }
  }

  const sheet = await api('POST', BASE, token, {
    properties: { title: 'PlacementOS Backup — IIFT Batch 2027' },
    sheets: [
      { properties: { sheetId: 0, index: 0, title: 'Change Log'       } },
      { properties: { sheetId: 1, index: 1, title: 'Roster Snapshot'  } },
      { properties: { sheetId: 2, index: 2, title: 'Placed Snapshot'  } },
    ],
  })

  // Seed Change Log headers
  await writeRange(token, sheet.spreadsheetId, 'Change Log!A1', [[
    'Timestamp (IST)', 'Action', 'Description', 'Proposed By', 'Approved By', 'Note',
  ]])

  localStorage.setItem('placementos_sheet_id', sheet.spreadsheetId)
  return sheet.spreadsheetId
}

// ── Low-level Sheets ops ─────────────────────────────────────────────────────

async function writeRange(token, sheetId, range, values) {
  await api('PUT',
    `${BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    token, { values })
}

async function clearRange(token, sheetId, range) {
  await api('POST', `${BASE}/${sheetId}/values/${encodeURIComponent(range)}:clear`, token)
}

async function appendRows(token, sheetId, range, values) {
  await api('POST',
    `${BASE}/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token, { values })
}

// ── Public API ───────────────────────────────────────────────────────────────

// Called after every approved change — appends one row to Change Log
export async function appendChangeLog(token, sheetId, change) {
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  await appendRows(token, sheetId, 'Change Log!A:F', [[
    ts,
    change.type,
    changeDescription(change),
    change.proposedByName  || '',
    change.reviewedByName  || '',
    change.note            || '',
  ]])
}

// Called on manual "Sync Now" — overwrites Roster + Placed snapshot tabs
export async function syncFullSnapshot(token, sheetId, students) {
  const active = students.filter(s => !s._placed)
  const placed = students.filter(s => s._placed)
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  const ROSTER_HEADERS = [
    'Roll No.', 'Full Name', 'Gender', 'Category', 'CAT %ile', 'CAT Score',
    'Work Ex (mo)', 'UG Degree', 'UG %', 'XII %', 'X %', 'PWD',
    'Personal Email', 'Mobile (WhatsApp)', 'Last Synced',
  ]
  const rosterRows = active.map(s => [
    s['Roll No.']                                        || '',
    fullName(s),
    s['Gender']                                          || '',
    s['Category']                                        || '',
    s['CAT Percentile']                                  || '',
    s['CAT Score']                                       || '',
    s['Total Work Experience (in months)']               || '',
    s['UG Degree (Eg: Btech, BBA, B.com, etc.)']        || '',
    s['Graduation Overall Score in %age']                || '',
    s['Class XII Score in percentage:']                  || '',
    s['Class X Score in percentage:']                    || '',
    s['PWD Status']                                      || '',
    s['Personal Email ID']                               || '',
    s['Mobile Number (Whatsapp)']                        || '',
    ts,
  ])

  const PLACED_HEADERS = [
    'Roll No.', 'Full Name', 'Gender', 'Category', 'CAT %ile',
    'Work Ex (mo)', 'Company', 'Placed On',
  ]
  const placedRows = placed.map(s => [
    s['Roll No.']                              || '',
    fullName(s),
    s['Gender']                                || '',
    s['Category']                              || '',
    s['CAT Percentile']                        || '',
    s['Total Work Experience (in months)']     || '',
    s._placedCompany                           || '',
    s._placedAt ? new Date(s._placedAt).toLocaleDateString('en-IN') : '',
  ])

  await clearRange(token, sheetId, 'Roster Snapshot!A:Z')
  await writeRange(token, sheetId, 'Roster Snapshot!A1', [ROSTER_HEADERS, ...rosterRows])

  await clearRange(token, sheetId, 'Placed Snapshot!A:Z')
  await writeRange(token, sheetId, 'Placed Snapshot!A1', [PLACED_HEADERS, ...placedRows])

  return { active: active.length, placed: placed.length }
}
