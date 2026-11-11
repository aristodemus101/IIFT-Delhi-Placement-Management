import { describe, it, expect } from 'vitest'
import { buildStudentProfile, profileToText } from '../lib/studentProfile'

function student(overrides = {}) {
  return {
    _id: 'x1',
    cohort: '28-Delhi-IB',
    'Full Name': 'Ananya Sharma',
    'Roll No.': '12A',
    'Official Institute Email ID': 'ananya_d28@iift.edu',
    'Mobile Number (Whatsapp)': '9876543210',
    'Class X Score in percentage:': '92.5',
    'Class XII Score in percentage:': '91.2',
    'Graduation Overall Score in %age': '85.0',
    'Total Work Experience (in months)': '18',
    'Company Name (C1)': 'Deloitte',
    'Personal Email ID': 'ananya.personal@gmail.com',
    'Date of Birth': '2003-05-14',
    "Father's Name": 'Rakesh Sharma',
    "Mother's Name": 'Sunita Sharma',
    'Full Permanent Address': '42 MG Road, Pune, Maharashtra 411001',
    'UG Degree (Eg: Btech, BBA, B.com, etc.)': 'B.Com',
    'UG College Name': 'Fergusson College',
    _placed_summer: true,
    _placement_summer: { company: 'Goldman Sachs' },
    _placed_final: false,
    _placement_final: null,
    ...overrides,
  }
}

describe('buildStudentProfile', () => {
  it('extracts all core fields', () => {
    const p = buildStudentProfile(student())
    expect(p).toMatchObject({
      name: 'Ananya Sharma',
      roll: '12A',
      officialEmail: 'ananya_d28@iift.edu',
      mobile: '9876543210',
      course: 'MBA (IB)',
      gradYear: '2028',
      sipCompany: 'Goldman Sachs',
      finalCompany: '',
      x10: '92.5',
      x12: '91.2',
      ug: '85.0',
      workEx: '18',
      recentCompany: 'Deloitte',
    })
  })

  it('extracts the extended personal + UG fields', () => {
    const p = buildStudentProfile(student())
    expect(p).toMatchObject({
      personalEmail: 'ananya.personal@gmail.com',
      dob: '2003-05-14',
      father: 'Rakesh Sharma',
      mother: 'Sunita Sharma',
      address: '42 MG Road, Pune, Maharashtra 411001',
      ugDegree: 'B.Com',
      ugCollege: 'Fergusson College',
      ugDegreeCollege: 'B.Com · Fergusson College',
    })
  })

  it('combines UG degree + college, and drops the separator when one is missing', () => {
    expect(buildStudentProfile(student({ 'UG College Name': '' })).ugDegreeCollege).toBe('B.Com')
    expect(buildStudentProfile(student({ 'UG Degree (Eg: Btech, BBA, B.com, etc.)': '' })).ugDegreeCollege).toBe('Fergusson College')
  })

  it('extracts BD27 Major / Minor / SIP Project, with NA fallback when missing', () => {
    const withVals = buildStudentProfile(student({ Major: 'Marketing', Minor: 'Finance', 'SIP Project Details': 'Grew sales 14%' }))
    expect(withVals.major).toBe('Marketing')
    expect(withVals.minor).toBe('Finance')
    expect(withVals.sipProject).toBe('Grew sales 14%')

    const missing = buildStudentProfile(student())
    expect(missing.major).toBe('NA')
    expect(missing.minor).toBe('NA')
    expect(missing.sipProject).toBe('NA')
  })

  it('maps BA cohort programme label', () => {
    const p = buildStudentProfile(student({ cohort: '28-Delhi-BA' }))
    expect(p.course).toBe('MBA (BA)')
  })

  it('derives graduating year from the cohort', () => {
    expect(buildStudentProfile(student({ cohort: '27-Delhi-IB' })).gradYear).toBe('2027')
  })

  it('only shows a placement company when the placed flag is true', () => {
    const notPlaced = buildStudentProfile(student({ _placed_summer: false }))
    expect(notPlaced.sipCompany).toBe('')
    const finalPlaced = buildStudentProfile(student({ _placed_final: true, _placement_final: { company: 'McKinsey' } }))
    expect(finalPlaced.finalCompany).toBe('McKinsey')
  })

  it('cleans placeholder values (NA, -, 0) to empty', () => {
    const p = buildStudentProfile(student({ 'Total Work Experience (in months)': 'NA', 'Company Name (C1)': '-' }))
    expect(p.workEx).toBe('')
    expect(p.recentCompany).toBe('')
  })

  it('handles a student with no cohort', () => {
    const p = buildStudentProfile(student({ cohort: '' }))
    expect(p.course).toBe('')
    expect(p.gradYear).toBe('')
  })
})

describe('profileToText', () => {
  it('produces a labelled block with the institute header', () => {
    const txt = profileToText(buildStudentProfile(student()))
    expect(txt).toContain('IIFT Delhi — Candidate Profile')
    expect(txt).toContain('Ananya Sharma (12A)')
    expect(txt).toContain('Official Email: ananya_d28@iift.edu')
    expect(txt).toContain('Class X: 92.5%')
    expect(txt).toContain('Work Experience: 18 months')
    expect(txt).toContain('SIP Company: Goldman Sachs')
    expect(txt).toContain('Personal Email: ananya.personal@gmail.com')
    expect(txt).toContain("Father: Rakesh Sharma")
    expect(txt).toContain("Mother: Sunita Sharma")
    expect(txt).toContain('Permanent Address: 42 MG Road, Pune, Maharashtra 411001')
    expect(txt).toContain('Date of Birth: 2003-05-14')
    expect(txt).toContain('UG Degree: B.Com · Fergusson College')
  })

  it('omits empty fields', () => {
    const txt = profileToText(buildStudentProfile(student({ _placed_summer: false, 'Company Name (C1)': '' })))
    expect(txt).not.toContain('SIP Company')
    expect(txt).not.toContain('Most Recent Company')
  })
})
