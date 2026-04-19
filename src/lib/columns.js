// src/lib/columns.js
// Canonical columns — the source of truth for all field definitions

export const OUR_COLS = [
  { key: 'roll',       label: 'Roll No.',               path: r => r['Roll No.'] },
  { key: 'course',     label: 'Course',                 path: r => r['Course'] },
  { key: 'firstName',  label: 'First Name',             path: r => r['First Name'] },
  { key: 'lastName',   label: 'Last Name',              path: r => r['Last Name'] },
  { key: 'name',       label: 'Full Name',              path: r => r['Full Name'] || ((r['First Name'] || '') + ' ' + (r['Last Name'] || '')).trim() },
  { key: 'gender',     label: 'Gender',                 path: r => r['Gender'] },
  { key: 'dob',        label: 'Date of Birth',          path: r => r['Date of Birth'] },
  { key: 'age',        label: 'Age',                    path: r => r['Age'] },
  { key: 'cat_score',  label: 'CAT Score',              path: r => r['CAT Score'] },
  { key: 'cat',        label: 'CAT Percentile',         path: r => r['CAT Percentile'] },
  { key: 'category',   label: 'Category',               path: r => r['Category'] },
  { key: 'pwd',        label: 'PWD Status',             path: r => r['PWD Status'] },
  { key: 'state',      label: 'Domicile State',         path: r => r['Domicile State'] },
  { key: 'address',    label: 'Permanent Address',      path: r => r['Full Permanent Address'] },
  { key: 'pincode',    label: 'Pincode',                path: r => r['Pincode of Permanent Address'] },
  { key: 'email',      label: 'Personal Email',         path: r => r['Personal Email ID'] },
  { key: 'official_email', label: 'Official Email',     path: r => r['Official Email ID (d27/ba27)'] },
  { key: 'mobile',     label: 'Mobile (WhatsApp)',      path: r => r['Mobile Number (Whatsapp)'] },
  { key: 'mobile2',    label: 'Mobile (Calling)',       path: r => r['Mobile Number (Preferred Calling)'] },
  { key: 'father',     label: "Father's Name",          path: r => r["Father's Name"] },
  { key: 'father_occ', label: "Father's Occupation",   path: r => r["Father's Occupation"] },
  { key: 'mother',     label: "Mother's Name",          path: r => r["Mother's Name"] },
  { key: 'mother_occ', label: "Mother's Occupation",   path: r => r["Mother's Occupation"] },
  { key: 'x10board',   label: 'Class X Board',          path: r => r['Secondary Board (Class 10th) (CBSE/ICSE/ETC)'] },
  { key: 'x10school',  label: 'Class X School',         path: r => r['Class X School Name'] },
  { key: 'x10pct',     label: 'Class X %',              path: r => r['Class X Score in percentage:'] },
  { key: 'x12board',   label: 'Class XII Board',        path: r => r['Class XII Board Name (CBSE/ICSE/ETC)'] },
  { key: 'x12school',  label: 'Class XII School',       path: r => r['Class XII School Name'] },
  { key: 'x12stream',  label: 'Class XII Stream',       path: r => r['Class XII Stream'] },
  { key: 'x12pct',     label: 'Class XII %',            path: r => r['Class XII Score in percentage:'] },
  { key: 'ug_field',   label: 'UG Field of Study',      path: r => r['Field of UG study (Engineering/Commerce/Management/Science/etc)'] },
  { key: 'ug',         label: 'UG Degree',              path: r => r['UG Degree (Eg: Btech, BBA, B.com, etc.)'] },
  { key: 'ug_spec',    label: 'UG Specialization',      path: r => r['UG Specialization'] },
  { key: 'ug_college', label: 'UG College',             path: r => r['UG College Name'] },
  { key: 'ug_uni',     label: 'UG University',          path: r => r['Full Name of Affiliated University (UG)'] },
  { key: 'ug_city',    label: 'Graduation City',        path: r => r['Graduation City'] },
  { key: 'ugpct',      label: 'UG %',                   path: r => r['Graduation Overall Score in %age'] },
  { key: 'ug_start',   label: 'UG Start Date',          path: r => r['UG Start Date (Format - YYYY-MM-DD)'] },
  { key: 'ug_end',     label: 'UG End Date',            path: r => r['UG End Date (Format - YYYY-MM-DD)'] },
  { key: 'pg1',        label: 'PG Degree',              path: r => r['Post Graduate Degree 1'] },
  { key: 'pg1_spec',   label: 'PG Specialization',      path: r => r['Post Graduate Degree Specialization'] },
  { key: 'pg1_inst',   label: 'PG Institute',           path: r => r['PG1 Institute Name'] },
  { key: 'pg1_city',   label: 'PG City',                path: r => r['PG1 Institute City'] },
  { key: 'pg1pct',     label: 'PG %',                   path: r => r['PG1 Score in %age'] },
  { key: 'intern1',    label: 'Internship Company 1',   path: r => r['Internship Company 1'] },
  { key: 'intern1_domain', label: 'Internship 1 Domain', path: r => r['Internship Project Domain C1'] },
  { key: 'intern1_dur', label: 'Internship 1 Duration', path: r => r['Internship Duration C1 (in months)'] },
  { key: 'intern2',    label: 'Internship Company 2',   path: r => r['Internship Company 2'] },
  { key: 'intern2_domain', label: 'Internship 2 Domain', path: r => r['Internship Project Domain C2'] },
  { key: 'intern2_dur', label: 'Internship 2 Duration', path: r => r['Internship Duration C2 (in months)'] },
  { key: 'wx',         label: 'Total Work Ex (months)', path: r => r['Total Work Experience (in months)'] },
  { key: 'c1_name',    label: 'Company 1',              path: r => r['Name of Company (C1)'] },
  { key: 'c1_loc',     label: 'Company 1 Location',     path: r => r['Company Location (C1)'] },
  { key: 'c1_sector',  label: 'Company 1 Sector',       path: r => r['Company Sector (C1)'] },
  { key: 'c1_desig',   label: 'C1 Designation',         path: r => r['C1 Last Designation Held'] },
  { key: 'c1_domain',  label: 'C1 Domain',              path: r => r['C1 Work Experience Domain'] },
  { key: 'c1_months',  label: 'C1 Months',              path: r => r['C1 Work Experience (in months)'] },
  { key: 'c1_roles',   label: 'C1 Roles',               path: r => r['C1 Roles and Responsibilities'] },
  { key: 'c2_name',    label: 'Company 2',              path: r => r['Name of Company (C2)'] },
  { key: 'c2_loc',     label: 'Company 2 Location',     path: r => r['Company Location (C2)'] },
  { key: 'c2_sector',  label: 'Company 2 Sector',       path: r => r['Company Sector (C2)'] },
  { key: 'c2_desig',   label: 'C2 Designation',         path: r => r['Last Designation Held (C2)'] },
  { key: 'c2_domain',  label: 'C2 Domain',              path: r => r['Work Experience Domain (C2)'] },
  { key: 'c2_months',  label: 'C2 Months',              path: r => r['Work Experience in months (C2)'] },
  { key: 'c3_name',    label: 'Company 3',              path: r => r['Name of Company (C3)'] },
  { key: 'c3_desig',   label: 'C3 Designation',         path: r => r['Last Designation Held (C3)'] },
  { key: 'c3_domain',  label: 'C3 Domain',              path: r => r['Work Experience Domain (C3)'] },
  { key: 'c3_months',  label: 'C3 Months',              path: r => r['Work Experience in months (C3)'] },
  { key: 'achievement',label: 'Major Achievement',      path: r => r['One Major Achievement'] },
  { key: 'cert_prof',  label: 'Professional Certifications', path: r => r['Professional Certification (CA/CFA/Six Sigma Certifications/Etc)'] },
  { key: 'cert_add',   label: 'Additional Certifications', path: r => r['Additional Certifications (Udemy/Coursera Courses)'] },
  { key: 'por',        label: 'Position of Responsibility', path: r => r['Past Position of Responsibility'] },
  { key: 'state_natl', label: 'State/National Achievement', path: r => r['State or National Level Achievement'] },
  { key: 'languages',  label: 'Languages Known',        path: r => r['Languages Known (Write all seperated by comma)'] },
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
