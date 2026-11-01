// Pure aggregation helpers for the Outreach tallies and Excel export.
// No React/Firestore — takes the plain contacts array, returns plain data.

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
