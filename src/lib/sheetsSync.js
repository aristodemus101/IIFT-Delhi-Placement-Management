const BASE  = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE = 'https://www.googleapis.com/drive/v3/files'

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

// ── Opportunity Tracker ───────────────────────────────────────────────────────
//
// Creates a standalone Google Sheet for one opportunity.
// Each call to createTrackerTab() adds a new tab (EOI, Joined Group, etc.)
// with Roll | Name | Email | <action col> where <action col> has a Yes/No dropdown.
//
// studentList shape: { mode: 'all'|'ytp'|'custom', students: [...student objects] }
// stageConfig shape: { label: 'EOI Stage', colHeader: 'Filled EOI', sheetTitle: 'EOI' }

export async function createOpportunityTracker(token, oppTitle, students, stageConfig) {
  // Create a brand-new spreadsheet for this opportunity
  const sheetRes = await api('POST', BASE, token, {
    properties: { title: `Tracker — ${oppTitle}` },
    sheets: [
      { properties: { sheetId: 0, index: 0, title: stageConfig.sheetTitle } },
    ],
  })
  const spreadsheetId = sheetRes.spreadsheetId

  // Share with anyone who has the link (editor)
  await fetch(`${DRIVE}/${spreadsheetId}/permissions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'writer', type: 'anyone' }),
  })

  await _writeTrackerTab(token, spreadsheetId, 0, stageConfig, students)

  return {
    spreadsheetId,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  }
}

export async function addTrackerTab(token, spreadsheetId, stageConfig, students) {
  // Get existing sheet metadata to find next sheetId and index
  const meta = await api('GET', `${BASE}/${spreadsheetId}?fields=sheets.properties`, token)
  const existingSheets = meta.sheets || []
  const nextIndex = existingSheets.length
  // Use a random sheetId to avoid collisions
  const newSheetId = Math.floor(Math.random() * 900000) + 100000

  await api('POST', `${BASE}/${spreadsheetId}:batchUpdate`, token, {
    requests: [{
      addSheet: {
        properties: { sheetId: newSheetId, index: nextIndex, title: stageConfig.sheetTitle },
      },
    }],
  })

  await _writeTrackerTab(token, spreadsheetId, newSheetId, stageConfig, students)

  return { spreadsheetId, sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` }
}

async function _writeTrackerTab(token, spreadsheetId, sheetId, stageConfig, students) {
  const sheetTitle = stageConfig.sheetTitle
  const colHeader  = stageConfig.colHeader   // e.g. "Filled EOI" or "Joined Group"

  // Write header row + data rows
  const headers = ['Roll No.', 'Name', 'Official Email', colHeader]
  const rows = students.map(s => [
    s['Roll No.'] || s.roll || '',
    s['Full Name'] || `${s['First Name'] || ''} ${s['Last Name'] || ''}`.trim() || s.name || '',
    s['Official Email ID (d27/ba27)'] || s.official_email || s.email || '',
    'No',  // default value
  ])

  await writeRange(token, spreadsheetId, `${sheetTitle}!A1`, [headers, ...rows])

  // Style header row — bold + background
  const totalRows = rows.length + 1  // +1 for header

  await api('POST', `${BASE}/${spreadsheetId}:batchUpdate`, token, {
    requests: [
      // Bold header
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
          cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.24, green: 0.52, blue: 0.78 } } },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      },
      // Header text white
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
          cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
          fields: 'userEnteredFormat.textFormat',
        },
      },
      // Freeze header row
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      // Auto-resize all columns
      {
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 4 },
        },
      },
      // Yes/No dropdown on the action column (col D, index 3) for all data rows
      ...(totalRows > 1 ? [{
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 3, endColumnIndex: 4 },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [{ userEnteredValue: 'Yes' }, { userEnteredValue: 'No' }],
            },
            showCustomUi: true,
            strict: true,
          },
        },
      }] : []),
      // Conditional formatting: Yes = green, No = light red
      ...(totalRows > 1 ? [
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 3, endColumnIndex: 4 }],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Yes' }] },
                format: { backgroundColor: { red: 0.71, green: 0.90, blue: 0.71 } },
              },
            },
            index: 0,
          },
        },
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 3, endColumnIndex: 4 }],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'No' }] },
                format: { backgroundColor: { red: 0.96, green: 0.80, blue: 0.80 } },
              },
            },
            index: 1,
          },
        },
      ] : []),
    ],
  })
}

// ── Playground Sheet ─────────────────────────────────────────────────────────
// A separate editable sheet for the whole team to work in freely.
// Anyone with the link can edit. Changes here never touch Firestore.

const PLAYGROUND_KEY = 'placementos_playground_id'

export async function pushPlayground(token, students) {
  const active = students.filter(s => !s._placed)
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  const HEADERS = [
    'Roll No.', 'Full Name', 'Gender', 'Category', 'CAT %ile', 'CAT Score',
    'Work Ex (mo)', 'UG Degree', 'UG Specialization', 'UG College', 'UG %',
    'XII %', 'X %', 'PWD', 'Personal Email', 'Mobile (WhatsApp)',
    'Company 1', 'C1 Domain', 'C1 Months',
    'Company 2', 'C2 Domain', 'C2 Months',
    'Languages', 'Achievement', 'Position of Responsibility',
    'Last Pushed',
  ]

  const rows = active.map(s => [
    s['Roll No.']                                           || '',
    fullName(s),
    s['Gender']                                            || '',
    s['Category']                                          || '',
    s['CAT Percentile']                                    || '',
    s['CAT Score']                                         || '',
    s['Total Work Experience (in months)']                 || '',
    s['UG Degree (Eg: Btech, BBA, B.com, etc.)']          || '',
    s['UG Specialization']                                 || '',
    s['UG College Name']                                   || '',
    s['Graduation Overall Score in %age']                  || '',
    s['Class XII Score in percentage:']                    || '',
    s['Class X Score in percentage:']                      || '',
    s['PWD Status']                                        || '',
    s['Personal Email ID']                                 || '',
    s['Mobile Number (Whatsapp)']                          || '',
    s['Name of Company (C1)']                              || '',
    s['C1 Work Experience Domain']                         || '',
    s['C1 Work Experience (in months)']                    || '',
    s['Name of Company (C2)']                              || '',
    s['Work Experience Domain (C2)']                       || '',
    s['Work Experience in months (C2)']                    || '',
    s['Languages Known (Write all seperated by comma)']    || '',
    s['One Major Achievement']                             || '',
    s['Past Position of Responsibility']                   || '',
    ts,
  ])

  // Reuse existing playground sheet or create a new one
  let sheetId = localStorage.getItem(PLAYGROUND_KEY)
  let isNew = false

  if (sheetId) {
    try {
      await api('GET', `${BASE}/${sheetId}?fields=spreadsheetId`, token)
    } catch {
      sheetId = null // deleted — create fresh
    }
  }

  if (!sheetId) {
    const sheet = await api('POST', BASE, token, {
      properties: { title: '📋 PlacementOS Playground — IIFT Batch 2027' },
      sheets: [{ properties: { sheetId: 0, index: 0, title: 'Active Roster' } }],
    })
    sheetId = sheet.spreadsheetId
    isNew = true

    // Share with anyone who has the link (edit access)
    await fetch(`${DRIVE}/${sheetId}/permissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'writer', type: 'anyone' }),
    })

    localStorage.setItem(PLAYGROUND_KEY, sheetId)
  }

  // Overwrite Active Roster tab
  await clearRange(token, sheetId, 'Active Roster!A:Z')
  await writeRange(token, sheetId, 'Active Roster!A1', [HEADERS, ...rows])

  return {
    sheetId,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
    count: active.length,
    isNew,
  }
}
