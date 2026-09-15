// Pure helpers for the Roster "Candidate Profile PDF" feature.
// Groups the currently-visible columns into sections and formats values —
// no DOM/React here so the grouping logic is unit-testable in isolation.

// Ordered section buckets. A column is placed in the first bucket whose
// pattern matches its label; anything unmatched falls into 'Other'.
const SECTION_RULES = [
  { key: 'identity',    title: 'Identity',            pattern: /roll|course|programme|program|batch|cohort|category|gender|pwd|date of birth|^dob$|^age$/i },
  { key: 'contact',     title: 'Contact',              pattern: /email|mobile|phone|address|pincode|state\b/i },
  { key: 'family',      title: 'Family',               pattern: /father|mother|guardian/i },
  { key: 'academics',   title: 'Academic Record',      pattern: /x10|x12|10th|12th|class 10|class 12|\bug\b|undergrad|\bpg1?\b|postgrad|cat percentile|cat score|scorecard/i },
  { key: 'experience',  title: 'Work Experience',      pattern: /intern|c1_|c2_|c3_|company name \(c|work.?ex|\bwx\b|designation|sector|domain/i },
  { key: 'achievements',title: 'Achievements & Skills',pattern: /achievement|certification|cert_|por|position of responsibility|language|state.?natl/i },
  { key: 'placement',   title: 'Placement',            pattern: /sip|placement|placed|package|stipend|ctc/i },
]

const OTHER_SECTION = { key: 'other', title: 'Additional Details' }

// value formatting: trims, treats a small set of placeholder tokens as empty
const EMPTY_TOKENS = new Set(['', 'na', 'n/a', 'nil', 'none', '-', '--', '0', 'null', 'undefined'])

export function isMeaningfulValue(v) {
  if (v === null || v === undefined) return false
  const s = String(v).trim()
  if (!s) return false
  return !EMPTY_TOKENS.has(s.toLowerCase())
}

// columnDefs: [{ key, label }], getValue: (student, key) => any
// excludeKeys: column keys to omit entirely (e.g. the name column, already
// shown prominently in the profile header — repeating it in the body reads
// as a bug, not a feature).
// Returns: [{ key, title, fields: [{ label, value }] }] — only sections with
// at least one meaningful field are included; empty fields are dropped.
export function groupColumnsForProfile(columnDefs, student, getValue, excludeKeys = new Set()) {
  const buckets = new Map(SECTION_RULES.map(r => [r.key, { key: r.key, title: r.title, fields: [] }]))
  buckets.set(OTHER_SECTION.key, { key: OTHER_SECTION.key, title: OTHER_SECTION.title, fields: [] })

  for (const col of columnDefs) {
    if (excludeKeys.has(col.key)) continue
    const raw = getValue(student, col.key)
    if (!isMeaningfulValue(raw)) continue

    const rule = SECTION_RULES.find(r => r.pattern.test(col.label) || r.pattern.test(col.key))
    const bucket = buckets.get(rule ? rule.key : OTHER_SECTION.key)
    bucket.fields.push({ label: col.label, value: String(raw).trim() })
  }

  const order = [...SECTION_RULES.map(r => r.key), OTHER_SECTION.key]
  return order.map(k => buckets.get(k)).filter(section => section.fields.length > 0)
}

// Best-effort display name for the profile header — falls back through
// common label variants since uploaded cohorts don't always share headers.
// Returns { value, columnKey } so callers can exclude this column from the
// body grid (columnKey is null when no matching column was found).
export function resolveDisplayName(columnDefs, student, getValue) {
  const nameCol = columnDefs.find(c => /^full name$|^name$/i.test(c.label)) || columnDefs.find(c => /name/i.test(c.label) && !/father|mother|college|school|university|company|file/i.test(c.label))
  if (nameCol) {
    const v = getValue(student, nameCol.key)
    if (isMeaningfulValue(v)) return { value: String(v).trim(), columnKey: nameCol.key }
  }
  return { value: 'Unnamed Candidate', columnKey: null }
}

export function resolveRoll(columnDefs, student, getValue) {
  const rollCol = columnDefs.find(c => /roll/i.test(c.label))
  if (rollCol) {
    const v = getValue(student, rollCol.key)
    if (isMeaningfulValue(v)) return String(v).trim()
  }
  return ''
}

// Placement badges shown in the profile header strip.
export function resolvePlacementBadges(student) {
  const badges = []
  if (student?._placed_summer && student?._placement_summer?.company) {
    badges.push({ label: 'SIP', company: student._placement_summer.company, role: student._placement_summer.role || '' })
  }
  if (student?._placed_final && student?._placement_final?.company) {
    badges.push({ label: 'Final', company: student._placement_final.company, role: student._placement_final.role || '' })
  }
  return badges
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Builds the full print document's inner HTML (one .profile-page per student).
// columnDefs / getValue mirror RosterPage's visibleDefs + getCellValue.
export function buildProfilesHtml({ students, columnDefs, getValue, institute = 'IIFT Delhi', batchLabel = '' }) {
  const generatedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const pages = students.map(student => {
    const { value: nameValue, columnKey: nameColumnKey } = resolveDisplayName(columnDefs, student, getValue)
    const name = escapeHtml(nameValue)
    const roll = escapeHtml(resolveRoll(columnDefs, student, getValue))
    const excludeKeys = nameColumnKey ? new Set([nameColumnKey]) : new Set()
    const sections = groupColumnsForProfile(columnDefs, student, getValue, excludeKeys)
    const badges = resolvePlacementBadges(student)

    const badgeHtml = badges.map(b =>
      `<span class="profile-badge profile-badge--${b.label.toLowerCase()}">${escapeHtml(b.label)} · ${escapeHtml(b.company)}${b.role ? ' — ' + escapeHtml(b.role) : ''}</span>`
    ).join('')

    const sectionsHtml = sections.map(section => `
      <section class="profile-section">
        <h3 class="profile-section-title">${escapeHtml(section.title)}</h3>
        <div class="profile-grid">
          ${section.fields.map(f => `
            <div class="profile-field">
              <div class="profile-field-label">${escapeHtml(f.label)}</div>
              <div class="profile-field-value">${escapeHtml(f.value)}</div>
            </div>
          `).join('')}
        </div>
      </section>
    `).join('')

    return `
      <article class="profile-page">
        <header class="profile-header">
          <div class="profile-header-top">
            <div class="profile-institute">${escapeHtml(institute)}</div>
            <div class="profile-meta">${escapeHtml(batchLabel)}${batchLabel ? ' · ' : ''}Generated ${generatedOn}</div>
          </div>
          <div class="profile-identity">
            <div class="profile-name">${name}</div>
            ${roll ? `<div class="profile-roll">${roll}</div>` : ''}
          </div>
          ${badgeHtml ? `<div class="profile-badges">${badgeHtml}</div>` : ''}
        </header>
        <div class="profile-body">
          ${sectionsHtml || '<div class="profile-empty">No additional details available in the visible columns.</div>'}
        </div>
        <footer class="profile-footer">Candidate Profile · ${escapeHtml(institute)}</footer>
      </article>
    `
  })

  return pages.join('\n')
}
