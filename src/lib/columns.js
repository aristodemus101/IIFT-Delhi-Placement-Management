// src/lib/columns.js
// Canonical columns — the source of truth for all field definitions

function pick(r, ...headers) {
  for (const h of headers) {
    const v = r[h]
    if (v !== undefined && v !== null) return v
  }
  return ''
}

export const OUR_COLS = [
  { key: 'course', label: 'Course', path: r => pick(r, 'Course') },
  { key: 'roll', label: 'Roll No.', path: r => pick(r, 'Roll No.') },
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
  { key: 'dob', label: 'Date of Birth', path: r => pick(r, 'Date of Birth') },
  { key: 'age', label: 'Age', path: r => pick(r, 'Age') },
  { key: 'category', label: 'Category', path: r => pick(r, 'Category') },
  { key: 'category_proof', label: 'Category Certificate proof', path: r => pick(r, 'Category Certificate proof') },
  { key: 'pwd', label: 'PWD Status', path: r => pick(r, 'PWD Status') },
  { key: 'state', label: 'Domicile State', path: r => pick(r, 'Domicile State') },
  { key: 'address', label: 'Full Permanent Address', path: r => pick(r, 'Full Permanent Address') },
  { key: 'pincode', label: 'Pincode of Permanent Address', path: r => pick(r, 'Pincode of Permanent Address') },
  { key: 'email', label: 'Personal Email ID', path: r => pick(r, 'Personal Email ID') },
  { key: 'official_email', label: 'Official Email ID (d27/ba27)', path: r => pick(r, 'Official Email ID (d27/ba27)') },
  { key: 'mobile', label: 'Mobile Number (Whatsapp)', path: r => pick(r, 'Mobile Number (Whatsapp)') },
  { key: 'mobile2', label: 'Mobile Number (Preferred Calling)', path: r => pick(r, 'Mobile Number (Preferred Calling)') },
  { key: 'father', label: "Father's Name", path: r => pick(r, "Father's Name") },
  { key: 'father_occ', label: "Father's Occupation", path: r => pick(r, "Father's Occupation") },
  { key: 'father_desig', label: "Father's Designation", path: r => pick(r, "Father's Designation") },
  { key: 'father_employer', label: "Father's Employer", path: r => pick(r, "Father's Employer") },
  { key: 'mother', label: "Mother's Name", path: r => pick(r, "Mother's Name") },
  { key: 'mother_occ', label: "Mother's Occupation", path: r => pick(r, "Mother's Occupation") },
  { key: 'mother_desig', label: "Mother's Designation", path: r => pick(r, "Mother's Designation") },
  { key: 'mother_employer', label: "Mother's Employer", path: r => pick(r, "Mother's Employer") },
  { key: 'x10board', label: 'Secondary Board (Class 10th) (CBSE/ICSE/ETC)', path: r => pick(r, 'Secondary Board (Class 10th) (CBSE/ICSE/ETC)') },
  { key: 'x10school', label: 'Class X School Name', path: r => pick(r, 'Class X School Name') },
  { key: 'x10_score_type', label: 'Class X Score Type', path: r => pick(r, 'Class X Score Type') },
  { key: 'x10_score', label: 'Class X Score', path: r => pick(r, 'Class X Score') },
  { key: 'x10_outof', label: 'Class X score out of', path: r => pick(r, 'Class X score out of') },
  { key: 'x10pct', label: 'Class X Score in percentage:', path: r => pick(r, 'Class X Score in percentage:') },
  { key: 'x10_start', label: 'Class 10th Start Date (Format - YYYY-MM-DD)', path: r => pick(r, 'Class 10th Start Date (Format - YYYY-MM-DD)') },
  { key: 'x10_end', label: 'Class 10th End Date (Format - YYYY-MM-DD)', path: r => pick(r, 'Class 10th End Date (Format - YYYY-MM-DD)') },
  { key: 'x12board', label: 'Class XII Board Name (CBSE/ICSE/ETC)', path: r => pick(r, 'Class XII Board Name (CBSE/ICSE/ETC)') },
  { key: 'x12school', label: 'Class XII School Name', path: r => pick(r, 'Class XII School Name') },
  { key: 'x12stream', label: 'Class XII Stream', path: r => pick(r, 'Class XII Stream') },
  { key: 'x12_score_type', label: 'Class XII Score Type', path: r => pick(r, 'Class XII Score Type') },
  { key: 'x12_score', label: 'Class XII Score', path: r => pick(r, 'Class XII Score') },
  { key: 'x12_outof', label: 'Class XII Score out of', path: r => pick(r, 'Class XII Score out of') },
  { key: 'x12pct', label: 'Class XII Score in percentage:', path: r => pick(r, 'Class XII Score in percentage:') },
  { key: 'x12_start', label: 'Class 12th Start Date (Format - YYYY-MM-DD)', path: r => pick(r, 'Class 12th Start Date (Format - YYYY-MM-DD)') },
  { key: 'x12_end', label: 'Class 12th End Date (Format - YYYY-MM-DD)', path: r => pick(r, 'Class 12th End Date (Format - YYYY-MM-DD)') },
  { key: 'ug_field', label: 'Field of UG study (Engineering/Commerce/Management/Science/etc)', path: r => pick(r, 'Field of UG study (Engineering/Commerce/Management/Science/etc)') },
  { key: 'ug', label: 'UG Degree (Eg: Btech, BBA, B.com, etc.)', path: r => pick(r, 'UG Degree (Eg: Btech, BBA, B.com, etc.)') },
  { key: 'ug_spec', label: 'UG Specialization', path: r => pick(r, 'UG Specialization') },
  { key: 'ug_college', label: 'UG College Name', path: r => pick(r, 'UG College Name') },
  { key: 'ug_uni', label: 'Full Name of Affiliated University (UG)', path: r => pick(r, 'Full Name of Affiliated University (UG)') },
  { key: 'ug_city', label: 'Graduation City', path: r => pick(r, 'Graduation City') },
  { key: 'ug_score_type', label: 'Graduation Score Type', path: r => pick(r, 'Graduation Score Type') },
  { key: 'ug_score', label: 'Graduation Score', path: r => pick(r, 'Graduation Score') },
  { key: 'ug_outof', label: 'Graduation Score out of', path: r => pick(r, 'Graduation Score out of') },
  { key: 'ugpct', label: 'Graduation Overall Score in %age', path: r => pick(r, 'Graduation Overall Score in %age') },
  { key: 'ug_start', label: 'UG Start Date (Format - YYYY-MM-DD)', path: r => pick(r, 'UG Start Date (Format - YYYY-MM-DD)') },
  { key: 'ug_end', label: 'UG End Date (Format - YYYY-MM-DD)', path: r => pick(r, 'UG End Date (Format - YYYY-MM-DD)') },
  { key: 'pg1', label: 'Post Graduate Degree 1', path: r => pick(r, 'Post Graduate Degree 1') },
  { key: 'pg1_spec', label: 'Post Graduate Degree Specialization', path: r => pick(r, 'Post Graduate Degree Specialization') },
  { key: 'pg1_year', label: 'Year of passing PG1', path: r => pick(r, 'Year of passing PG1') },
  { key: 'pg1_inst', label: 'PG1 Institute Name', path: r => pick(r, 'PG1 Institute Name') },
  { key: 'pg1_city', label: 'PG1 Institute City', path: r => pick(r, 'PG1 Institute City') },
  { key: 'pg1_uni', label: 'PG1 Affiliated University', path: r => pick(r, 'PG1 Affiliated University') },
  { key: 'pg1_score_type', label: 'PG1 Score type', path: r => pick(r, 'PG1 Score type') },
  { key: 'pg1_score', label: 'PG1 Score', path: r => pick(r, 'PG1 Score') },
  { key: 'pg1_outof', label: 'PG1 Score Out of', path: r => pick(r, 'PG1 Score Out of') },
  { key: 'pg1pct', label: 'PG1 Score in %age', path: r => pick(r, 'PG1 Score in %age') },
  { key: 'pg1_start', label: 'PG1 Start Date (Format - YYYY-MM-DD)', path: r => pick(r, 'PG1 Start Date (Format - YYYY-MM-DD)') },
  { key: 'pg1_end', label: 'PG1 End Date (Format - YYYY-MM-DD)', path: r => pick(r, 'PG1 End Date (Format - YYYY-MM-DD)') },
  { key: 'intern1', label: 'Internship Company 1', path: r => pick(r, 'Internship Company 1') },
  { key: 'intern1_loc', label: 'Internship Location C1', path: r => pick(r, 'Internship Location C1') },
  { key: 'intern1_project', label: 'Internship Project C1 (Details in brief)', path: r => pick(r, 'Internship Project C1 (Details in brief)') },
  { key: 'intern1_domain', label: 'Internship Project Domain C1', path: r => pick(r, 'Internship Project Domain C1') },
  { key: 'intern1_dur', label: 'Internship Duration C1 (in months)', path: r => pick(r, 'Internship Duration C1 (in months)') },
  { key: 'intern2', label: 'Internship Company 2', path: r => pick(r, 'Internship Company 2') },
  { key: 'intern2_loc', label: 'Internship Location C2', path: r => pick(r, 'Internship Location C2') },
  { key: 'intern2_project', label: 'Internship Project C2', path: r => pick(r, 'Internship Project C2') },
  { key: 'intern2_domain', label: 'Internship Project Domain C2', path: r => pick(r, 'Internship Project Domain C2') },
  { key: 'intern2_dur', label: 'Internship Duration C2 (in months)', path: r => pick(r, 'Internship Duration C2 (in months)') },
  { key: 'wx', label: 'Total Work Experience (in months)', path: r => pick(r, 'Total Work Experience (in months)') },
  { key: 'c1_name', label: 'Name of Company (C1)', path: r => pick(r, 'Name of Company (C1)') },
  { key: 'c1_loc', label: 'Company Location (C1)', path: r => pick(r, 'Company Location (C1)') },
  { key: 'c1_sector', label: 'Company Sector (C1)', path: r => pick(r, 'Company Sector (C1)') },
  { key: 'c1_desig', label: 'C1 Last Designation Held', path: r => pick(r, 'C1 Last Designation Held') },
  { key: 'c1_domain', label: 'C1 Work Experience Domain', path: r => pick(r, 'C1 Work Experience Domain') },
  { key: 'c1_months', label: 'C1 Work Experience (in months)', path: r => pick(r, 'C1 Work Experience (in months)') },
  { key: 'c1_roles', label: 'C1 Roles and Responsibilities', path: r => pick(r, 'C1 Roles and Responsibilities') },
  { key: 'c2_name', label: 'Name of Company (C2)', path: r => pick(r, 'Name of Company (C2)') },
  { key: 'c2_loc', label: 'Company Location (C2)', path: r => pick(r, 'Company Location (C2)') },
  { key: 'c2_sector', label: 'Company Sector (C2)', path: r => pick(r, 'Company Sector (C2)') },
  { key: 'c2_desig', label: 'Last Designation Held (C2)', path: r => pick(r, 'Last Designation Held (C2)') },
  { key: 'c2_domain', label: 'Work Experience Domain (C2)', path: r => pick(r, 'Work Experience Domain (C2)') },
  { key: 'c2_months', label: 'Work Experience in months (C2)', path: r => pick(r, 'Work Experience in months (C2)') },
  { key: 'c2_roles', label: 'Roles and Responsibilities (C2)', path: r => pick(r, 'Roles and Responsibilities (C2)') },
  { key: 'c3_name', label: 'Name of Company (C3)', path: r => pick(r, 'Name of Company (C3)') },
  { key: 'c3_loc', label: 'Company Location (C3)', path: r => pick(r, 'Company Location (C3)') },
  { key: 'c3_sector', label: 'Company Sector (C3)', path: r => pick(r, 'Company Sector (C3)') },
  { key: 'c3_desig', label: 'Last Designation Held (C3)', path: r => pick(r, 'Last Designation Held (C3)') },
  { key: 'c3_domain', label: 'Work Experience Domain (C3)', path: r => pick(r, 'Work Experience Domain (C3)') },
  { key: 'c3_months', label: 'Work Experience in months (C3)', path: r => pick(r, 'Work Experience in months (C3)') },
  { key: 'c3_roles', label: 'Roles and Responsibilities (C3)', path: r => pick(r, 'Roles and Responsibilities (C3)') },
  { key: 'achievement', label: 'One Major Achievement', path: r => pick(r, 'One Major Achievement') },
  { key: 'cert_prof', label: 'Professional Certification (CA/CFA/Six Sigma Certifications/Etc)', path: r => pick(r, 'Professional Certification (CA/CFA/Six Sigma Certifications/Etc)') },
  { key: 'cert_add', label: 'Additional Certifications (Udemy/Coursera Courses)', path: r => pick(r, 'Additional Certifications (Udemy/Coursera Courses)') },
  { key: 'por', label: 'Past Position of Responsibility', path: r => pick(r, 'Past Position of Responsibility') },
  { key: 'state_natl', label: 'State or National Level Achievement', path: r => pick(r, 'State or National Level Achievement') },
  { key: 'languages', label: 'Languages Known (Write all seperated by comma)', path: r => pick(r, 'Languages Known (Write all seperated by comma)') },
]

export const SYNONYMS = {
  roll:        ['roll', 'roll no', 'roll number', 'enrollment', 'enroll', 'student id', 'student code', 'reg no', 'registration'],
  name:        ['name', 'full name', 'student name', 'candidate name', 'applicant name', 'participant name'],
  firstName:   ['first name', 'given name', 'fname'],
  lastName:    ['last name', 'surname', 'family name', 'lname'],
  gender:      ['gender', 'sex'],
  dob:         ['dob', 'birth', 'date of birth', 'birthdate', 'birth date'],
  age:         ['age', 'age in years'],
  cat_score:   ['cat score', 'cat raw score', 'cat marks'],
  cat:         ['cat percentile', 'cat %ile', 'percentile', 'cat perc', 'cat %', 'cat score percentile'],
  category:    ['category', 'caste', 'reservation', 'social category', 'caste category'],
  pwd:         ['pwd', 'disability', 'differently abled', 'handicapped', 'pwbd'],
  state:       ['state', 'domicile', 'home state', 'state of domicile', 'domicile state'],
  email:       ['email', 'mail', 'email id', 'personal email', 'e-mail', 'email address'],
  mobile:      ['mobile', 'phone', 'contact', 'whatsapp', 'number', 'contact number', 'mobile no', 'phone number'],
  father:      ['father', 'father name', "father's name", 'dad', "fathers name"],
  mother:      ['mother', 'mother name', "mother's name", 'mom', "mothers name"],
  x10pct:      ['10th', 'class 10', 'class x', 'x %', '10th %', '10th percent', 'secondary', 'ssc', 'matric', '10th marks', 'class 10 marks', 'x marks'],
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
  ugpct:       ['ug %', 'ug percent', 'graduation %', 'graduation percent', 'cgpa', 'gpa', 'ug score', 'ug marks', 'ug gpa', 'aggregate'],
  pg1:         ['pg', 'pg degree', 'post grad', 'postgrad', 'mba', 'mtech', 'ms', 'post graduate', 'masters'],
  pg1_inst:    ['pg institute', 'pg college', 'pg school', 'pg institution'],
  pg1pct:      ['pg %', 'pg percent', 'pg score', 'pg marks', 'pg gpa'],
  wx:          ['work ex', 'work experience', 'total work ex', 'experience', 'exp', 'total exp', 'months of experience', 'work exp', 'total experience', 'work experience months'],
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
}

export function getVal(student, key) {
  const col = OUR_COLS.find(c => c.key === key)
  if (!col) return ''
  try { return col.path(student) || '' } catch { return '' }
}

export function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function autoMapColumns(companyCols) {
  return companyCols.map(col => {
    const n = normalize(col)
    let matched = null
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (syns.some(s => n.includes(normalize(s)) || normalize(s).includes(n))) {
        matched = key
        break
      }
    }
    return { companyCol: col, ourKey: matched, auto: !!matched }
  })
}
