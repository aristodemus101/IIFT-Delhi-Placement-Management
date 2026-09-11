/**
 * Cleans up all seeded opportunities from staging and re-seeds with corrected titles.
 * Run: node scripts/cleanup_and_reseed.mjs [--production]
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const isProd = process.argv.includes('--production')
const PROJECT_ID = isProd ? 'placement-management-6133f' : 'placement-mgmt-staging'
console.log(`\nTarget: ${isProd ? '🔴 PRODUCTION' : '🟡 STAGING'} (${PROJECT_ID})\n`)

initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

const POSTED_BY = {
  uid:   'divyaanshmehta513@gmail.com',
  name:  'Divyaansh Mehta',
  email: 'divyaanshmehta513@gmail.com',
}

function opp({
  title, type = 'Hiring', subtype = '', via = '', organization,
  applicability = 'summer', roles = [], stipend = '', ctc = '', duration = '',
  location = '', deadline = '', eligibility = '', eoi_link = '', apply_link = '',
  tracker_link = '', description = '', notes = '', expected_hires = null,
  process_date = '', process_mode = '', tracks = [], prize = '', team_size = '',
  spoc = '', status = 'open',
}) {
  return {
    title, type, subtype, via, organization, applicability,
    roles, stipend, ctc, duration, location, deadline, eligibility,
    eoi_link, apply_link, tracker_link, description, notes,
    expected_hires, process_date, process_mode, tracks, prize, team_size, spoc,
    status, currentRound: 0,
    postedBy: POSTED_BY,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}

// ── Production already has these — skip on production run ────────────────────
// "Pre Placement Talk - Morgan Stanley" already exists in production (posted 16 Jul)
// "Invictas 2026" (TAS Case Comp) already exists in production
// We do NOT re-upload those to production.

const ALL_OPPS = [

  // ── Morgan Stanley — SIP Hiring ───────────────────────────────────────────
  opp({
    title:        'Morgan Stanley | IBD GC Summer Internship',
    organization: 'Morgan Stanley',
    type:         'Hiring',
    via:          'Direct',
    roles:        ['Investment Banking Division GC (IBD GC)'],
    location:     'International',
    apply_link:   'https://morganstanley.tal.net/vx/spa-1/candidate/post/8862/en-GB',
    eoi_link:     'https://forms.gle/gggQmwxAfXYTUuXf6',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1tHk4Wdo02T_cFLgF9BT1a5OrKsoq6bd6mhfVLLjvwnU/edit?usp=sharing',
    description:  'Morgan Stanley IBD GC Summer Internship. Buddy call process followed by interviews.',
    notes:        'IB only. CV must be IMCC-verified before applying. Buddy call shortlist shared 21 Jul 2026.',
    status:       'shortlisted',
    skipOnProd:   false,
  }),

  // ── Godrej Properties — SIP Hiring ────────────────────────────────────────
  opp({
    title:        'Godrej Properties | Sales & Marketing / P&L Summer Internship',
    organization: 'Godrej Properties',
    type:         'Hiring',
    via:          'Direct',
    roles:        ['Sales & Marketing', 'P&L'],
    eoi_link:     'https://docs.google.com/forms/d/e/1FAIpQLSdQWnPrPgz_S2QS4dkA_iD_NF5ns4MZfGSUQdvOa495ChXiVA/viewform',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1FyV33HES4ov8698Sk1TQd3scdrYv3CiT9d0P7xg0HKw/edit?gid=0#gid=0',
    description:  'Godrej Properties (GPL) Summer Internship. Application, Gurukul verification, personality assessment, final shortlist.',
    notes:        'IB only. Final shortlist (S&M + P&L) released 26–27 Jul 2026.',
    status:       'shortlisted',
  }),

  // ── Godrej Properties — Space Program ─────────────────────────────────────
  opp({
    title:        'Godrej Properties | Space Program Case Competition',
    organization: 'Godrej Properties',
    type:         'Case Comp',
    tracks:       ['Real Estate', 'Strategy'],
    team_size:    '4-5 members',
    description:  'Godrej Space Program case competition. Teams of 4–5. Presentation round held on campus 16 Jul 2026.',
    notes:        'IB only. B-school name: Indian Institute of Foreign Trade, Delhi (IIFTD). PPI opportunity mentioned.',
    status:       'closed',
  }),

  // ── Godrej Consumer Products — Craft Lab ──────────────────────────────────
  opp({
    title:        'Godrej Consumer Products | Craft Lab Summer Internship',
    organization: 'Godrej Consumer Products',
    type:         'Hiring',
    via:          'Direct',
    roles:        ['Craft Lab'],
    eoi_link:     'https://insidekampus.com/gcplcraftlab',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1JnW7tT3dEGvYXrDtTJ6WyhxI3GKoVgFJJmfrYSI5jIE/edit?gid=0#gid=0',
    description:  'GCPL Craft Lab Summer Internship (Gurukul process). Video submission, simulation, psychometric test, personality questionnaire.',
    notes:        'IB only. Final shortlist released 26 Jul 2026.',
    status:       'shortlisted',
  }),

  // ── TAS — SIP Hiring ──────────────────────────────────────────────────────
  // NOTE: "Invictas 2026" (TAS Case Comp) already exists in production.
  // This is a DIFFERENT entry — the SIP hiring process, not the case comp.
  opp({
    title:        'Tata Administrative Services | TAS Summer Internship',
    organization: 'Tata Administrative Services',
    type:         'Hiring',
    via:          'Direct',
    roles:        ['Tata Administrative Services (TAS)'],
    apply_link:   'https://tas.tata.com/EForms/configuredHtml/32728/85401/application.html',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1BzkodwRnVT01aeQw8YkN-EYnj0CHy5Fkc5HcEdDjXHs/edit?usp=drivesdk',
    description:  'TAS Summer Internship hiring process. 4-section application form. R1: gamified assessment. Shortlist released 10 Aug 2026.',
    notes:        'IB only. Must use d28 email ID. Gamified assessment deadline 6 Aug 2026.',
    status:       'shortlisted',
  }),

  // ── Titan & CaratLane ─────────────────────────────────────────────────────
  opp({
    title:        'Titan & CaratLane | Summer Internship',
    organization: 'Titan & CaratLane',
    type:         'Hiring',
    via:          'Direct',
    eligibility:  '10th ≥ 60%, 12th ≥ 60%, UG ≥ 60% or 6.5 CGPA, Work experience 0–36 months',
    eoi_link:     'https://forms.gle/7Y4KrjvfWvSG4spG7',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1uR2WpjR2YBO8aHpXho6FBwPLgQESlnRe7h-d9Ugl9GI/edit?usp=sharing',
    description:  'Titan and CaratLane Summer Internship. Assessment + shortlist process.',
    notes:        'IB only. Mandatory for all yet-to-be-placed fulfilling criteria. Shortlist released 20 Aug 2026.',
    status:       'shortlisted',
  }),

  // ── Snabbit ───────────────────────────────────────────────────────────────
  opp({
    title:        'Snabbit | Summer Internship',
    organization: 'Snabbit',
    type:         'Hiring',
    via:          'Direct',
    eoi_link:     'https://forms.gle/FFhdu9hBVi6JKZoG7',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1mm5V0_8NuD5YRcNidjd2JE1M91KcwsVLEgv6p_encuQ/edit?gid=0#gid=0',
    deadline:     '2026-08-19',
    description:  'Snabbit Summer Internship. Mandatory for all yet-to-be-placed students.',
    notes:        'IB only.',
    status:       'open',
  }),

  // ── Deloitte USI ─────────────────────────────────────────────────────────
  opp({
    title:        'Deloitte USI | Summer Internship',
    organization: 'Deloitte USI',
    type:         'Hiring',
    via:          'Direct',
    roles:        ['Consulting', 'Strategy', 'Technology', 'Risk', 'Finance'],
    process_mode: 'Online',
    description:  'Deloitte USI Summer Internship. PPT 19 Aug 2026. R1 shortlist released 20 Aug 2026, extended shortlist 21 Aug 2026.',
    notes:        'IB only. Extremely sensitive opportunity — selective Tier-1 B-school association.',
    status:       'shortlisted',
  }),

  // ── Marico — Case Competition ─────────────────────────────────────────────
  opp({
    title:        'Marico | Over the Wall Season 14',
    organization: 'Marico',
    type:         'Case Comp',
    tracks:       ['Marketing', 'Strategy'],
    description:  'Marico Over the Wall Season 14 case competition. Live launch session 31 Jul 2026.',
    notes:        'IB only. Join individually via mobile. Comment #IIFTDelhi.',
    status:       'open',
  }),

  // ── Morgan Stanley PPT ────────────────────────────────────────────────────
  // Already exists in production as "Pre Placement Talk - Morgan Stanley" (16 Jul)
  // We upload to staging only; skip on production.
  opp({
    title:        'Morgan Stanley | Pre-Placement Talk',
    organization: 'Morgan Stanley',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    process_mode: 'Online',
    process_date: '2026-07-15',
    description:  'Morgan Stanley PPT via Zoom. IBD GC opportunities, career advancement, live Q&A.',
    notes:        'IB only. Zoom ID: 94135940584. Naming: Full Name_roll no_IB_28.',
    status:       'closed',
    skipOnProd:   true, // Already exists in production
  }),

  // ── Godrej Properties GL ──────────────────────────────────────────────────
  opp({
    title:        'Godrej Properties | Guest Lecture',
    organization: 'Godrej Properties',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    process_date: '2026-07-16',
    process_mode: 'Offline',
    description:  'Godrej Properties campus guest lecture. Sections B & C mandatory. Full formals. Auditorium.',
    notes:        'IB only.',
    status:       'closed',
  }),

  // ── Godrej Consumer Products GL ──────────────────────────────────────────
  opp({
    title:        'Godrej Consumer Products | Guest Lecture',
    organization: 'Godrej Consumer Products',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    process_date: '2026-07-17',
    process_mode: 'Offline',
    description:  'GCPL guest lecture with global HR Head. Section D mandatory; B (15), C (25). Full formals. Auditorium.',
    notes:        'IB only.',
    status:       'closed',
  }),

  // ── PepsiCo ───────────────────────────────────────────────────────────────
  opp({
    title:        'PepsiCo | Leadership Session',
    organization: 'PepsiCo',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    process_date: '2026-08-10',
    process_mode: 'Offline',
    description:  'PepsiCo senior alum session for sections C & D (9 AM). Key deciding factor for whether PepsiCo visits for summers.',
    notes:        'IB only. Smart casuals. NCH. No phones.',
    status:       'closed',
  }),

  // ── Deloitte USI PPT ─────────────────────────────────────────────────────
  opp({
    title:        'Deloitte USI | Pre-Placement Talk',
    organization: 'Deloitte USI',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    process_date: '2026-08-19',
    process_mode: 'Online',
    description:  'Deloitte USI PPT via Zoom. All business verticals. Full formals. Highly sensitive opportunity.',
    notes:        'IB only. Zoom link shared. Passcode: 505897.',
    status:       'closed',
  }),

]

async function deleteAll() {
  const snap = await db.collection('opportunities').get()
  if (snap.empty) { console.log('Nothing to delete.'); return }
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  console.log(`Deleted ${snap.docs.length} existing docs.\n`)
}

async function upload() {
  const oppsToUpload = ALL_OPPS.filter(o => !isProd || !o.skipOnProd)

  console.log(`Uploading ${oppsToUpload.length} opportunities...\n`)
  for (const data of oppsToUpload) {
    const { skipOnProd, ...docData } = data
    const ref = db.collection('opportunities').doc()
    await ref.set(docData)
    await ref.collection('stages').add({
      type: 'opportunity',
      message: "[Seeded from IB Bulletin BO'28 WhatsApp chat]",
      createdAt: Timestamp.now(),
      createdBy: POSTED_BY,
    })
    if (docData.status === 'shortlisted') {
      await ref.collection('stages').add({
        type: 'shortlist',
        message: '',
        createdAt: Timestamp.now(),
        createdBy: POSTED_BY,
      })
    }
    console.log(`✓ [${docData.type}] ${docData.organization} — ${docData.title}`)
  }
  console.log(`\n✅ Done. ${oppsToUpload.length} uploaded to ${PROJECT_ID}.`)
}

async function run() {
  await deleteAll()
  await upload()
}

run().catch(e => { console.error(e); process.exit(1) })
