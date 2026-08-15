const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp }      = require('firebase-admin/app')
const { getFirestore }       = require('firebase-admin/firestore')

initializeApp()

const SHEET_ID = '1vItl6Nbb7_zQNzuXTgooGYXC1ir---msiUf5E-Rkx94'

// Fetch an access token from the GCE metadata server (works in Cloud Run / Gen 2 functions)
async function getAccessToken() {
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  )
  if (!res.ok) throw new Error(`Metadata server error: ${res.status} ${await res.text()}`)
  const { access_token } = await res.json()
  return access_token
}

// Minimal Sheets API wrapper using plain fetch + access token
async function sheetsRequest(token, method, path, body) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Sheets API ${method} ${path} → ${res.status}: ${JSON.stringify(data.error || data)}`)
  return data
}

async function assertAdmin(auth) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in')
  const snap = await getFirestore().doc(`roles/${auth.uid}`).get()
  if (!snap.exists || !['admin', 'committee'].includes(snap.data()?.role)) {
    throw new HttpsError('permission-denied', 'Admin access required')
  }
}

const ALLOWED_ORIGINS = [
  'https://iiftd-pc.web.app',
  'https://iiftd-pc.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

exports.pushFilteredToSheet = onCall({ region: 'asia-south1', invoker: 'public', cors: ALLOWED_ORIGINS }, async (request) => {
  await assertAdmin(request.auth)

  const { rows, headers, label } = request.data
  if (!Array.isArray(rows) || !rows.length)       throw new HttpsError('invalid-argument', 'No rows provided')
  if (!Array.isArray(headers) || !headers.length) throw new HttpsError('invalid-argument', 'No headers provided')

  const now      = new Date()
  const timePart = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')
  const tabName  = `${label} ${timePart}`.slice(0, 100)

  let token
  try {
    token = await getAccessToken()
  } catch (e) {
    throw new HttpsError('internal', 'Could not get access token: ' + e.message)
  }

  // Create new tab
  let newSheetId
  try {
    const addRes = await sheetsRequest(token, 'POST', ':batchUpdate', {
      requests: [{ addSheet: { properties: { title: tabName } } }]
    })
    newSheetId = addRes.replies[0].addSheet.properties.sheetId
  } catch (e) {
    throw new HttpsError('internal', 'Failed to create tab: ' + e.message)
  }

  // Write data
  try {
    await sheetsRequest(token, 'PUT',
      `/values/'${tabName}'!A1?valueInputOption=USER_ENTERED`,
      { values: [headers, ...rows] }
    )
  } catch (e) {
    throw new HttpsError('internal', 'Failed to write data: ' + e.message)
  }

  // Style header row
  try {
    await sheetsRequest(token, 'POST', ':batchUpdate', {
      requests: [
        {
          repeatCell: {
            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.18, green: 0.35, blue: 0.64 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: newSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: headers.length },
          },
        },
      ],
    })
  } catch (_) {
    // Styling failure is non-fatal
  }

  return {
    tabName,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${newSheetId}`,
    rowCount: rows.length,
  }
})
