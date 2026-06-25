/**
 * Seed staging via Firestore REST API using the current firebase CLI access token.
 * Run: node src/__tests__/seedRest.mjs
 */

import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const PROJECT_ID = 'placement-mgmt-staging'
const COHORT_ID = '27-Delhi-IB'
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// Get a fresh token via firebase CLI
let token
try {
  token = execSync('firebase auth:print-access-token --project placement-mgmt-staging 2>/dev/null', { encoding: 'utf8' }).trim()
} catch (_) {
  // Fallback: read from configstore
  const cfg = JSON.parse(readFileSync(process.env.HOME + '/.config/configstore/firebase-tools.json', 'utf8'))
  token = cfg.tokens?.access_token
}

if (!token || token.startsWith('Error')) {
  console.error('Could not get Firebase token. Run: firebase login')
  process.exit(1)
}

console.log('Token obtained, first 20 chars:', token.slice(0, 20) + '...')

function toFV(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (Array.isArray(v))             return { arrayValue: { values: v.map(toFV) } }
  if (typeof v === 'object')        {
    const fields = {}
    for (const [k, val] of Object.entries(v)) fields[k] = toFV(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function toDoc(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) fields[k] = toFV(v)
  return { fields }
}

async function req(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

const SCHEMA_HEADERS = [
  'Full Name', 'Roll No.', 'Official Email ID (d27/ba27)', 'Personal Email ID',
  'Gender', 'Category', 'CAT Percentile', 'CAT Score',
  'Date of Birth', 'Domicile State',
  'Total Work Experience (in months)',
  'UG Degree (Eg: Btech, BBA, B.com, etc.)', 'UG Specialization', 'UG College Name',
  'Graduation Overall Score in %age',
  'Class X Score in percentage:', 'Class XII Score in percentage:',
  'SIP Status', 'SIP Company', 'SIP Role',
  'SIP Company Sector', 'SIP Company Domain',
  'SIP Roles and Responsibilities', 'Location', 'DOP', 'Placed Via',
]

const STUDENTS = [
  {
    'Full Name': 'Aarav Mehta', 'Roll No.': 'D27001',
    'Official Email ID (d27/ba27)': 'aarav_d27@iift.edu',
    'Personal Email ID': 'aarav@gmail.com',
    'Gender': 'Male', 'Category': 'General',
    'CAT Percentile': '99.5', 'CAT Score': '174',
    'Date of Birth': 'Aug 12, 2001', 'Domicile State': 'Delhi',
    'Total Work Experience (in months)': '0',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech', 'UG Specialization': 'Computer Science',
    'UG College Name': 'IIT Bombay', 'Graduation Overall Score in %age': '9.2',
    'Class X Score in percentage:': '95.4', 'Class XII Score in percentage:': '94.2',
    'SIP Status': 'Placed', 'SIP Company': 'Boston Consulting Group',
    'SIP Role': 'Business Analyst Intern',
    'SIP Company Sector': 'Consulting & Professional Services', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': 'Go-to-market strategy project',
    'Location': 'Domestic', 'DOP': 'Feb 21, 2025', 'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: { date: '2025-02-21', company: 'Boston Consulting Group', role: 'Business Analyst Intern', domain: '', sector: 'Consulting & Professional Services', location: 'Domestic', package: '75000', ctcNotes: '', via: 'Campus Placement', finalStatus: '', placedAtIso: '2025-02-21T00:00:00.000Z' },
    _placed_final: true,
    _placement_final: { date: '2025-12-10', company: 'McKinsey & Company', role: 'Business Analyst', domain: 'Finance', sector: 'Consulting & Professional Services', location: 'Domestic', package: '3250000', ctcNotes: 'Fixed 28L + Variable 4.5L', via: 'Summer PPO', finalStatus: 'PPO', placedAtIso: '2025-12-10T00:00:00.000Z' },
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Priya Sharma', 'Roll No.': 'D27002',
    'Official Email ID (d27/ba27)': 'priya_d27@iift.edu',
    'Personal Email ID': 'priya@gmail.com',
    'Gender': 'Female', 'Category': 'OBC',
    'CAT Percentile': '98.2', 'CAT Score': '162',
    'Date of Birth': 'Aug 15, 2001', 'Domicile State': 'Maharashtra',
    'Total Work Experience (in months)': '12',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BBA', 'UG Specialization': 'Finance',
    'UG College Name': 'Symbiosis', 'Graduation Overall Score in %age': '8.8',
    'Class X Score in percentage:': '92.0', 'Class XII Score in percentage:': '89.5',
    'SIP Status': 'Placed', 'SIP Company': 'Deloitte',
    'SIP Role': 'Strategy Analyst Intern',
    'SIP Company Sector': 'Consulting & Professional Services', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': 'Digital transformation roadmap',
    'Location': 'Domestic', 'DOP': 'Feb 15, 2025', 'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: { date: '2025-02-15', company: 'Deloitte', role: 'Strategy Analyst Intern', domain: '', sector: 'Consulting & Professional Services', location: 'Domestic', package: '60000', ctcNotes: '', via: 'Campus Placement', finalStatus: '', placedAtIso: '2025-02-15T00:00:00.000Z' },
    _placed_final: true,
    _placement_final: { date: '2025-12-05', company: 'KPMG India', role: 'Associate Consultant', domain: 'Operations', sector: 'Consulting & Professional Services', location: 'Domestic', package: '2200000', ctcNotes: '', via: 'Finals Cycle', finalStatus: 'Convert', placedAtIso: '2025-12-05T00:00:00.000Z' },
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Rohan Gupta', 'Roll No.': 'D27003',
    'Official Email ID (d27/ba27)': 'rohan_d27@iift.edu',
    'Personal Email ID': 'rohan@gmail.com',
    'Gender': 'Male', 'Category': 'General',
    'CAT Percentile': '97.5', 'CAT Score': '155',
    'Date of Birth': 'Nov 20, 2000', 'Domicile State': 'Gujarat',
    'Total Work Experience (in months)': '24',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech', 'UG Specialization': 'Mechanical',
    'UG College Name': 'NIT Surat', 'Graduation Overall Score in %age': '7.9',
    'Class X Score in percentage:': '90.0', 'Class XII Score in percentage:': '88.0',
    'SIP Status': 'Placed', 'SIP Company': 'ITC Limited',
    'SIP Role': 'Sales & Marketing Intern',
    'SIP Company Sector': 'FMCG & Consumer Products', 'SIP Company Domain': 'FMCG',
    'SIP Roles and Responsibilities': 'Rural distribution network expansion',
    'Location': 'Domestic', 'DOP': 'Mar 01, 2025', 'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: { date: '2025-03-01', company: 'ITC Limited', role: 'Sales & Marketing Intern', domain: 'FMCG', sector: 'FMCG & Consumer Products', location: 'Domestic', package: '50000', ctcNotes: '', via: 'Campus Placement', finalStatus: '', placedAtIso: '2025-03-01T00:00:00.000Z' },
    _placed_final: true,
    _placement_final: { date: '2025-11-28', company: 'HUL', role: 'Area Sales Manager', domain: 'Sales', sector: 'FMCG & Consumer Products', location: 'Domestic', package: '1850000', ctcNotes: 'Fixed 14L + Variable 4.5L', via: 'Finals Cycle', finalStatus: 'Direct', placedAtIso: '2025-11-28T00:00:00.000Z' },
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Ananya Krishnan', 'Roll No.': 'D27004',
    'Official Email ID (d27/ba27)': 'ananya_d27@iift.edu',
    'Personal Email ID': 'ananya@gmail.com',
    'Gender': 'Female', 'Category': 'SC',
    'CAT Percentile': '95.1', 'CAT Score': '142',
    'Date of Birth': 'Feb 08, 2001', 'Domicile State': 'Tamil Nadu',
    'Total Work Experience (in months)': '36',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BCom', 'UG Specialization': 'Accounting',
    'UG College Name': 'Christ University', 'Graduation Overall Score in %age': '8.5',
    'Class X Score in percentage:': '93.0', 'Class XII Score in percentage:': '91.4',
    'SIP Status': 'Placed', 'SIP Company': 'Goldman Sachs',
    'SIP Role': 'Financial Analyst Intern',
    'SIP Company Sector': 'Banking & Financial Services', 'SIP Company Domain': 'Investment Banking',
    'SIP Roles and Responsibilities': 'Equity research report',
    'Location': 'Domestic', 'DOP': 'Feb 10, 2025', 'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: { date: '2025-02-10', company: 'Goldman Sachs', role: 'Financial Analyst Intern', domain: 'Investment Banking', sector: 'Banking & Financial Services', location: 'Domestic', package: '90000', ctcNotes: '', via: 'Campus Placement', finalStatus: '', placedAtIso: '2025-02-10T00:00:00.000Z' },
    _placed_final: false,
    _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Vikram Singh', 'Roll No.': 'D27005',
    'Official Email ID (d27/ba27)': 'vikram_d27@iift.edu',
    'Personal Email ID': 'vikram@gmail.com',
    'Gender': 'Male', 'Category': 'General',
    'CAT Percentile': '99.1', 'CAT Score': '170',
    'Date of Birth': 'Jul 22, 2001', 'Domicile State': 'Punjab',
    'Total Work Experience (in months)': '48',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech', 'UG Specialization': 'Electronics',
    'UG College Name': 'IIT Delhi', 'Graduation Overall Score in %age': '9.5',
    'Class X Score in percentage:': '97.0', 'Class XII Score in percentage:': '96.2',
    'SIP Status': 'Placed', 'SIP Company': 'McKinsey & Company',
    'SIP Role': 'Business Analyst Intern',
    'SIP Company Sector': 'Consulting & Professional Services', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': 'Cost reduction initiative',
    'Location': 'International', 'DOP': 'Jan 30, 2025', 'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: { date: '2025-01-30', company: 'McKinsey & Company', role: 'Business Analyst Intern', domain: 'Strategy', sector: 'Consulting & Professional Services', location: 'International', package: '150000', ctcNotes: '', via: 'Campus Placement', finalStatus: '', placedAtIso: '2025-01-30T00:00:00.000Z' },
    _placed_final: false,
    _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  { 'Full Name': 'Nisha Patel', 'Roll No.': 'D27006', 'Official Email ID (d27/ba27)': 'nisha_d27@iift.edu', 'Personal Email ID': 'nisha@gmail.com', 'Gender': 'Female', 'Category': 'General', 'CAT Percentile': '94.5', 'CAT Score': '138', 'Date of Birth': 'Sep 14, 2001', 'Domicile State': 'Rajasthan', 'Total Work Experience (in months)': '0', 'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BA', 'UG Specialization': 'Economics', 'UG College Name': 'Delhi University', 'Graduation Overall Score in %age': '8.0', 'Class X Score in percentage:': '88.0', 'Class XII Score in percentage:': '85.5', 'SIP Status': 'Not Placed', 'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '', 'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '', cohort: COHORT_ID, _placed_summer: false, _placement_summer: null, _placed_final: false, _placement_final: null, _createdAt: new Date().toISOString() },
  { 'Full Name': 'Arjun Kapoor', 'Roll No.': 'D27007', 'Official Email ID (d27/ba27)': 'arjun_d27@iift.edu', 'Personal Email ID': 'arjun@gmail.com', 'Gender': 'Male', 'Category': 'OBC', 'CAT Percentile': '96.8', 'CAT Score': '150', 'Date of Birth': 'Apr 18, 2000', 'Domicile State': 'UP', 'Total Work Experience (in months)': '18', 'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech', 'UG Specialization': 'Civil', 'UG College Name': 'BITS Pilani', 'Graduation Overall Score in %age': '8.3', 'Class X Score in percentage:': '91.0', 'Class XII Score in percentage:': '90.0', 'SIP Status': 'Not Placed', 'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '', 'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '', cohort: COHORT_ID, _placed_summer: false, _placement_summer: null, _placed_final: false, _placement_final: null, _createdAt: new Date().toISOString() },
  { 'Full Name': 'Meera Joshi', 'Roll No.': 'D27008', 'Official Email ID (d27/ba27)': 'meera_d27@iift.edu', 'Personal Email ID': 'meera@gmail.com', 'Gender': 'Female', 'Category': 'General', 'CAT Percentile': '97.9', 'CAT Score': '158', 'Date of Birth': 'Jan 25, 2001', 'Domicile State': 'Karnataka', 'Total Work Experience (in months)': '0', 'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech', 'UG Specialization': 'Information Technology', 'UG College Name': 'PESIT Bangalore', 'Graduation Overall Score in %age': '9.0', 'Class X Score in percentage:': '94.0', 'Class XII Score in percentage:': '93.0', 'SIP Status': 'Not Placed', 'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '', 'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '', cohort: COHORT_ID, _placed_summer: false, _placement_summer: null, _placed_final: false, _placement_final: null, _createdAt: new Date().toISOString() },
  { 'Full Name': 'Rahul Desai', 'Roll No.': 'D27009', 'Official Email ID (d27/ba27)': 'rahul_d27@iift.edu', 'Personal Email ID': 'rahul@gmail.com', 'Gender': 'Male', 'Category': 'ST', 'CAT Percentile': '92.4', 'CAT Score': '130', 'Date of Birth': 'Dec 03, 2001', 'Domicile State': 'Maharashtra', 'Total Work Experience (in months)': '60', 'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BCom', 'UG Specialization': 'Finance', 'UG College Name': 'Pune University', 'Graduation Overall Score in %age': '7.5', 'Class X Score in percentage:': '82.5', 'Class XII Score in percentage:': '80.0', 'SIP Status': 'Not Placed', 'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '', 'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '', cohort: COHORT_ID, _placed_summer: false, _placement_summer: null, _placed_final: false, _placement_final: null, _createdAt: new Date().toISOString() },
  { 'Full Name': 'Sanya Malhotra', 'Roll No.': 'D27010', 'Official Email ID (d27/ba27)': 'sanya_d27@iift.edu', 'Personal Email ID': 'sanya@gmail.com', 'Gender': 'Female', 'Category': 'General', 'CAT Percentile': '99.0', 'CAT Score': '168', 'Date of Birth': 'Jun 30, 2001', 'Domicile State': 'Haryana', 'Total Work Experience (in months)': '12', 'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech', 'UG Specialization': 'Chemical Engineering', 'UG College Name': 'IIT Roorkee', 'Graduation Overall Score in %age': '8.9', 'Class X Score in percentage:': '96.0', 'Class XII Score in percentage:': '95.0', 'SIP Status': 'Not Placed', 'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '', 'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '', cohort: COHORT_ID, _placed_summer: false, _placement_summer: null, _placed_final: false, _placement_final: null, _createdAt: new Date().toISOString() },
]

async function seed() {
  console.log(`\nSeeding staging — ${PROJECT_ID}`)

  // 1. Batch doc
  await req('PATCH', `/batches/${COHORT_ID}`, toDoc({ id: COHORT_ID, label: '27 Delhi IB', year: 2027, campus: 'Delhi', programme: 'IB', activeCycle: 'final', status: 'active' }))
  console.log('✓ Batch:', COHORT_ID)

  // 2. Schema doc
  await req('PATCH', `/config/columnSchema_${COHORT_ID}`, toDoc({ headers: SCHEMA_HEADERS, source: 'seed', updatedBy: 'seed-script' }))
  console.log('✓ Schema: columnSchema_' + COHORT_ID, `(${SCHEMA_HEADERS.length} cols)`)

  // 3. Students — POST to create docs with auto-generated IDs
  for (const s of STUDENTS) {
    await req('POST', '/students', toDoc(s))
    process.stdout.write('.')
  }

  console.log(`\n✓ ${STUDENTS.length} students seeded`)

  const ps = STUDENTS.filter(s => s._placed_summer).length
  const pf = STUDENTS.filter(s => s._placed_final).length
  console.log(`\n  Summer placed: ${ps} | Final placed: ${pf} | YTP: ${STUDENTS.length - ps}`)

  console.log('\n── What to verify in the UI ─────────────────────')
  console.log('ROSTER (localhost:5173/roster)')
  console.log('  26 columns in schema order (incl. SIP bio, no stipend)')
  console.log('  SIP badge on D27001–D27005 | Final badge on D27001–D27003')
  console.log('  Placement status filter → 3 Final placed, 7 YTP')
  console.log('  Category filter: General/OBC/SC/ST | Gender: Male/Female')
  console.log('\nPLACED TAB (localhost:5173/placed) → Summer')
  console.log('  5 students | Stipend: ₹75000/mo, ₹60000/mo, ₹50000/mo, ₹90000/mo, ₹150000/mo')
  console.log('  McKinsey Vikram → International badge')
  console.log('\nPLACED TAB → Finals')
  console.log('  3 students | CTC: 32.50 LPA, 22.00 LPA, 18.50 LPA')
  console.log('  Aarav: Domain=Finance, Status=PPO')
  console.log('  Priya: Domain=Operations, Status=Convert')
  console.log('  Rohan: Domain=Sales, Status=Direct')
  console.log('\nAPPROVALS (localhost:5173/approvals)')
  console.log('  No pending changes (empty state)')
  console.log('─────────────────────────────────────────────────')
}

seed().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
