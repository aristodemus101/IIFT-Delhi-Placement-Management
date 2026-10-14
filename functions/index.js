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

// Atomically increment usage counters, including nested day-bucket counters
// like phoneByDay.<day>. update() interprets a key containing "." as a nested
// field path (set() does not), so the day buckets increment reliably instead
// of creating a literal dotted field name. Falls back to creating the doc on
// the first-ever write (when update() fails because the doc doesn't exist).
// `increments` is a flat map of dottedFieldPath → number.
async function bumpUsage(db, increments) {
  const ref = db.doc(USAGE_DOC)
  const data = { lastUpdated: FieldValue.serverTimestamp() }
  for (const [path, n] of Object.entries(increments)) {
    data[path] = FieldValue.increment(n)
  }
  try {
    await ref.update(data)
  } catch (e) {
    // Doc doesn't exist yet → create it. Expand dotted paths into a nested
    // object so the initial structure is correct.
    const seed = { lastUpdated: FieldValue.serverTimestamp() }
    for (const [path, n] of Object.entries(increments)) {
      const segs = path.split('.')
      let node = seed
      for (let i = 0; i < segs.length - 1; i++) {
        node[segs[i]] = node[segs[i]] || {}
        node = node[segs[i]]
      }
      node[segs[segs.length - 1]] = n
    }
    await ref.set(seed, { merge: true })
  }
}

// YYYY-MM-DD in Asia/Kolkata — the key for the daily phone budget.
function todayKeyIST() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return parts // en-CA gives YYYY-MM-DD
}

// resolveCompany lives in apolloLimits.js (pure + unit-tested); aliased here.
const resolveCompany = limits.resolveCompany

// Server-side authorization for enrichContacts (the money-spending action).
// Mirrors the client's usePermissions logic so a Team Access grant actually
// takes effect: admin always allowed; otherwise the role must appear in the
// /config/actionAccess override for 'enrichContacts' if one exists, else in the
// hardcoded default. This is what lets you grant TPOs access via the toggle
// (and lets you revoke it) without ever editing/redeploying this function.
const ENRICH_DEFAULT_ROLES = ['admin', 'committee']

async function assertEnrichRole(auth) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in')
  const db = getFirestore()
  const roleSnap = await db.doc(`roles/${auth.uid}`).get()
  const role = roleSnap.exists ? roleSnap.data()?.role : null
  if (!role) throw new HttpsError('permission-denied', 'No role assigned')
  if (role === 'admin') return // admin is always allowed

  let allowed = ENRICH_DEFAULT_ROLES
  try {
    const cfg = await db.doc('config/actionAccess').get()
    const override = cfg.exists ? cfg.data()?.enrichContacts : null
    if (Array.isArray(override)) allowed = override
  } catch (_) { /* fall back to defaults on config read failure */ }

  if (!allowed.includes(role)) {
    throw new HttpsError('permission-denied', 'You do not have permission to enrich contacts.')
  }
}

// Count Apollo calls in the trailing hour from the usage ledger.
async function callsInLastHour(db) {
  const cutoff = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000)
  const snap = await db.collection('apolloCallLog').where('at', '>=', cutoff).count().get()
  return snap.data().count
}

// target: { kind: 'url', value } or { kind: 'id', value } — people/match
// accepts either a LinkedIn URL or an Apollo person id.
async function callApolloMatch(apiKey, target, wantPhone, webhookUrl) {
  const body = target.kind === 'id' ? { id: target.value } : { linkedin_url: target.value }
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

    const { urls, apolloIds, wantPhone } = request.data || {}
    const urlArr = Array.isArray(urls) ? urls : []
    const idArr = Array.isArray(apolloIds) ? apolloIds.map(x => String(x || '').trim()).filter(Boolean) : []
    if (urlArr.length === 0 && idArr.length === 0) {
      throw new HttpsError('invalid-argument', 'Provide urls or apolloIds to enrich.')
    }

    // 1. Build the unified target list.
    //    - URLs: validated + de-duped by normalized URL.
    //    - Apollo ids (from people search): de-duped as-is.
    const { valid, invalid, duplicates } = limits.dedupeAndValidate(urlArr)
    const seenIds = new Set()
    const idTargets = []
    for (const id of idArr) { if (!seenIds.has(id)) { seenIds.add(id); idTargets.push({ kind: 'id', value: id }) } }
    const urlTargets = valid.map(v => ({ kind: 'url', value: v.original, normalized: v.normalized }))
    const allTargets = [...idTargets, ...urlTargets]

    const perCall = limits.checkPerCallCaps(allTargets.length, !!wantPhone)
    if (!perCall.ok) throw new HttpsError('failed-precondition', perCall.error)

    // 2. Skip anyone already enriched (never pay twice).
    //    URL targets dedup by linkedinUrlNormalized; id targets by apolloId.
    const toEnrich = []
    const skipped = []
    for (const t of allTargets) {
      const q = t.kind === 'id'
        ? db.collection(OUTREACH_COLLECTION).where('apolloId', '==', t.value).limit(1)
        : db.collection(OUTREACH_COLLECTION).where('linkedinUrlNormalized', '==', t.normalized).limit(1)
      const existing = await q.get()
      if (!existing.empty) {
        const data = existing.docs[0].data()
        const needsPhone = wantPhone && !data.phone && data.phoneStatus !== 'pending'
        if (needsPhone) {
          toEnrich.push({ ...t, existingId: existing.docs[0].id })
        } else {
          skipped.push(t.value)
        }
      } else {
        toEnrich.push(t)
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
      const t = toEnrich[i]
      const thisWantsPhone = wantPhone && phoneRequested < allowedPhone
      const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}_${i}`
      const webhookUrl = `${FUNCTIONS_BASE_URL}/apolloPhoneWebhook?token=${encodeURIComponent(webhookToken)}&rid=${encodeURIComponent(requestId)}`

      // Log the Apollo call for the hourly-rate ledger (count-based).
      await db.collection('apolloCallLog').add({ at: FieldValue.serverTimestamp(), by: enrichedBy.uid })

      let data
      try {
        data = await callApolloMatch(apiKey, t, thisWantsPhone, webhookUrl)
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

      const company = resolveCompany(person)
      const title = limits.cleanTitle(person, company)
      // Prefer the real LinkedIn URL from the enrichment result; fall back to
      // the input URL for url-targets. Store the normalized form for dedup.
      const resolvedUrl = person.linkedin_url || (t.kind === 'url' ? t.value : '')
      const resolvedNormalized = resolvedUrl
        ? limits.normalizeLinkedinUrl(resolvedUrl)
        : (t.kind === 'url' ? t.normalized : '')

      const docData = {
        linkedinUrl: resolvedUrl,
        linkedinUrlNormalized: resolvedNormalized,
        apolloId: person.id || (t.kind === 'id' ? t.value : ''),
        name: person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || '',
        title,
        company,
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

      if (t.existingId) {
        // Existing email-only record getting a phone request — update in place.
        await db.collection(OUTREACH_COLLECTION).doc(t.existingId).set(
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

    // 5. Update usage counters (email = 1 credit each enriched; phone credits
    //    counted on delivery via the webhook, not here).
    const dayKey = todayKeyIST()
    await bumpUsage(db, {
      emailCreditsLifetime: enriched,
      [`phoneRequestedByDay.${dayKey}`]: phoneRequested,
    })

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

// People Search: find people by criteria (title + company), no credits spent.
// Returns masked results (name/title/company/linkedin/location only — email &
// phone come back masked from Apollo and are NOT returned to the client). The
// user then picks whom to reveal via enrichContacts (which spends credits).
// Gated by the same enrichContacts permission (per the chosen access model).
//
// Apollo API notes (verified against docs.apollo.io):
//  - People search endpoint: POST /mixed_people/api_search
//  - Company search endpoint: POST /mixed_companies/search
//  - ALL params go in the QUERY STRING, not a JSON body.
//  - There is NO free-text company-NAME filter on people search. Company must
//    be an org ID (organization_ids[]) or domain (q_organization_domains_list[]).
//    So when a company name is given, we first resolve it to an org id via the
//    company-search endpoint, then filter people by that id.
const APOLLO_PEOPLE_SEARCH_URL   = 'https://api.apollo.io/api/v1/mixed_people/api_search'
const APOLLO_COMPANY_SEARCH_URL  = 'https://api.apollo.io/api/v1/mixed_companies/search'
const SEARCH_MAX_PER_PAGE = 25

// apolloQuery (repeated array keys: key[]=a&key[]=b) lives in apolloLimits.js
// (pure + unit-tested); aliased here.
const apolloQuery = limits.apolloQuery

async function apolloPost(baseUrl, params, apiKey) {
  const url = `${baseUrl}?${apolloQuery(params)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
  })
  return res
}

async function readApolloError(res) {
  try {
    const b = await res.json()
    return b?.error || b?.message || (Array.isArray(b?.errors) ? b.errors.join('; ') : '') || JSON.stringify(b).slice(0, 300)
  } catch (_) {
    try { return (await res.text()).slice(0, 300) } catch (_) { return '' }
  }
}

exports.searchPeople = onCall(
  { region: 'asia-south1', invoker: 'public', cors: ALLOWED_ORIGINS, secrets: [APOLLO_API_KEY] },
  async (request) => {
    await assertEnrichRole(request.auth) // same permission as fetch, per design
    const db = getFirestore()
    const auditBy = { uid: request.auth.uid, email: request.auth.token?.email || '' }

    const { titles, company, page } = request.data || {}
    const titleList = Array.isArray(titles)
      ? titles.map(t => String(t || '').trim()).filter(Boolean)
      : (typeof titles === 'string' && titles.trim() ? [titles.trim()] : [])
    const companyStr = typeof company === 'string' ? company.trim() : ''
    const pageNum = Number.isInteger(page) && page > 0 ? Math.min(page, 500) : 1

    if (titleList.length === 0 && !companyStr) {
      throw new HttpsError('invalid-argument', 'Provide a job title and/or a company to search.')
    }

    const apiKey = APOLLO_API_KEY.value()

    const fail = async (status, detail, sent) => {
      await db.collection('auditLog').add({
        type: 'apollo_search', status: 'error', by: auditBy, at: FieldValue.serverTimestamp(),
        detail: `status=${status} body=${detail} sent=${JSON.stringify(sent)}`,
      }).catch(() => {})
      if (status === 401 || status === 403) throw new HttpsError('internal', 'Apollo API key was rejected. Contact an admin.')
      if (status === 429) throw new HttpsError('resource-exhausted', 'Apollo rate limit (429). Try again shortly.')
      throw new HttpsError('internal', `Apollo search error (${status})${detail ? `: ${detail}` : ''}`)
    }

    // ── Step 1: resolve the company name → org id(s), if a company was given ──
    let organizationIds = []
    if (companyStr) {
      const coParams = { q_organization_name: companyStr, page: 1, per_page: 5 }
      let coRes
      try { coRes = await apolloPost(APOLLO_COMPANY_SEARCH_URL, coParams, apiKey) }
      catch (_) { throw new HttpsError('internal', 'Could not reach Apollo company search.') }
      if (!coRes.ok) await fail(coRes.status, await readApolloError(coRes), coParams)
      const coData = await coRes.json()
      const orgs = Array.isArray(coData?.organizations) ? coData.organizations : []
      organizationIds = orgs.map(o => o.id).filter(Boolean).slice(0, 5)
      if (organizationIds.length === 0) {
        // No matching company — return an empty, clearly-explained result.
        await db.collection('auditLog').add({
          type: 'apollo_search', status: 'no_company', by: auditBy, at: FieldValue.serverTimestamp(),
          detail: `company=${JSON.stringify(companyStr)} matched no organization`,
        }).catch(() => {})
        return { results: [], page: 1, totalPages: 1, totalEntries: 0, note: `No company matching "${companyStr}" was found in Apollo.` }
      }
    }

    // ── Step 2: people search by title + resolved org id(s) ──────────────────
    const peopleParams = { page: pageNum, per_page: SEARCH_MAX_PER_PAGE }
    if (titleList.length) peopleParams.person_titles = titleList
    if (organizationIds.length) peopleParams.organization_ids = organizationIds

    let res
    try { res = await apolloPost(APOLLO_PEOPLE_SEARCH_URL, peopleParams, apiKey) }
    catch (_) { throw new HttpsError('internal', 'Could not reach Apollo people search.') }
    if (!res.ok) await fail(res.status, await readApolloError(res), peopleParams)

    const data = await res.json()
    const people = Array.isArray(data?.people) ? data.people : []
    const pagination = data?.pagination || {}

    // api_search returns MASKED results: first_name + last_name_obfuscated,
    // title, organization.name — NO full last name, LinkedIn URL, email, or
    // phone (those unlock only on enrichment). Each result carries an Apollo
    // person `id`, which enrichContacts uses to reveal the real details.
    // We return only these display-safe fields; nothing sensitive leaks.
    const results = people.map(p => {
      const maskedLast = p.last_name_obfuscated || ''
      const displayName = [p.first_name, maskedLast].filter(Boolean).join(' ') || p.name || 'Unknown'
      return {
        apolloId: p.id || '',
        name: displayName,
        title: p.title || '',
        company: p.organization?.name || limits.resolveCompany(p),
        hasEmail: !!p.has_email,
        hasPhone: p.has_direct_phone === 'Yes' || p.has_direct_phone === true,
      }
    }).filter(r => r.apolloId) // only results we can later enrich by id

    await db.collection('auditLog').add({
      type: 'apollo_search', status: 'completed', by: auditBy, at: FieldValue.serverTimestamp(),
      detail: `titles=${JSON.stringify(titleList)} company=${JSON.stringify(companyStr)} orgIds=${organizationIds.length} page=${pageNum} results=${results.length}`,
    })

    return {
      results,
      page: pageNum,
      totalPages: pagination.total_pages || 1,
      totalEntries: pagination.total_entries || results.length,
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
        await bumpUsage(db, {
          phoneCreditsLifetime: 8,
          [`phoneByDay.${dayKey}`]: 1,
        })
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
