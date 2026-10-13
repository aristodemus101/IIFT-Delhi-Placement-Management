const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret }                  = require('firebase-functions/params')
const { initializeApp }                 = require('firebase-admin/app')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const limits = require('./apolloLimits')

initializeApp()

// Secrets — set via `firebase functions:secrets:set <NAME>`. Injected into the
// function runtime only; never present in the client, Firestore, or git.
const APOLLO_API_KEY       = defineSecret('APOLLO_API_KEY')
const APOLLO_WEBHOOK_TOKEN = defineSecret('APOLLO_WEBHOOK_TOKEN')

// Public base URL of the deployed functions (for building the phone webhook_url).
// asia-south1 Gen-2 functions are served at:
//   https://<region>-<project>.cloudfunctions.net/<fn>
const FUNCTIONS_BASE_URL = 'https://asia-south1-placement-management-6133f.cloudfunctions.net'

// Per-year playground sheet IDs (service account must have editor access on each)
const PLAYGROUND_SHEET_IDS = {
  '27': '1vItl6Nbb7_zQNzuXTgooGYXC1ir---msiUf5E-Rkx94',
  '28': '145E7AxnihIY4KuHfpuLJG2Z0km64oRWk',
}
const DEFAULT_SHEET_ID = PLAYGROUND_SHEET_IDS['27']

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
async function sheetsRequest(token, sheetId, method, path, body) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`
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

  const { rows, headers, label, yearCode } = request.data
  if (!Array.isArray(rows) || !rows.length)       throw new HttpsError('invalid-argument', 'No rows provided')
  if (!Array.isArray(headers) || !headers.length) throw new HttpsError('invalid-argument', 'No headers provided')

  // Resolve which sheet to write to based on year code (e.g. '27', '28')
  const spreadsheetId = (yearCode && PLAYGROUND_SHEET_IDS[yearCode]) || DEFAULT_SHEET_ID

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
    const addRes = await sheetsRequest(token, spreadsheetId, 'POST', ':batchUpdate', {
      requests: [{ addSheet: { properties: { title: tabName } } }]
    })
    newSheetId = addRes.replies[0].addSheet.properties.sheetId
  } catch (e) {
    throw new HttpsError('internal', 'Failed to create tab: ' + e.message)
  }

  // Write data
  try {
    await sheetsRequest(token, spreadsheetId, 'PUT',
      `/values/'${tabName}'!A1?valueInputOption=USER_ENTERED`,
      { values: [headers, ...rows] }
    )
  } catch (e) {
    throw new HttpsError('internal', 'Failed to write data: ' + e.message)
  }

  // Style header row
  try {
    await sheetsRequest(token, spreadsheetId, 'POST', ':batchUpdate', {
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
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${newSheetId}`,
    rowCount: rows.length,
    yearCode: yearCode || '27',
  }
})


// ═══════════════════════════════════════════════════════════════════════════
//  Apollo LinkedIn → contact enrichment
//  - enrichContacts: onCall, admin|committee, spends Apollo credits (guarded)
//  - apolloPhoneWebhook: public onRequest, receives async phone numbers
// ═══════════════════════════════════════════════════════════════════════════

const APOLLO_MATCH_URL = 'https://api.apollo.io/api/v1/people/match'
const OUTREACH_COLLECTION = 'outreachContacts'
const USAGE_DOC = 'config/apolloUsage'

// YYYY-MM-DD in Asia/Kolkata — the key for the daily phone budget.
function todayKeyIST() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return parts // en-CA gives YYYY-MM-DD
}

async function assertEnrichRole(auth) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in')
  const snap = await getFirestore().doc(`roles/${auth.uid}`).get()
  if (!snap.exists || !['admin', 'committee'].includes(snap.data()?.role)) {
    throw new HttpsError('permission-denied', 'Admin or committee access required')
  }
}

// Count Apollo calls in the trailing hour from the usage ledger.
async function callsInLastHour(db) {
  const cutoff = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000)
  const snap = await db.collection('apolloCallLog').where('at', '>=', cutoff).count().get()
  return snap.data().count
}

async function callApolloMatch(apiKey, linkedinUrl, wantPhone, webhookUrl) {
  const body = { linkedin_url: linkedinUrl }
  if (wantPhone) {
    body.reveal_phone_number = true
    body.webhook_url = webhookUrl
  }
  const res = await fetch(APOLLO_MATCH_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401 || res.status === 403) {
    throw new HttpsError('internal', 'APOLLO_AUTH') // bad key — caller maps to admin alert
  }
  if (res.status === 429) {
    throw new HttpsError('resource-exhausted', 'Apollo rate limit (429). Try again later.')
  }
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Apollo ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

exports.enrichContacts = onCall(
  { region: 'asia-south1', invoker: 'public', cors: ALLOWED_ORIGINS, secrets: [APOLLO_API_KEY, APOLLO_WEBHOOK_TOKEN] },
  async (request) => {
    await assertEnrichRole(request.auth)
    const db = getFirestore()

    const { urls, wantPhone } = request.data || {}
    if (!Array.isArray(urls)) throw new HttpsError('invalid-argument', 'urls must be an array')

    // 1. De-dupe + validate.
    const { valid, invalid, duplicates } = limits.dedupeAndValidate(urls)
    const perCall = limits.checkPerCallCaps(valid.length, !!wantPhone)
    if (!perCall.ok) throw new HttpsError('failed-precondition', perCall.error)

    // 2. Skip anyone already enriched (never pay twice). Look up by normalized URL.
    const toEnrich = []
    const skipped = []
    for (const v of valid) {
      const existing = await db.collection(OUTREACH_COLLECTION)
        .where('linkedinUrlNormalized', '==', v.normalized).limit(1).get()
      if (!existing.empty) {
        const data = existing.docs[0].data()
        // Re-request phone only if wanted, missing, and not already in flight.
        const needsPhone = wantPhone && !data.phone && data.phoneStatus !== 'pending'
        if (needsPhone) {
          toEnrich.push({ ...v, existingId: existing.docs[0].id, emailOnlyAlready: true })
        } else {
          skipped.push(v.original)
        }
      } else {
        toEnrich.push(v)
      }
    }

    if (toEnrich.length === 0) {
      return { enriched: 0, skipped: skipped.length, invalid, duplicates, message: 'All submitted contacts are already enriched.' }
    }

    // 3. Rolling hourly Apollo-call cap.
    const callsLastHour = await callsInLastHour(db)
    const hourly = limits.checkHourlyRate(callsLastHour, toEnrich.length)
    if (!hourly.ok) throw new HttpsError('resource-exhausted', hourly.error)

    // 4. Account-wide daily phone budget. Count BOTH already-delivered phones
    //    (phoneByDay) AND still-in-flight requests (phoneRequestedByDay) — a
    //    burst of concurrent requests must not each pass the check before any
    //    webhook lands. Requested-but-undelivered is reconciled: when a webhook
    //    resolves it moves from "requested" to "delivered", so we don't want to
    //    double-count. We take the max of (requested, delivered) per day as the
    //    conservative "committed" figure.
    let allowedPhone = 0
    if (wantPhone) {
      const dayKey = todayKeyIST()
      const usageSnap = await db.doc(USAGE_DOC).get()
      const u = usageSnap.exists ? usageSnap.data() : {}
      const delivered = u?.phoneByDay?.[dayKey] || 0
      const requested = u?.phoneRequestedByDay?.[dayKey] || 0
      const committed = Math.max(delivered, requested)
      const budget = limits.checkDailyPhoneBudget(committed, toEnrich.length, limits.DEFAULT_DAILY_PHONE_BUDGET)
      if (!budget.ok && budget.allowedPhone === 0) throw new HttpsError('resource-exhausted', budget.error)
      allowedPhone = budget.allowedPhone
    }

    const apiKey = APOLLO_API_KEY.value()
    const webhookToken = APOLLO_WEBHOOK_TOKEN.value()
    const enrichedBy = { uid: request.auth.uid, email: request.auth.token?.email || '' }

    let enriched = 0, notFound = 0, errors = 0, phoneRequested = 0
    const cards = []

    for (let i = 0; i < toEnrich.length; i++) {
      const v = toEnrich[i]
      const thisWantsPhone = wantPhone && phoneRequested < allowedPhone
      const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}_${i}`
      const webhookUrl = `${FUNCTIONS_BASE_URL}/apolloPhoneWebhook?token=${encodeURIComponent(webhookToken)}&rid=${encodeURIComponent(requestId)}`

      // Log the Apollo call for the hourly-rate ledger (count-based).
      await db.collection('apolloCallLog').add({ at: FieldValue.serverTimestamp(), by: enrichedBy.uid })

      let data
      try {
        data = await callApolloMatch(apiKey, v.original, thisWantsPhone, webhookUrl)
      } catch (err) {
        if (err instanceof HttpsError && err.message === 'APOLLO_AUTH') {
          await db.collection('auditLog').add({
            type: 'apollo_enrich', status: 'auth_error', by: enrichedBy, at: FieldValue.serverTimestamp(),
            detail: 'Apollo rejected the API key (401/403).',
          })
          throw new HttpsError('internal', 'Apollo API key was rejected. Contact an admin to check the key.')
        }
        errors++
        continue
      }

      const person = data?.person
      const confidence = person?.match_confidence || 'none'
      if (!person || confidence === 'none') { notFound++; continue }

      const email = person.email || ''
      // Phone comes async via webhook; mark pending if we requested it.
      const phoneStatus = thisWantsPhone ? 'pending' : 'not_requested'
      if (thisWantsPhone) phoneRequested++

      const docData = {
        linkedinUrl: v.original,
        linkedinUrlNormalized: v.normalized,
        name: person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || '',
        title: person.title || '',
        company: person.organization?.name || person.account?.name || '',
        email,
        phone: '',
        phoneStatus,
        requestId: String(requestId), // stored as string — Apollo request ids exceed JS safe-int range
        location: [person.city, person.state, person.country].filter(Boolean).join(', '),
        matchConfidence: confidence,
        enrichedBy,
        enrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }

      if (v.existingId) {
        // Existing email-only record getting a phone request — update in place.
        await db.collection(OUTREACH_COLLECTION).doc(v.existingId).set(
          { phoneStatus, requestId: String(requestId), updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        )
      } else {
        await db.collection(OUTREACH_COLLECTION).add(docData)
      }

      enriched++
      cards.push({
        linkedinUrl: docData.linkedinUrl, name: docData.name, title: docData.title,
        company: docData.company, email: docData.email, phoneStatus,
        location: docData.location, matchConfidence: confidence,
      })
    }

    // 5. Update usage counters (email = 1 credit each enriched; phone counted on delivery via webhook).
    const dayKey = todayKeyIST()
    await db.doc(USAGE_DOC).set({
      emailCreditsLifetime: FieldValue.increment(enriched),
      phoneRequestedByDay: { [dayKey]: FieldValue.increment(phoneRequested) },
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true })

    await db.collection('auditLog').add({
      type: 'apollo_enrich', status: 'completed', by: enrichedBy, at: FieldValue.serverTimestamp(),
      detail: `enriched=${enriched} phoneRequested=${phoneRequested} notFound=${notFound} errors=${errors} skipped=${skipped.length}`,
    })

    return {
      enriched, notFound, errors,
      skipped: skipped.length,
      phoneRequested,
      invalid, duplicates,
      cards,
    }
  }
)

// Public webhook: Apollo POSTs revealed phone numbers here minutes later.
// NOT a Firebase-authenticated caller — guarded by a secret token in the query.
// Writes via Admin SDK (bypasses Firestore rules, which is correct here).
exports.apolloPhoneWebhook = onRequest(
  { region: 'asia-south1', invoker: 'public', secrets: [APOLLO_WEBHOOK_TOKEN] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return }

    // 1. Verify the secret token — reject anything without the exact match.
    const token = req.query.token
    if (!token || token !== APOLLO_WEBHOOK_TOKEN.value()) {
      res.status(403).send('Forbidden')
      return
    }

    const rid = req.query.rid ? String(req.query.rid) : ''
    const db = getFirestore()

    try {
      // Extract phone from the payload defensively (Apollo's shape varies).
      const body = req.body || {}
      const person = body.person || body.people?.[0] || body
      const phone = person?.phone_numbers?.[0]?.sanitized_number
        || person?.sanitized_phone
        || person?.phone
        || ''

      // 2. Find the target contact by requestId (stored as string).
      let targetRef = null
      if (rid) {
        const q = await db.collection(OUTREACH_COLLECTION).where('requestId', '==', rid).limit(1).get()
        if (!q.empty) targetRef = q.docs[0].ref
      }
      if (!targetRef) {
        // Nothing to update (already processed, or unknown rid) — ack anyway so Apollo stops retrying.
        res.status(200).send('ok')
        return
      }

      const doc = await targetRef.get()
      const data = doc.data() || {}

      // 3. Idempotency — if already resolved, ack without double-counting credits.
      if (data.phoneStatus === 'done') { res.status(200).send('ok'); return }

      if (phone) {
        await targetRef.set({ phone, phoneStatus: 'done', updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        // Phone delivered → +8 credits; count against the day's budget ledger.
        const dayKey = todayKeyIST()
        await db.doc(USAGE_DOC).set({
          phoneCreditsLifetime: FieldValue.increment(8),
          phoneByDay: { [dayKey]: FieldValue.increment(1) },
          lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true })
      } else {
        // Apollo had no mobile on file for this person.
        await targetRef.set({ phoneStatus: 'none', updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      }

      res.status(200).send('ok')
    } catch (err) {
      // Ack with 200 even on internal error — Apollo retries indefinitely on non-2xx,
      // and our idempotency guard already prevents double-processing. Log for debugging.
      await db.collection('auditLog').add({
        type: 'apollo_webhook', status: 'error', at: FieldValue.serverTimestamp(),
        detail: String(err && err.message || err).slice(0, 300),
      }).catch(() => {})
      res.status(200).send('ok')
    }
  }
)
