// Pure helpers for the Roster "Quick Profile" lookup card.
// Extracts the fixed set of profile fields from a student doc — no DOM/React.

import { getVal } from './columns'
import { parseCohortId, cohortYear } from './batch'

const PROGRAMME_LABEL = { IB: 'MBA (IB)', BA: 'MBA (BA)' }

function clean(v) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  const low = s.toLowerCase()
  if (['na', 'n/a', 'nil', 'none', '-', '--', '0', 'null', 'undefined'].includes(low)) return ''
  return s
}

// Returns a flat, display-ready profile object for one student.
export function buildStudentProfile(student) {
  const cohort = student?.cohort || ''
  const { programme } = parseCohortId(cohort)
  const gradYear = cohortYear(cohort) || ''

  const summerCompany = (student?._placed_summer && student?._placement_summer?.company) || ''
  const finalCompany  = (student?._placed_final  && student?._placement_final?.company)  || ''

  return {
    name:          clean(getVal(student, 'name')),
    roll:          clean(getVal(student, 'roll')),
    officialEmail: clean(getVal(student, 'official_email')),
    mobile:        clean(getVal(student, 'mobile')),
    course:        PROGRAMME_LABEL[programme] || (programme ? `MBA (${programme})` : ''),
    gradYear:      gradYear ? String(gradYear) : '',
    sipCompany:    clean(summerCompany),
    finalCompany:  clean(finalCompany),
    x10:           clean(getVal(student, 'x10pct')),
    x12:           clean(getVal(student, 'x12pct')),
    ug:            clean(getVal(student, 'ugpct')),
    workEx:        clean(getVal(student, 'wx')),
    recentCompany: clean(getVal(student, 'c1_name')),
  }
}

// Clean, labelled, copy-ready text block — only non-empty fields included.
export function profileToText(p, { institute = 'IIFT Delhi' } = {}) {
  const lines = []
  if (p.name) lines.push(p.name + (p.roll ? ` (${p.roll})` : ''))
  const sub = [p.course, p.gradYear && `Class of ${p.gradYear}`].filter(Boolean).join(' · ')
  if (sub) lines.push(sub)
  lines.push('') // blank separator

  const field = (label, val) => { if (val) lines.push(`${label}: ${val}`) }
  field('Official Email', p.officialEmail)
  field('Contact', p.mobile)
  field('Class X', p.x10 ? `${p.x10}%` : '')
  field('Class XII', p.x12 ? `${p.x12}%` : '')
  field('UG', p.ug ? `${p.ug}%` : '')
  field('Work Experience', p.workEx ? `${p.workEx} months` : '')
  field('Most Recent Company', p.recentCompany)
  field('SIP Company', p.sipCompany)
  field('Final Company', p.finalCompany)

  return `${institute} — Candidate Profile\n\n${lines.join('\n')}`.trim()
}
