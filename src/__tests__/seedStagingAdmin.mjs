/**
 * Staging seed script — uses firebase-admin with application credentials
 * from the firebase-tools cached token.
 *
 * Run: node src/__tests__/seedStagingAdmin.mjs
 */

import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Read token from firebase-tools config
const configPath = process.env.HOME + '/.config/configstore/firebase-tools.json'
const fbConfig = JSON.parse(readFileSync(configPath, 'utf8'))
const accessToken = fbConfig.tokens?.access_token
const refreshToken = fbConfig.tokens?.refresh_token

if (!accessToken) {
  console.error('No Firebase access token found. Run: firebase login')
  process.exit(1)
}

// Use credential with the cached OAuth token
import { GoogleAuth } from 'google-auth-library'

const auth = new GoogleAuth({
  credentials: {
    type: 'authorized_user',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8EvSGooMkN9T5NqNo',
    refresh_token: refreshToken,
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore'],
})

const tokenResponse = await auth.getAccessToken()
const token = tokenResponse.token

const PROJECT_ID = 'placement-mgmt-staging'
const COHORT_ID = '27-Delhi-IB'

async function firestoreRequest(method, path, body) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Firestore ${method} ${path}: ${res.status} ${err}`)
  }
  return res.json()
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') {
    const fields = {}
    for (const [k, val] of Object.entries(v)) {
      fields[k] = toFirestoreValue(val)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function toFirestoreDoc(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_serverTimestamp') {
      fields[k] = { timestampValue: new Date().toISOString() }
    } else {
      fields[k] = toFirestoreValue(v)
    }
  }
  return { fields }
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

const STUDENTS_SEED = [
  {
    'Full Name': 'Aarav Mehta',
    'Roll No.': 'D27001',
    'Official Email ID (d27/ba27)': 'aarav_d27@iift.edu',
    'Personal Email ID': 'aarav@gmail.com',
    'Gender': 'Male',
    'Category': 'General',
    'CAT Percentile': '99.5',
    'CAT Score': '174',
    'Date of Birth': 'Aug 12, 2001',
    'Domicile State': 'Delhi',
    'Total Work Experience (in months)': '0',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech',
    'UG Specialization': 'Computer Science',
    'UG College Name': 'IIT Bombay',
    'Graduation Overall Score in %age': '9.2',
    'Class X Score in percentage:': '95.4',
    'Class XII Score in percentage:': '94.2',
    'SIP Status': 'Placed',
    'SIP Company': 'Boston Consulting Group',
    'SIP Role': 'Business Analyst Intern',
    'SIP Company Sector': 'Consulting & Professional Services',
    'SIP Company Domain': '',
    'SIP Roles and Responsibilities': 'Go-to-market strategy project',
    'Location': 'Domestic',
    'DOP': 'Feb 21, 2025',
    'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: {
      date: '2025-02-21',
      company: 'Boston Consulting Group',
      role: 'Business Analyst Intern',
      domain: '',
      sector: 'Consulting & Professional Services',
      location: 'Domestic',
      package: '75000',
      ctcNotes: '',
      via: 'Campus Placement',
      finalStatus: '',
      placedAtIso: '2025-02-21T00:00:00.000Z',
    },
    _placed_final: true,
    _placement_final: {
      date: '2025-12-10',
      company: 'McKinsey & Company',
      role: 'Business Analyst',
      domain: 'Finance',
      sector: 'Consulting & Professional Services',
      location: 'Domestic',
      package: '3250000',
      ctcNotes: 'Fixed: 28L, Variable: 4.5L',
      via: 'Summer PPO',
      finalStatus: 'PPO',
      placedAtIso: '2025-12-10T00:00:00.000Z',
    },
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Priya Sharma',
    'Roll No.': 'D27002',
    'Official Email ID (d27/ba27)': 'priya_d27@iift.edu',
    'Personal Email ID': 'priya@gmail.com',
    'Gender': 'Female',
    'Category': 'OBC',
    'CAT Percentile': '98.2',
    'CAT Score': '162',
    'Date of Birth': 'Aug 15, 2001',
    'Domicile State': 'Maharashtra',
    'Total Work Experience (in months)': '12',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BBA',
    'UG Specialization': 'Finance',
    'UG College Name': 'Symbiosis',
    'Graduation Overall Score in %age': '8.8',
    'Class X Score in percentage:': '92.0',
    'Class XII Score in percentage:': '89.5',
    'SIP Status': 'Placed',
    'SIP Company': 'Deloitte',
    'SIP Role': 'Strategy Analyst Intern',
    'SIP Company Sector': 'Consulting & Professional Services',
    'SIP Company Domain': '',
    'SIP Roles and Responsibilities': 'Digital transformation roadmap',
    'Location': 'Domestic',
    'DOP': 'Feb 15, 2025',
    'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: {
      date: '2025-02-15',
      company: 'Deloitte',
      role: 'Strategy Analyst Intern',
      domain: '',
      sector: 'Consulting & Professional Services',
      location: 'Domestic',
      package: '60000',
      ctcNotes: '',
      via: 'Campus Placement',
      finalStatus: '',
      placedAtIso: '2025-02-15T00:00:00.000Z',
    },
    _placed_final: true,
    _placement_final: {
      date: '2025-12-05',
      company: 'KPMG India',
      role: 'Associate Consultant',
      domain: 'Operations',
      sector: 'Consulting & Professional Services',
      location: 'Domestic',
      package: '2200000',
      ctcNotes: '',
      via: 'Finals Cycle',
      finalStatus: 'Convert',
      placedAtIso: '2025-12-05T00:00:00.000Z',
    },
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Rohan Gupta',
    'Roll No.': 'D27003',
    'Official Email ID (d27/ba27)': 'rohan_d27@iift.edu',
    'Personal Email ID': 'rohan@gmail.com',
    'Gender': 'Male',
    'Category': 'General',
    'CAT Percentile': '97.5',
    'CAT Score': '155',
    'Date of Birth': 'Nov 20, 2000',
    'Domicile State': 'Gujarat',
    'Total Work Experience (in months)': '24',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech',
    'UG Specialization': 'Mechanical',
    'UG College Name': 'NIT Surat',
    'Graduation Overall Score in %age': '7.9',
    'Class X Score in percentage:': '90.0',
    'Class XII Score in percentage:': '88.0',
    'SIP Status': 'Placed',
    'SIP Company': 'ITC Limited',
    'SIP Role': 'Sales & Marketing Intern',
    'SIP Company Sector': 'FMCG & Consumer Products',
    'SIP Company Domain': 'FMCG',
    'SIP Roles and Responsibilities': 'Rural distribution network expansion',
    'Location': 'Domestic',
    'DOP': 'Mar 01, 2025',
    'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: {
      date: '2025-03-01',
      company: 'ITC Limited',
      role: 'Sales & Marketing Intern',
      domain: 'FMCG',
      sector: 'FMCG & Consumer Products',
      location: 'Domestic',
      package: '50000',
      ctcNotes: '',
      via: 'Campus Placement',
      finalStatus: '',
      placedAtIso: '2025-03-01T00:00:00.000Z',
    },
    _placed_final: true,
    _placement_final: {
      date: '2025-11-28',
      company: 'HUL',
      role: 'Area Sales Manager',
      domain: 'Sales',
      sector: 'FMCG & Consumer Products',
      location: 'Domestic',
      package: '1850000',
      ctcNotes: 'Fixed 14L + Variable 4.5L',
      via: 'Finals Cycle',
      finalStatus: 'Direct',
      placedAtIso: '2025-11-28T00:00:00.000Z',
    },
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Ananya Krishnan',
    'Roll No.': 'D27004',
    'Official Email ID (d27/ba27)': 'ananya_d27@iift.edu',
    'Personal Email ID': 'ananya@gmail.com',
    'Gender': 'Female',
    'Category': 'SC',
    'CAT Percentile': '95.1',
    'CAT Score': '142',
    'Date of Birth': 'Feb 08, 2001',
    'Domicile State': 'Tamil Nadu',
    'Total Work Experience (in months)': '36',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BCom',
    'UG Specialization': 'Accounting',
    'UG College Name': 'Christ University',
    'Graduation Overall Score in %age': '8.5',
    'Class X Score in percentage:': '93.0',
    'Class XII Score in percentage:': '91.4',
    'SIP Status': 'Placed',
    'SIP Company': 'Goldman Sachs',
    'SIP Role': 'Financial Analyst Intern',
    'SIP Company Sector': 'Banking & Financial Services',
    'SIP Company Domain': 'Investment Banking',
    'SIP Roles and Responsibilities': 'Equity research report',
    'Location': 'Domestic',
    'DOP': 'Feb 10, 2025',
    'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: {
      date: '2025-02-10',
      company: 'Goldman Sachs',
      role: 'Financial Analyst Intern',
      domain: 'Investment Banking',
      sector: 'Banking & Financial Services',
      location: 'Domestic',
      package: '90000',
      ctcNotes: '',
      via: 'Campus Placement',
      finalStatus: '',
      placedAtIso: '2025-02-10T00:00:00.000Z',
    },
    _placed_final: false,
    _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Vikram Singh',
    'Roll No.': 'D27005',
    'Official Email ID (d27/ba27)': 'vikram_d27@iift.edu',
    'Personal Email ID': 'vikram@gmail.com',
    'Gender': 'Male',
    'Category': 'General',
    'CAT Percentile': '99.1',
    'CAT Score': '170',
    'Date of Birth': 'Jul 22, 2001',
    'Domicile State': 'Punjab',
    'Total Work Experience (in months)': '48',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech',
    'UG Specialization': 'Electronics',
    'UG College Name': 'IIT Delhi',
    'Graduation Overall Score in %age': '9.5',
    'Class X Score in percentage:': '97.0',
    'Class XII Score in percentage:': '96.2',
    'SIP Status': 'Placed',
    'SIP Company': 'McKinsey & Company',
    'SIP Role': 'Business Analyst Intern',
    'SIP Company Sector': 'Consulting & Professional Services',
    'SIP Company Domain': '',
    'SIP Roles and Responsibilities': 'Cost reduction initiative',
    'Location': 'International',
    'DOP': 'Jan 30, 2025',
    'Placed Via': 'Campus Placement',
    cohort: COHORT_ID,
    _placed_summer: true,
    _placement_summer: {
      date: '2025-01-30',
      company: 'McKinsey & Company',
      role: 'Business Analyst Intern',
      domain: 'Strategy',
      sector: 'Consulting & Professional Services',
      location: 'International',
      package: '150000',
      ctcNotes: '',
      via: 'Campus Placement',
      finalStatus: '',
      placedAtIso: '2025-01-30T00:00:00.000Z',
    },
    _placed_final: false,
    _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Nisha Patel',
    'Roll No.': 'D27006',
    'Official Email ID (d27/ba27)': 'nisha_d27@iift.edu',
    'Personal Email ID': 'nisha@gmail.com',
    'Gender': 'Female',
    'Category': 'General',
    'CAT Percentile': '94.5',
    'CAT Score': '138',
    'Date of Birth': 'Sep 14, 2001',
    'Domicile State': 'Rajasthan',
    'Total Work Experience (in months)': '0',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BA',
    'UG Specialization': 'Economics',
    'UG College Name': 'Delhi University',
    'Graduation Overall Score in %age': '8.0',
    'Class X Score in percentage:': '88.0',
    'Class XII Score in percentage:': '85.5',
    'SIP Status': 'Not Placed',
    'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '',
    cohort: COHORT_ID,
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Arjun Kapoor',
    'Roll No.': 'D27007',
    'Official Email ID (d27/ba27)': 'arjun_d27@iift.edu',
    'Personal Email ID': 'arjun@gmail.com',
    'Gender': 'Male',
    'Category': 'OBC',
    'CAT Percentile': '96.8',
    'CAT Score': '150',
    'Date of Birth': 'Apr 18, 2000',
    'Domicile State': 'UP',
    'Total Work Experience (in months)': '18',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech',
    'UG Specialization': 'Civil',
    'UG College Name': 'BITS Pilani',
    'Graduation Overall Score in %age': '8.3',
    'Class X Score in percentage:': '91.0',
    'Class XII Score in percentage:': '90.0',
    'SIP Status': 'Not Placed',
    'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '',
    cohort: COHORT_ID,
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Meera Joshi',
    'Roll No.': 'D27008',
    'Official Email ID (d27/ba27)': 'meera_d27@iift.edu',
    'Personal Email ID': 'meera@gmail.com',
    'Gender': 'Female',
    'Category': 'General',
    'CAT Percentile': '97.9',
    'CAT Score': '158',
    'Date of Birth': 'Jan 25, 2001',
    'Domicile State': 'Karnataka',
    'Total Work Experience (in months)': '0',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech',
    'UG Specialization': 'Information Technology',
    'UG College Name': 'PESIT Bangalore',
    'Graduation Overall Score in %age': '9.0',
    'Class X Score in percentage:': '94.0',
    'Class XII Score in percentage:': '93.0',
    'SIP Status': 'Not Placed',
    'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '',
    cohort: COHORT_ID,
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Rahul Desai',
    'Roll No.': 'D27009',
    'Official Email ID (d27/ba27)': 'rahul_d27@iift.edu',
    'Personal Email ID': 'rahul@gmail.com',
    'Gender': 'Male',
    'Category': 'ST',
    'CAT Percentile': '92.4',
    'CAT Score': '130',
    'Date of Birth': 'Dec 03, 2001',
    'Domicile State': 'Maharashtra',
    'Total Work Experience (in months)': '60',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BCom',
    'UG Specialization': 'Finance',
    'UG College Name': 'Pune University',
    'Graduation Overall Score in %age': '7.5',
    'Class X Score in percentage:': '82.5',
    'Class XII Score in percentage:': '80.0',
    'SIP Status': 'Not Placed',
    'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '',
    cohort: COHORT_ID,
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
  {
    'Full Name': 'Sanya Malhotra',
    'Roll No.': 'D27010',
    'Official Email ID (d27/ba27)': 'sanya_d27@iift.edu',
    'Personal Email ID': 'sanya@gmail.com',
    'Gender': 'Female',
    'Category': 'General',
    'CAT Percentile': '99.0',
    'CAT Score': '168',
    'Date of Birth': 'Jun 30, 2001',
    'Domicile State': 'Haryana',
    'Total Work Experience (in months)': '12',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'BTech',
    'UG Specialization': 'Chemical Engineering',
    'UG College Name': 'IIT Roorkee',
    'Graduation Overall Score in %age': '8.9',
    'Class X Score in percentage:': '96.0',
    'Class XII Score in percentage:': '95.0',
    'SIP Status': 'Not Placed',
    'SIP Company': '', 'SIP Role': '', 'SIP Company Sector': '', 'SIP Company Domain': '',
    'SIP Roles and Responsibilities': '', 'Location': '', 'DOP': '', 'Placed Via': '',
    cohort: COHORT_ID,
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
    _createdAt: new Date().toISOString(),
  },
]

async function writeDoc(collectionPath, docId, data) {
  const doc = toFirestoreDoc(data)
  return firestoreRequest('PATCH', `/${collectionPath}/${docId}?updateMask.fieldPaths=${Object.keys(data).join('&updateMask.fieldPaths=')}`, doc)
}

async function addDoc(collectionPath, data) {
  const doc = toFirestoreDoc(data)
  return firestoreRequest('POST', `/${collectionPath}`, doc)
}

async function seed() {
  console.log(`\nSeeding staging — project: ${PROJECT_ID}`)
  console.log(`Cohort: ${COHORT_ID}\n`)

  // 1. Batch doc
  await writeDoc('batches', COHORT_ID, {
    id: COHORT_ID,
    label: '27 Delhi IB',
    year: 2027,
    campus: 'Delhi',
    programme: 'IB',
    activeCycle: 'final',
    status: 'active',
    createdAt: new Date().toISOString(),
  })
  console.log('✓ Batch doc:', COHORT_ID)

  // 2. Schema doc
  await writeDoc('config', `columnSchema_${COHORT_ID}`, {
    headers: SCHEMA_HEADERS,
    updatedAt: new Date().toISOString(),
    updatedBy: 'seed-script',
    source: 'seed',
  })
  console.log('✓ Schema doc:', `columnSchema_${COHORT_ID}`, `(${SCHEMA_HEADERS.length} headers)`)

  // 3. Students
  for (const s of STUDENTS_SEED) {
    await addDoc('students', s)
    process.stdout.write('.')
  }
  console.log(`\n✓ ${STUDENTS_SEED.length} students seeded`)

  const ps = STUDENTS_SEED.filter(s => s._placed_summer).length
  const pf = STUDENTS_SEED.filter(s => s._placed_final).length
  console.log(`\nSummary: ${STUDENTS_SEED.length} total | ${ps} summer placed | ${pf} final placed | ${STUDENTS_SEED.length - Math.max(ps, pf)} YTP`)
  console.log('\nDone! Run: npm run dev → localhost:5173')
}

seed().catch(err => {
  console.error('\nSeed error:', err.message)
  process.exit(1)
})
