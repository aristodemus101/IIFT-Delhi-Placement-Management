// Pure aggregation helpers for the Outreach tallies and Excel export.
// No React/Firestore — takes the plain contacts array, returns plain data.

// Windowed page list for a numbered pager: up to `maxButtons` entries centred
// on `current`, always including page 1 and the last page, with '…' marking
// gaps. e.g. pageWindow(7, 20, 10) → [1,'…',4,5,6,7,8,9,10,'…',20].
export function pageWindow(current, total, maxButtons = 10) {
  if (total <= maxButtons) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set([1, total, current])
  // Fill around the current page until we reach maxButtons (reserving 2 for
  // first/last and up to 2 for ellipses).
  const slots = Math.max(1, maxButtons - 2)
  let left = current - Math.floor((slots - 1) / 2)
  let right = current + Math.ceil((slots - 1) / 2)
  if (left < 1) { right += 1 - left; left = 1 }
  if (right > total) { left -= right - total; right = total }
  left = Math.max(1, left)
  for (let p = left; p <= right; p++) pages.add(p)

  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  // Insert ellipses where there are gaps.
  const out = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}

// Group contacts by company → [{ company, count, contacts }], sorted by count desc.
export function groupByCompany(contacts) {
  const map = new Map()
  for (const c of contacts) {
    const key = (c.company || '').trim() || 'Unknown company'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(c)
  }
  return [...map.entries()]
    .map(([company, list]) => ({ company, count: list.length, contacts: list }))
    .sort((a, b) => b.count - a.count || a.company.localeCompare(b.company))
}

// Per-extractor tally → [{ email, label, count }], sorted by count desc.
// label is the local part of the email (before @) for compact display.
export function tallyByExtractor(contacts) {
  const map = new Map()
  for (const c of contacts) {
    const email = c.enrichedBy?.email || 'unknown'
    map.set(email, (map.get(email) || 0) + 1)
  }
  return [...map.entries()]
    .map(([email, count]) => ({ email, label: email.split('@')[0], count }))
    .sort((a, b) => b.count - a.count || a.email.localeCompare(b.email))
}

// Firestore Timestamp | string | Date → 'YYYY-MM-DD HH:mm' (IST), or ''.
function fmtDate(v) {
  if (!v) return ''
  let d
  if (typeof v.toDate === 'function') d = v.toDate()
  else if (v.seconds) d = new Date(v.seconds * 1000)
  else d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Flatten contacts into export rows (one object per contact, labelled columns).
export function contactsToExportRows(contacts) {
  return contacts.map(c => ({
    'Name': c.name || '',
    'Title': c.title || '',
    'Company': c.company || '',
    'Email': c.email || '',
    'Phone': c.phone || '',
    'Phone Status': c.phoneStatus || '',
    'Location': c.location || '',
    'LinkedIn': c.linkedinUrl || '',
    'Match Confidence': c.matchConfidence || '',
    'Extracted By': c.enrichedBy?.email || '',
    'Extracted At': fmtDate(c.enrichedAt),
  }))
}
