/**
 * Staging seed script — PlacementOS
 *
 * Seeds the staging Firestore project with:
 * - 1 cohort batch (27-Delhi-IB, activeCycle = final)
 * - 10 student docs (5 with summer placement, 3 with final placement, 2 YTP)
 * - 1 columnSchema doc matching header order
 *
 * Run: node --env-file=.env.local src/__tests__/seedStaging.mjs
 *
 * Requires VITE_FIREBASE_STAGING_* vars OR uses hardcoded staging project config.
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore, collection, doc, setDoc, addDoc,
  serverTimestamp, writeBatch,
} from 'firebase/firestore'

// Staging project config (from firebase.js)
const stagingConfig = {
  apiKey: "AIzaSyDv9EKoHYiYlOmMGlNJELqRW0_eqBsj6KY",
  authDomain: "placement-mgmt-staging.firebaseapp.com",
  projectId: "placement-mgmt-staging",
  storageBucket: "placement-mgmt-staging.appspot.com",
  messagingSenderId: "549870048038",
  appId: "1:549870048038:web:c9e4b01f8ae59cbb5ee4c9"
}

const app = initializeApp(stagingConfig, 'seed')
const db = getFirestore(app)

const COHORT_ID = '27-Delhi-IB'

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
    'Date of Birth': '2001-05-12',
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
    'DOP': '2025-02-21',
    'Placed Via': 'Campus Placement',
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
    'Date of Birth': '2001-08-15',
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
    'DOP': '2025-02-15',
    'Placed Via': 'Campus Placement',
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
    'Date of Birth': '2000-11-20',
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
    'DOP': '2025-03-01',
    'Placed Via': 'Campus Placement',
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
    'Date of Birth': '2001-02-08',
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
    'DOP': '2025-02-10',
    'Placed Via': 'Campus Placement',
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
    'Date of Birth': '2001-07-22',
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
    'DOP': '2025-01-30',
    'Placed Via': 'Campus Placement',
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
  },
  // 5 more students — YTP
  {
    'Full Name': 'Nisha Patel',
    'Roll No.': 'D27006',
    'Official Email ID (d27/ba27)': 'nisha_d27@iift.edu',
    'Personal Email ID': 'nisha@gmail.com',
    'Gender': 'Female',
    'Category': 'General',
    'CAT Percentile': '94.5',
    'CAT Score': '138',
    'Date of Birth': '2001-09-14',
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
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
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
    'Date of Birth': '2000-04-18',
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
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
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
    'Date of Birth': '2001-01-25',
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
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
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
    'Date of Birth': '2001-12-03',
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
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
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
    'Date of Birth': '2001-06-30',
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
    _placed_summer: false, _placement_summer: null,
    _placed_final: false, _placement_final: null,
  },
]

async function seed() {
  console.log(`\nSeeding staging Firestore — project: ${stagingConfig.projectId}`)
  console.log(`Cohort: ${COHORT_ID}\n`)

  // 1. Create cohort batch doc
  await setDoc(doc(db, 'batches', COHORT_ID), {
    id: COHORT_ID,
    label: '27 Delhi IB',
    year: 2027,
    campus: 'Delhi',
    programme: 'IB',
    activeCycle: 'final',
    status: 'active',
    createdAt: serverTimestamp(),
    createdBy: { uid: 'seed-script', name: 'Seed Script' },
  }, { merge: true })
  console.log('✓ Batch doc written:', COHORT_ID)

  // 2. Write column schema (without stipend cols)
  const schemaDocId = `columnSchema_${COHORT_ID}`
  await setDoc(doc(db, 'config', schemaDocId), {
    headers: SCHEMA_HEADERS,
    updatedAt: serverTimestamp(),
    updatedBy: 'seed-script',
    updatedByName: 'Seed Script',
    source: 'seed',
  }, { merge: true })
  console.log('✓ Schema doc written:', schemaDocId, `(${SCHEMA_HEADERS.length} headers)`)

  // 3. Write students in batches of 400 (Firestore batch limit)
  const batch = writeBatch(db)
  STUDENTS_SEED.forEach(studentData => {
    const ref = doc(collection(db, 'students'))
    batch.set(ref, {
      ...studentData,
      cohort: COHORT_ID,
      _createdAt: serverTimestamp(),
    })
  })
  await batch.commit()
  console.log(`✓ ${STUDENTS_SEED.length} student docs written`)

  // Summary
  const placed_summer = STUDENTS_SEED.filter(s => s._placed_summer).length
  const placed_final = STUDENTS_SEED.filter(s => s._placed_final).length
  const ytp = STUDENTS_SEED.filter(s => !s._placed_summer && !s._placed_final).length
  const both = STUDENTS_SEED.filter(s => s._placed_summer && s._placed_final).length

  console.log('\n── Summary ──────────────────────────────────────')
  console.log(`Total students  : ${STUDENTS_SEED.length}`)
  console.log(`Summer placed   : ${placed_summer}`)
  console.log(`Final placed    : ${placed_final}`)
  console.log(`Both seasons    : ${both}`)
  console.log(`YTP (unplaced)  : ${ytp}`)
  console.log('\n── Test cases to verify in the UI ───────────────')
  console.log('ROSTER')
  console.log('  ✓ All 26 schema columns visible (incl. SIP bio cols, excl. stipend)')
  console.log('  ✓ Column order matches SCHEMA_HEADERS order')
  console.log('  ✓ SIP badges show on rows with _placed_summer=true')
  console.log('  ✓ Final badges show on rows with _placed_final=true')
  console.log('  ✓ Filters: Placed/YTP filter (active cycle = final)')
  console.log('  ✓ Category filter shows: General, OBC, SC, ST')
  console.log('  ✓ Gender filter shows: Male, Female')
  console.log('\nPLACED TAB — SUMMER')
  console.log('  ✓ Shows 5 summer-placed students')
  console.log('  ✓ Stipend shown as ₹75000/mo, ₹90000/mo etc (admin only)')
  console.log('  ✓ International badge on Vikram Singh (McKinsey)')
  console.log('\nPLACED TAB — FINALS')
  console.log('  ✓ Shows 3 final-placed students')
  console.log('  ✓ CTC: 3250000 → "32.50 LPA"')
  console.log('  ✓ CTC: 2200000 → "22.00 LPA"')
  console.log('  ✓ CTC: 1850000 → "18.50 LPA"')
  console.log('  ✓ View modal shows Domain, Final Status fields')
  console.log('  ✓ Avg CTC and Max CTC stat cards visible (admin only)')
  console.log('\nPLACE MODAL')
  console.log('  ✓ Finals season: shows Domain + Final Status fields')
  console.log('  ✓ Summer season: shows Domain but NOT Final Status')
  console.log('  ✓ Finals VIA options: Summer PPO, Summer PPI, Finals Cycle etc.')
  console.log('  ✓ Summer VIA options: Campus Placement, Case Competition etc.')
  console.log('\nAPPROVALS')
  console.log('  ✓ Cannot approve own proposal')
  console.log('  ✓ Different admin can approve')
  console.log('\nADMIN → COHORT MANAGEMENT')
  console.log('  ✓ 27-Delhi-IB shown, activeCycle = Final')
  console.log('  ✓ Cycle toggle works (summer/final)')
  console.log('\nExport')
  console.log('  ✓ Export CSV from Roster — no _ prefixed fields')
  console.log('  ✓ Export from Placed tab — includes placement_domain, placement_final_status')
  console.log('─────────────────────────────────────────────────')
  console.log('\nDone! Open http://localhost:5173 to test.')
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
