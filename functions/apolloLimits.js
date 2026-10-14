// Pure, testable logic for Apollo enrichment caps and de-duplication.
// No Firestore/network here — keeps the money-critical limits unit-testable.

const MAX_PEOPLE_PER_CALL = 50
const MAX_PHONE_REVEALS_PER_CALL = 25
const MAX_APOLLO_CALLS_PER_HOUR = 600
const DEFAULT_DAILY_PHONE_BUDGET = 250 // account-wide, across all users

// Normalise a LinkedIn URL for de-duplication: lowercase, strip protocol,
// strip trailing slash, strip query/hash, strip leading www.
function normalizeLinkedinUrl(url) {
  if (!url) return ''
  let s = String(url).trim().toLowerCase()
  if (!s) return ''
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '')
  s = s.split('?')[0].split('#')[0]
  s = s.replace(/\/+$/, '')
  return s
}

function looksLikeLinkedinUrl(url) {
  const n = normalizeLinkedinUrl(url)
  return /^([a-z]{2,3}\.)?linkedin\.com\/in\/[^/]+/.test(n)
}

// Given raw submitted URLs, return the de-duplicated, valid list plus a report.
// Order of first occurrence is preserved.
function dedupeAndValidate(rawUrls) {
  const seen = new Set()
  const valid = []
  const invalid = []
  const duplicates = []

  for (const raw of (rawUrls || [])) {
    const trimmed = String(raw || '').trim()
    if (!trimmed) continue
    if (!looksLikeLinkedinUrl(trimmed)) { invalid.push(trimmed); continue }
    const key = normalizeLinkedinUrl(trimmed)
    if (seen.has(key)) { duplicates.push(trimmed); continue }
    seen.add(key)
    valid.push({ original: trimmed, normalized: key })
  }

  return { valid, invalid, duplicates }
}

// Validate a submission against per-call caps. Returns { ok, error } — never throws.
// wantPhone: whether the caller asked to also reveal phone numbers.
function checkPerCallCaps(validCount, wantPhone) {
  if (validCount === 0) {
    return { ok: false, error: 'No valid LinkedIn URLs to enrich.' }
  }
  if (validCount > MAX_PEOPLE_PER_CALL) {
    return { ok: false, error: `Too many people in one call: ${validCount} (max ${MAX_PEOPLE_PER_CALL}).` }
  }
  if (wantPhone && validCount > MAX_PHONE_REVEALS_PER_CALL) {
    return { ok: false, error: `Too many phone reveals in one call: ${validCount} (max ${MAX_PHONE_REVEALS_PER_CALL}). Submit fewer, or enrich email-only.` }
  }
  return { ok: true }
}

// Check the account-wide daily phone budget. usedToday + requested must not
// exceed the budget. Returns { ok, allowedPhone, error }.
// allowedPhone = how many phone reveals are still permitted this call.
function checkDailyPhoneBudget(usedToday, requestedPhone, dailyBudget = DEFAULT_DAILY_PHONE_BUDGET) {
  const remaining = Math.max(0, dailyBudget - (usedToday || 0))
  if (requestedPhone <= remaining) {
    return { ok: true, allowedPhone: requestedPhone }
  }
  if (remaining === 0) {
    return { ok: false, allowedPhone: 0, error: `Daily phone-reveal budget exhausted (${dailyBudget}/day, account-wide). Try again tomorrow or enrich email-only.` }
  }
  return {
    ok: false,
    allowedPhone: remaining,
    error: `Daily phone-reveal budget nearly exhausted: only ${remaining} of ${dailyBudget} left today. Submit ${remaining} or fewer phone reveals, or enrich email-only.`,
  }
}

// Rolling hourly Apollo call-rate check. callsLastHour is derived from the
// audit/usage log. Returns { ok, error }.
function checkHourlyRate(callsLastHour, requestedCalls) {
  if ((callsLastHour || 0) + requestedCalls > MAX_APOLLO_CALLS_PER_HOUR) {
    const remaining = Math.max(0, MAX_APOLLO_CALLS_PER_HOUR - (callsLastHour || 0))
    return { ok: false, error: `Apollo hourly rate limit reached: ${remaining} calls left this hour (max ${MAX_APOLLO_CALLS_PER_HOUR}/hr). Wait and retry.` }
  }
  return { ok: true }
}

// Worst-case credit estimate for a confirmation dialog.
// 1 credit per matched person (email), +8 per delivered phone.
function estimateCredits(peopleCount, phoneCount) {
  return { email: peopleCount, phoneWorstCase: phoneCount * 8, totalWorstCase: peopleCount + phoneCount * 8 }
}

// Resolve the employer name from an Apollo person. Apollo places the company in
// different fields depending on plan/match, so try each known location in order
// of preference (current organisation → account → current employment history →
// any bare organization_name → the company half of a "Title @ Company" title).
// Company is the key outreach field — populate it whenever Apollo returns it
// anywhere, including embedded in the title string.
function resolveCompany(person) {
  if (!person) return ''
  if (person.organization?.name) return person.organization.name
  if (person.account?.name) return person.account.name
  const hist = Array.isArray(person.employment_history) ? person.employment_history : []
  const current = hist.find(h => h && h.current) || hist[0]
  if (current?.organization_name) return current.organization_name
  if (person.organization_name) return person.organization_name
  // Last resort: Apollo sometimes only surfaces the employer inside the headline
  // title, e.g. "Assistant General Manager - HR @ Hero Future Energies".
  const title = person.title || person.headline || ''
  const at = title.lastIndexOf(' @ ')
  if (at !== -1) {
    const tail = title.slice(at + 3).trim()
    if (tail) return tail
  }
  return ''
}

// Build an Apollo query string. Array values become repeated key[]=v pairs
// (Apollo's required form); empty/nullish values are skipped. Apollo's search
// endpoints take all params in the query string, not a JSON body.
function apolloQuery(params) {
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(params || {})) {
    if (val === undefined || val === null || val === '') continue
    if (Array.isArray(val)) {
      for (const v of val) { if (v !== undefined && v !== null && v !== '') qs.append(`${key}[]`, v) }
    } else {
      qs.append(key, val)
    }
  }
  return qs.toString()
}

// If resolveCompany pulled the company out of the "Title @ Company" headline,
// strip that trailing "@ Company" from the title so the card doesn't show the
// company twice (once on the title line, once on the company line).
function cleanTitle(person, resolvedCompany) {
  const title = person?.title || ''
  if (!title || !resolvedCompany) return title
  const suffix = ` @ ${resolvedCompany}`
  if (title.endsWith(suffix)) return title.slice(0, title.length - suffix.length).trim()
  return title
}

module.exports = {
  MAX_PEOPLE_PER_CALL,
  MAX_PHONE_REVEALS_PER_CALL,
  MAX_APOLLO_CALLS_PER_HOUR,
  DEFAULT_DAILY_PHONE_BUDGET,
  normalizeLinkedinUrl,
  looksLikeLinkedinUrl,
  dedupeAndValidate,
  checkPerCallCaps,
  checkDailyPhoneBudget,
  checkHourlyRate,
  estimateCredits,
  resolveCompany,
  cleanTitle,
  apolloQuery,
}
