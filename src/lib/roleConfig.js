// Master admins: can manage roles (promote/demote anyone) + propose/approve changes.
// Multiple master admins are supported — toggled per-person from the Admin page.
export const MASTER_ADMIN_EMAILS = [
  'jay_d27@iift.edu',
  'divyaansh_d27@iift.edu',
  'divyaanshmehta513@gmail.com'
]

// Admins (including master): can propose + approve changes.
export const ADMIN_EMAILS = [
  'basil_d27@iift.edu',
]

// TPOs: can log in and enter their own company outreach data.
// Add real TPO emails here, or assign the tpo role manually via the Admin page.
export const TPO_EMAILS = [
  // 'tpo1@iift.edu',
]

// Faculty coordinators: read-only access to TPO performance + Analytics.
// Assigned by admin via the Admin page (no pre-seeded list needed).
export const FACULTY_COORDINATOR_EMAILS = [
    'preetitak@iift.edu'
]

// Pre-seeded viewers: auto-assigned on first login.
export const VIEWER_EMAILS = [
  'adityasingh_d27@iift.edu',
  'arnav_d27@iift.edu',
  'dev_ba27@iift.edu',
  'jatin_d27@iift.edu',
  'khushi_d27@iift.edu',
  'lakshyc_d27@iift.edu',
  'mohamed_d27@iift.edu',
  'rahulm_d27@iift.edu',
  'ranishka_d27@iift.edu',
  'shibanee_ba27@iift.edu',
  'sidhant_d27@iift.edu',
  'vaibhav_ba27@iift.edu'
]
