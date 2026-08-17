// src/lib/columns.js
// Canonical columns — the source of truth for all field definitions

function pick(r, ...headers) {
  for (const h of headers) {
    const v = r[h]
    if (v !== undefined && v !== null) return v
  }
  return ''
}

// Coerce Excel serial integers stored as strings in Firestore to ISO date strings.
// Existing data imported before the cellDates fix may have bare serials like "43191".
// Serial range 1–73050 covers 1900-01-01 to 2099-12-31.
function coerceDate(v) {
  const s = String(v ?? '').trim()
  if (!s) return s
  // Already ISO or human-readable — pass through
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s
  const n = Number(s)
  if (Number.isInteger(n) && n > 1 && n < 73050) {
    const utcMs = (n - 25569) * 86400 * 1000
    const d = new Date(utcMs)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return s
}

function pickDate(r, ...headers) {
  return coerceDate(pick(r, ...headers))
}

export const OUR_COLS = [
  { key: 'course', label: 'Course', path: r => pick(r, 'Course') },
  { key: 'roll', label: 'Roll No.', path: r => pick(r, 'Roll No.', 'Roll') },
  { key: 'firstName', label: 'First Name', path: r => pick(r, 'First Name') },
  { key: 'middleName', label: 'Middle Name', path: r => pick(r, 'Middle Name') },
  { key: 'lastName', label: 'Last Name', path: r => pick(r, 'Last Name') },
  {
    key: 'name',
    label: 'Full Name',
    path: r => pick(r, 'Full Name', 'Full Name ') || [pick(r, 'First Name'), pick(r, 'Middle Name'), pick(r, 'Last Name')].filter(Boolean).join(' '),
  },
  { key: 'gender', label: 'Gender', path: r => pick(r, 'Gender') },
  { key: 'cat_score', label: 'CAT Score', path: r => pick(r, 'CAT Score') },
  { key: 'cat', label: 'CAT Percentile', path: r => pick(r, 'CAT Percentile') },
  { key: 'cat_scorecard', label: 'CAT Scorecard', path: r => pick(r, 'CAT Scorecard') },
  { key: 'dob', label: 'Date of Birth', path: r => pickDate(r, 'Date of Birth') },
  { key: 'age', label: 'Age', path: r => pick(r, 'Age') },
  { key: 'category', label: 'Category', path: r => pick(r, 'Category') },
  { key: 'category_proof', label: 'Category Certificate proof', path: r => pick(r, 'Category Certificate proof') },
  { key: 'pwd', label: 'PWD Status', path: r => pick(r, 'PWD Status') },
  { key: 'state', label: 'Domicile State', path: r => pick(r, 'Domicile State') },
  { key: 'address', label: 'Full Permanent Address', path: r => pick(r, 'Full Permanent Address') },
  { key: 'pincode', label: 'Pincode of Permanent Address', path: r => pick(r, 'Pincode of Permanent Address') },
  { key: 'email', label: 'Personal Email ID', path: r => pick(r, 'Personal Email ID') },
  { key: 'official_email', label: 'Official Email ID (d27/ba27)', path: r => pick(r, 'Official Email ID (d27/ba27)', 'Official Institute Email ID') },
  { key: 'mobile', label: 'Mobile Number (Whatsapp)', path: r => pick(r, 'Mobile Number (Whatsapp)', 'Mobile Number') },
  { key: 'mobile2', label: 'Mobile Number (Preferred Calling)', path: r => pick(r, 'Mobile Number (Preferred Calling)') },
  { key: 'father', label: "Father's Name", path: r => pick(r, "Father's Name") },
  { key: 'father_occ', label: "Father's Occupation", path: r => pick(r, "Father's Occupation") },
  { key: 'father_desig', label: "Father's Designation", path: r => pick(r, "Father's Designation") },
  { key: 'father_employer', label: "Father's Employer", path: r => pick(r, "Father's Employer") },
  { key: 'mother', label: "Mother's Name", path: r => pick(r, "Mother's Name") },
  { key: 'mother_occ', label: "Mother's Occupation", path: r => pick(r, "Mother's Occupation") },
  { key: 'mother_desig', label: "Mother's Designation", path: r => pick(r, "Mother's Designation") },
  { key: 'mother_employer', label: "Mother's Employer", path: r => pick(r, "Mother's Employer") },
  { key: 'x10board', label: 'Secondary Board (Class 10th) (CBSE/ICSE/ETC)', path: r => pick(r, 'Secondary Board (Class 10th) (CBSE/ICSE/ETC)', 'Class X Board') },
  { key: 'x10school', label: 'Class X School Name', path: r => pick(r, 'Class X School Name', 'Class 10th School Name') },
  { key: 'x10_score_type', label: 'Class X Score Type', path: r => pick(r, 'Class X Score Type') },
  { key: 'x10_score', label: 'Class X Score', path: r => pick(r, 'Class X Score') },
  { key: 'x10_outof', label: 'Class X score out of', path: r => pick(r, 'Class X score out of') },
  { key: 'x10pct', label: 'Class X Score in percentage:', path: r => pick(r, 'Class X Score in percentage:', 'Class 10th \nScore Obtained (in %)', 'Class 10th Score Obtained (in %)') },
  { key: 'x10_start', label: 'Class 10th Start Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'Class 10th Start Date (Format - YYYY-MM-DD)') },
  { key: 'x10_end', label: 'Class 10th End Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'Class 10th End Date (Format - YYYY-MM-DD)') },
  { key: 'x12board', label: 'Class XII Board Name (CBSE/ICSE/ETC)', path: r => pick(r, 'Class XII Board Name (CBSE/ICSE/ETC)', 'Class 12th Board') },
  { key: 'x12school', label: 'Class XII School Name', path: r => pick(r, 'Class XII School Name', 'Class 12th School Name') },
  { key: 'x12stream', label: 'Class XII Stream', path: r => pick(r, 'Class XII Stream') },
  { key: 'x12_score_type', label: 'Class XII Score Type', path: r => pick(r, 'Class XII Score Type') },
  { key: 'x12_score', label: 'Class XII Score', path: r => pick(r, 'Class XII Score') },
  { key: 'x12_outof', label: 'Class XII Score out of', path: r => pick(r, 'Class XII Score out of') },
  { key: 'x12pct', label: 'Class XII Score in percentage:', path: r => pick(r, 'Class XII Score in percentage:', 'Class 12th Score Obtained (in %)') },
  { key: 'x12_start', label: 'Class 12th Start Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'Class 12th Start Date (Format - YYYY-MM-DD)') },
  { key: 'x12_end', label: 'Class 12th End Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'Class 12th End Date (Format - YYYY-MM-DD)') },
  { key: 'ug_field', label: 'Field of UG study (Engineering/Commerce/Management/Science/etc)', path: r => pick(r, 'Field of UG study (Engineering/Commerce/Management/Science/etc)') },
  { key: 'ug', label: 'UG Degree (Eg: Btech, BBA, B.com, etc.)', path: r => pick(r, 'UG Degree (Eg: Btech, BBA, B.com, etc.)') },
  { key: 'ug_spec', label: 'UG Specialization', path: r => pick(r, 'UG Specialization') },
  { key: 'ug_college', label: 'UG College Name', path: r => pick(r, 'UG College Name') },
  { key: 'ug_uni', label: 'Full Name of Affiliated University (UG)', path: r => pick(r, 'Full Name of Affiliated University (UG)') },
  { key: 'ug_city', label: 'Graduation City', path: r => pick(r, 'Graduation City') },
  { key: 'ug_score_type', label: 'Graduation Score Type', path: r => pick(r, 'Graduation Score Type') },
  { key: 'ug_score', label: 'Graduation Score', path: r => pick(r, 'Graduation Score') },
  { key: 'ug_outof', label: 'Graduation Score out of', path: r => pick(r, 'Graduation Score out of') },
  { key: 'ugpct', label: 'Graduation Overall Score in %age', path: r => pick(r, 'Graduation Overall Score in %age', 'UG Score in Percentage') },
  { key: 'ug_start', label: 'UG Start Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'UG Start Date (Format - YYYY-MM-DD)') },
  { key: 'ug_end', label: 'UG End Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'UG End Date (Format - YYYY-MM-DD)') },
  { key: 'pg1', label: 'Post Graduate Degree 1', path: r => pick(r, 'Post Graduate Degree 1', 'Post Graduate Degree') },
  { key: 'pg1_spec', label: 'Post Graduate Degree Specialization', path: r => pick(r, 'Post Graduate Degree Specialization', 'PG Specialization') },
  { key: 'pg1_year', label: 'Year of passing PG1', path: r => pick(r, 'Year of passing PG1', 'Year of Passing') },
  { key: 'pg1_inst', label: 'PG1 Institute Name', path: r => pick(r, 'PG1 Institute Name', 'PG Institute Name') },
  { key: 'pg1_city', label: 'PG1 Institute City', path: r => pick(r, 'PG1 Institute City', 'PG Institute City') },
  { key: 'pg1_uni', label: 'PG1 Affiliated University', path: r => pick(r, 'PG1 Affiliated University', 'PG Affiliated University') },
  { key: 'pg1_score_type', label: 'PG1 Score type', path: r => pick(r, 'PG1 Score type') },
  { key: 'pg1_score', label: 'PG1 Score', path: r => pick(r, 'PG1 Score', 'PG Score Obtained') },
  { key: 'pg1_outof', label: 'PG1 Score Out of', path: r => pick(r, 'PG1 Score Out of') },
  { key: 'pg1pct', label: 'PG1 Score in %age', path: r => pick(r, 'PG1 Score in %age') },
  { key: 'pg1_start', label: 'PG1 Start Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'PG1 Start Date (Format - YYYY-MM-DD)', 'PG Start Date') },
  { key: 'pg1_end', label: 'PG1 End Date (Format - YYYY-MM-DD)', path: r => pickDate(r, 'PG1 End Date (Format - YYYY-MM-DD)', 'PG End Date') },
  { key: 'intern1', label: 'Internship Company 1', path: r => pick(r, 'Internship Company 1') },
  { key: 'intern1_loc', label: 'Internship Location C1', path: r => pick(r, 'Internship Location C1', 'Internship Location 1') },
  { key: 'intern1_project', label: 'Internship Project C1 (Details in brief)', path: r => pick(r, 'Internship Project C1 (Details in brief)', 'Internship Project Description 1') },
  { key: 'intern1_domain', label: 'Internship Project Domain C1', path: r => pick(r, 'Internship Project Domain C1') },
  { key: 'intern1_dur', label: 'Internship Duration C1 (in months)', path: r => pick(r, 'Internship Duration C1 (in months)', 'Internship Duration 1 (Months)') },
  { key: 'intern2', label: 'Internship Company 2', path: r => pick(r, 'Internship Company 2') },
  { key: 'intern2_loc', label: 'Internship Location C2', path: r => pick(r, 'Internship Location C2', 'Internship Location 2') },
  { key: 'intern2_project', label: 'Internship Project C2', path: r => pick(r, 'Internship Project C2', 'Internship Project Description 2') },
  { key: 'intern2_domain', label: 'Internship Project Domain C2', path: r => pick(r, 'Internship Project Domain C2') },
  { key: 'intern2_dur', label: 'Internship Duration C2 (in months)', path: r => pick(r, 'Internship Duration C2 (in months)', 'Internship Duration 2 (Months)') },
  { key: 'wx', label: 'Total Work Experience (in months)', path: r => pick(r, 'Total Work Experience (in months)', 'Total Work Experience (Months)') },
  { key: 'c1_name', label: 'Name of Company (C1)', path: r => pick(r, 'Name of Company (C1)', 'Company Name (C1)') },
  { key: 'c1_loc', label: 'Company Location (C1)', path: r => pick(r, 'Company Location (C1)') },
  { key: 'c1_sector', label: 'Company Sector (C1)', path: r => pick(r, 'Company Sector (C1)', 'Industry / Sector (C1)') },
  { key: 'c1_desig', label: 'C1 Last Designation Held', path: r => pick(r, 'C1 Last Designation Held', 'Designation Held (C1)') },
  { key: 'c1_domain', label: 'C1 Work Experience Domain', path: r => pick(r, 'C1 Work Experience Domain', 'Functional Domain (C1)') },
  { key: 'c1_months', label: 'C1 Work Experience (in months)', path: r => pick(r, 'C1 Work Experience (in months)', 'Work Experience \nin Months (C1)', 'Work Experience in Months (C1)') },
  { key: 'c1_roles', label: 'C1 Roles and Responsibilities', path: r => pick(r, 'C1 Roles and Responsibilities', 'Roles and Responsibilities (C1)') },
  { key: 'c2_name', label: 'Name of Company (C2)', path: r => pick(r, 'Name of Company (C2)', 'Company Name (C2)') },
  { key: 'c2_loc', label: 'Company Location (C2)', path: r => pick(r, 'Company Location (C2)') },
  { key: 'c2_sector', label: 'Company Sector (C2)', path: r => pick(r, 'Company Sector (C2)', 'Industry / Sector (C2)') },
  { key: 'c2_desig', label: 'Last Designation Held (C2)', path: r => pick(r, 'Last Designation Held (C2)', 'Designation Held (C2)') },
  { key: 'c2_domain', label: 'Work Experience Domain (C2)', path: r => pick(r, 'Work Experience Domain (C2)', 'Functional Domain (C2)') },
  { key: 'c2_months', label: 'Work Experience in months (C2)', path: r => pick(r, 'Work Experience in months (C2)', 'Work Experience in \nMonths (C2)', 'Work Experience in Months (C2)') },
  { key: 'c2_roles', label: 'Roles and Responsibilities (C2)', path: r => pick(r, 'Roles and Responsibilities (C2)') },
  { key: 'c3_name', label: 'Name of Company (C3)', path: r => pick(r, 'Name of Company (C3)', 'Company Name (C3)') },
  { key: 'c3_loc', label: 'Company Location (C3)', path: r => pick(r, 'Company Location (C3)') },
  { key: 'c3_sector', label: 'Company Sector (C3)', path: r => pick(r, 'Company Sector (C3)', 'Industry / Sector (C3)') },
  { key: 'c3_desig', label: 'Last Designation Held (C3)', path: r => pick(r, 'Last Designation Held (C3)', 'Designation Held (C3)') },
  { key: 'c3_domain', label: 'Work Experience Domain (C3)', path: r => pick(r, 'Work Experience Domain (C3)', 'Functional Domain (C3)') },
  { key: 'c3_months', label: 'Work Experience in months (C3)', path: r => pick(r, 'Work Experience in months (C3)', 'Work Experience in \nMonths (C3)', 'Work Experience in Months (C3)') },
  { key: 'c3_roles', label: 'Roles and Responsibilities (C3)', path: r => pick(r, 'Roles and Responsibilities (C3)') },
  { key: 'achievement', label: 'One Major Achievement', path: r => pick(r, 'One Major Achievement') },
  { key: 'cert_prof', label: 'Professional Certification (CA/CFA/Six Sigma Certifications/Etc)', path: r => pick(r, 'Professional Certification (CA/CFA/Six Sigma Certifications/Etc)', 'Professional Certifications') },
  { key: 'cert_add', label: 'Additional Certifications (Udemy/Coursera Courses)', path: r => pick(r, 'Additional Certifications (Udemy/Coursera Courses)', 'Additional Certifications') },
  { key: 'por', label: 'Past Position of Responsibility', path: r => pick(r, 'Past Position of Responsibility', 'Position of Responsibility') },
  { key: 'state_natl', label: 'State or National Level Achievement', path: r => pick(r, 'State or National Level Achievement') },
  { key: 'languages', label: 'Languages Known (Write all seperated by comma)', path: r => pick(r, 'Languages Known (Write all seperated by comma)', 'Languages Known (Comma Separated)') },

  // ── Summer Internship (SIP) placement fields ──────────────────────────────
  // Stored in _placement_summer.* after import; also readable from raw SIP headers.
  { key: 'sip_status',   label: 'SIP Status',                    path: r => pick(r, 'SIP Status') || (r._placed_summer ? 'Placed' : '') },
  { key: 'sip_company',  label: 'SIP Company',                   path: r => r._placement_summer?.company  || pick(r, 'SIP Company') },
  { key: 'sip_role',     label: 'SIP Role',                      path: r => r._placement_summer?.role     || pick(r, 'SIP Role') },
  { key: 'sip_sector',   label: 'SIP Company Sector / Domain',   path: r => r._placement_summer?.sector   || pick(r, 'SIP Company Sector', 'SIP Company Domain') },
  { key: 'sip_location', label: 'SIP Location',                  path: r => r._placement_summer?.location || pick(r, 'Location') },
  { key: 'sip_stipend',  label: 'SIP Stipend',                   path: r => r._placement_summer?.package  || pick(r, 'SIP Stipend (In Lakhs/month)', 'Summer Stipend', 'SIP Stipend') },
  { key: 'sip_via',      label: 'SIP Placed Via',                path: r => r._placement_summer?.via      || pick(r, 'Placed Via') },
  { key: 'sip_date',     label: 'SIP Date of Placement',         path: r => r._placement_summer?.date     || pickDate(r, 'DOP') },
  { key: 'sip_notes',    label: 'SIP Roles & Responsibilities',  path: r => r._placement_summer?.ctcNotes || pick(r, 'SIP Roles and Responsibilities') },
]

export const SYNONYMS = {
  roll:        ['roll', 'roll no', 'roll number', 'enrollment', 'enroll', 'student id', 'student code', 'reg no', 'registration'],
  name:        ['name', 'full name', 'student name', 'candidate name', 'applicant name', 'participant name', 'name of student', 'name of candidate'],
  firstName:   ['first name', 'given name', 'fname'],
  lastName:    ['last name', 'surname', 'family name', 'lname'],
  gender:      ['gender', 'sex'],
  dob:         ['dob', 'birth', 'date of birth', 'birthdate', 'birth date'],
  age:         ['age', 'age in years'],
  cat_score:   ['cat score', 'cat raw score', 'cat marks'],
  cat:         ['cat percentile', 'cat %ile', 'percentile', 'cat perc', 'cat %', 'cat score percentile', 'cat score %', 'cat entrance', 'cat entrance score'],
  category:    ['category', 'caste', 'reservation', 'social category', 'caste category'],
  pwd:         ['pwd', 'disability', 'differently abled', 'handicapped', 'pwbd'],
  state:       ['state', 'domicile', 'home state', 'state of domicile', 'domicile state'],
  email:       ['email', 'mail', 'email id', 'personal email', 'e-mail', 'email address'],
  mobile:      ['mobile', 'phone', 'contact', 'whatsapp', 'number', 'contact number', 'mobile no', 'phone number'],
  father:      ['father', 'father name', "father's name", 'dad', "fathers name"],
  mother:      ['mother', 'mother name', "mother's name", 'mom', "mothers name"],
  x10pct:      ['10th', 'class 10', 'class x', 'class x %', '10th %', '10th percent', 'secondary', 'ssc', 'matric', '10th marks', 'class 10 marks', 'x marks'],
  x10board:    ['10th board', 'class 10 board', 'secondary board', 'x board'],
  x10school:   ['10th school', 'class 10 school', 'secondary school'],
  x12pct:      ['12th', 'class 12', 'class xii', 'xii %', '12th %', '12th percent', 'higher secondary', 'hsc', 'intermediate', '12th marks', 'xii marks'],
  x12board:    ['12th board', 'class 12 board', 'higher secondary board', 'xii board'],
  x12stream:   ['12th stream', 'class 12 stream', 'stream', 'xii stream'],
  ug:          ['ug degree', 'graduation degree', 'bachelor', 'bachelors', 'undergrad degree', 'ug qualification'],
  ug_spec:     ['ug spec', 'ug specialization', 'specialization', 'branch', 'major', 'ug branch'],
  ug_college:  ['ug college', 'college', 'graduation college', 'undergrad college', 'institute'],
  ug_uni:      ['university', 'ug university', 'affiliated university', 'ug uni'],
  ug_city:     ['graduation city', 'college city', 'ug city', 'college location'],
  ugpct:       ['ug %', 'ug percent', 'graduation %', 'graduation percent', 'cgpa', 'gpa', 'ug score', 'ug marks', 'ug gpa', 'aggregate', 'graduation marks', 'graduation score', 'graduation percentage', 'bachelors %', 'degree %'],
  pg1:         ['pg', 'pg degree', 'post grad', 'postgrad', 'mba', 'mtech', 'ms', 'post graduate', 'masters'],
  pg1_inst:    ['pg institute', 'pg college', 'pg school', 'pg institution'],
  pg1pct:      ['pg %', 'pg percent', 'pg score', 'pg marks', 'pg gpa'],
  wx:          ['work ex', 'work experience', 'total work ex', 'experience', 'exp', 'total exp', 'months of experience', 'work exp', 'total experience', 'work experience months', 'work experience in months', 'total work experience', 'we months', 'prior experience'],
  c1_name:     ['company 1', 'company name', 'current company', 'employer', 'previous employer', 'c1', 'first company', 'organisation', 'organization'],
  c1_desig:    ['designation', 'designation c1', 'last designation', 'title', 'job title', 'role', 'position'],
  c1_domain:   ['domain', 'domain c1', 'work domain', 'functional area', 'function'],
  c1_months:   ['c1 months', 'company 1 months', 'months c1', 'tenure', 'c1 tenure'],
  c2_name:     ['company 2', 'c2', 'second company', 'previous company'],
  c2_desig:    ['designation c2', 'c2 designation', 'c2 title'],
  c2_domain:   ['domain c2', 'c2 domain'],
  c2_months:   ['c2 months', 'months c2'],
  achievement: ['achievement', 'accomplishment', 'major achievement', 'key achievement'],
  cert_prof:   ['certification', 'cert', 'ca', 'cfa', 'professional cert', 'certifications', 'professional certification'],
  languages:   ['languages', 'language', 'known languages', 'languages known', 'languages spoken'],
  por:         ['por', 'position of responsibility', 'leadership', 'role of responsibility'],
  sip_status:  ['sip status', 'summer status', 'internship status', 'summer placement status'],
  sip_company: ['sip company', 'summer company', 'internship company', 'summer employer', 'sip employer', 'summer internship company'],
  sip_role:    ['sip role', 'summer role', 'internship role', 'summer designation', 'sip designation'],
  sip_sector:  ['sip sector', 'sip domain', 'summer sector', 'sip company sector', 'sip company domain', 'summer company domain'],
  sip_location:['sip location', 'summer location', 'internship location', 'location'],
  sip_stipend: ['sip stipend', 'summer stipend', 'stipend', 'sip package', 'summer package', 'internship stipend'],
  sip_via:     ['sip via', 'placed via', 'summer placed via', 'how placed'],
  sip_date:    ['dop', 'date of placement', 'sip date', 'summer date', 'joining date'],
  sip_notes:   ['sip roles', 'sip responsibilities', 'summer responsibilities', 'internship responsibilities'],
}

// Date column keys — coerce Excel serials to ISO at display time
const DATE_KEYS = new Set(['dob', 'x10_start', 'x10_end', 'x12_start', 'x12_end', 'ug_start', 'ug_end', 'pg1_start', 'pg1_end', 'sip_date'])

export function getVal(student, key) {
  const col = OUR_COLS.find(c => c.key === key)
  // Firestore docs store values under the short key (e.g. 'ug_start'), not the
  // original header label, so direct key lookup is the reliable path.
  const raw = (student && student[key] !== undefined && student[key] !== null && student[key] !== '')
    ? student[key]
    : (col ? (() => { try { return col.path(student) } catch { return '' } })() : '')
  const val = String(raw ?? '')
  return DATE_KEYS.has(key) ? coerceDate(val) : val
}

export function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function autoMapColumns(companyCols) {
  const usedKeys = new Set()
  return companyCols.map(col => {
    const n = normalize(col)
    let matched = null
    let bestScore = 0

    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (usedKeys.has(key)) continue
      for (const s of syns) {
        const ns = normalize(s)
        let score = 0
        if (n === ns) score = 3              // exact match
        else if (n === ns || ns === n) score = 3
        else if (n.split(' ').join('') === ns.split(' ').join('')) score = 2  // same words different spacing
        else if (n === ns) score = 3
        // whole-word containment — avoid "name" matching "company name"
        else if (new RegExp(`(?:^| )${ns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$| )`).test(n)) score = 2
        else if (new RegExp(`(?:^| )${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$| )`).test(ns)) score = 1

        if (score > bestScore) { bestScore = score; matched = key }
      }
    }
    if (matched) usedKeys.add(matched)
    return { companyCol: col, ourKey: matched, auto: !!matched }
  })
}
