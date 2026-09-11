/**
 * Seed script: uploads IB Batch of '28 opportunities from WhatsApp bulletin to Firestore.
 * Targets STAGING by default. Pass --production to target production.
 *
 * Run: node scripts/seed_opportunities.mjs [--production]
 * Requires: firebase-admin (already in package.json), Firebase CLI auth (you're already logged in)
 */

import { initializeApp, cert, getApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// ── Target project ────────────────────────────────────────────────────────────
const isProd = process.argv.includes('--production')
const PROJECT_ID = isProd ? 'placement-management-6133f' : 'placement-mgmt-staging'
console.log(`\nTarget: ${isProd ? '🔴 PRODUCTION' : '🟡 STAGING'} (${PROJECT_ID})\n`)

// ── Init firebase-admin using Application Default Credentials ─────────────────
initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

// ── Posted-by identity (you as master admin) ──────────────────────────────────
const POSTED_BY = {
  uid:   'divyaanshmehta513@gmail.com',
  name:  'Divyaansh Mehta',
  email: 'divyaanshmehta513@gmail.com',
}

// ── Helper to build a Firestore opportunity doc ───────────────────────────────
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

// ── All opportunities from the IB Bulletin BO'28 ────────────────────────────
// Source: WhatsApp chat 12 Jul – 21 Aug 2026
// All are Summer (applicability: 'summer') per user instruction.
// IB-only opps are noted in description/notes.

const OPPORTUNITIES = [

  // ── Morgan Stanley ─────────────────────────────────────────────────────────
  opp({
    title:        'Investment Banking Division GC (IBD GC) | Summer Internship',
    organization: 'Morgan Stanley',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Investment Banking Division GC (IBD GC)'],
    location:     'International',
    apply_link:   'https://morganstanley.tal.net/vx/spa-1/candidate/post/8862/en-GB',
    eoi_link:     'https://forms.gle/gggQmwxAfXYTUuXf6',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1tHk4Wdo02T_cFLgF9BT1a5OrKsoq6bd6mhfVLLjvwnU/edit?usp=sharing',
    description:  'Morgan Stanley IBD GC Summer Internship for IIFT Delhi. Buddy call process followed by interviews.',
    notes:        'IB only. CV must be IMCC-verified before applying. Buddy call shortlist shared 21 Jul 2026.',
    status:       'shortlisted',
  }),

  // ── Godrej Properties ──────────────────────────────────────────────────────
  opp({
    title:        'Sales & Marketing / P&L | Summer Internship',
    organization: 'Godrej Properties',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Sales & Marketing', 'P&L'],
    eoi_link:     'https://docs.google.com/forms/d/e/1FAIpQLSdQWnPrPgz_S2QS4dkA_iD_NF5ns4MZfGSUQdvOa495ChXiVA/viewform',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1FyV33HES4ov8698Sk1TQd3scdrYv3CiT9d0P7xg0HKw/edit?gid=0#gid=0',
    description:  'Godrej Properties (GPL) Summer Internship. Multi-stage process: application, Gurukul verification, personality assessment, final shortlist.',
    notes:        'IB only. Final shortlist (S&M + P&L) released 26–27 Jul 2026.',
    status:       'shortlisted',
  }),

  // ── Godrej Properties — Space Program (Case Comp) ─────────────────────────
  opp({
    title:        'Space Program | Case Competition',
    organization: 'Godrej Properties',
    type:         'Case Comp',
    applicability:'summer',
    tracks:       ['Real Estate', 'Strategy'],
    team_size:    '4-5 members',
    description:  'Godrej Space Program case competition. Teams of 4–5. Presentation round held on campus 16 Jul 2026.',
    notes:        'IB only. B-school name: Indian Institute of Foreign Trade, Delhi (IIFTD). PPI opportunity mentioned.',
    status:       'closed',
  }),

  // ── Godrej Consumer Products ───────────────────────────────────────────────
  opp({
    title:        'Craft Lab | Summer Internship',
    organization: 'Godrej Consumer Products',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Craft Lab'],
    eoi_link:     'https://insidekampus.com/gcplcraftlab',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1JnW7tT3dEGvYXrDtTJ6WyhxI3GKoVgFJJmfrYSI5jIE/edit?gid=0#gid=0',
    description:  'Godrej Consumer Products Craft Lab Summer Internship (Gurukul process). Video submission, simulation round, psychometric test, personality questionnaire.',
    notes:        'IB only. Final shortlist released 26 Jul 2026.',
    status:       'shortlisted',
  }),

  // ── Tata Administrative Services ──────────────────────────────────────────
  opp({
    title:        'Tata Administrative Services (TAS) | Summer Internship',
    organization: 'Tata Administrative Services',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Tata Administrative Services (TAS)'],
    apply_link:   'https://tas.tata.com/EForms/configuredHtml/32728/85401/application.html',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1BzkodwRnVT01aeQw8YkN-EYnj0CHy5Fkc5HcEdDjXHs/edit?usp=drivesdk',
    description:  'TAS Summer Internship. 4-section application form. R1: gamified assessment. Shortlist released 10 Aug 2026.',
    notes:        'IB only. Must use d28 email ID. Gamified assessment deadline 6 Aug 2026.',
    status:       'shortlisted',
  }),

  // ── Titan & CaratLane ─────────────────────────────────────────────────────
  opp({
    title:        'Summer Internship',
    organization: 'Titan & CaratLane',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        [],
    eligibility:  '10th ≥ 60%, 12th ≥ 60%, UG ≥ 60% or 6.5 CGPA, Work experience 0–36 months',
    eoi_link:     'https://forms.gle/7Y4KrjvfWvSG4spG7',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1uR2WpjR2YBO8aHpXho6FBwPLgQESlnRe7h-d9Ugl9GI/edit?usp=sharing',
    description:  'Titan and CaratLane Summer Internship. Assessment + shortlist process.',
    notes:        'IB only. Mandatory for all yet-to-be-placed fulfilling criteria. Shortlist released 20 Aug 2026.',
    status:       'shortlisted',
  }),

  // ── Snabbit ───────────────────────────────────────────────────────────────
  opp({
    title:        'Summer Internship',
    organization: 'Snabbit',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        [],
    eoi_link:     'https://forms.gle/FFhdu9hBVi6JKZoG7',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1mm5V0_8NuD5YRcNidjd2JE1M91KcwsVLEgv6p_encuQ/edit?gid=0#gid=0',
    deadline:     '2026-08-19',
    description:  'Snabbit Summer Internship. Mandatory for all yet-to-be-placed students.',
    notes:        'IB only.',
    status:       'open',
  }),

  // ── Deloitte USI ─────────────────────────────────────────────────────────
  opp({
    title:        'Summer Internship',
    organization: 'Deloitte USI',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Consulting', 'Strategy', 'Technology', 'Risk', 'Finance'],
    process_mode: 'Online',
    description:  'Deloitte USI Summer Internship. PPT 19 Aug 2026. R1 shortlist released 20 Aug 2026, extended shortlist 21 Aug 2026.',
    notes:        'IB only. Extremely sensitive opportunity — selective Tier-1 B-school association.',
    status:       'shortlisted',
  }),

  // ── Marico — Case Competition ─────────────────────────────────────────────
  opp({
    title:        'Marico Over the Wall Season 14',
    organization: 'Marico',
    type:         'Case Comp',
    applicability:'summer',
    tracks:       ['Marketing', 'Strategy'],
    description:  'Marico Over the Wall Season 14 case competition. Live launch session 31 Jul 2026.',
    notes:        'IB only. Join individually via mobile. Comment #IIFTDelhi.',
    status:       'open',
  }),

  // ── Morgan Stanley PPT ────────────────────────────────────────────────────
  opp({
    title:        'Pre-Placement Talk',
    organization: 'Morgan Stanley',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_mode: 'Online',
    process_date: '2026-07-15',
    description:  'Morgan Stanley PPT via Zoom. Covered IBD GC opportunities, career advancement, live Q&A.',
    notes:        'IB only. Zoom ID: 94135940584. Use d28 ID, naming: Full Name_roll no_IB_28.',
    status:       'closed',
  }),

  // ── Godrej Properties GL ──────────────────────────────────────────────────
  opp({
    title:        'Guest Lecture',
    organization: 'Godrej Properties',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-07-16',
    process_mode: 'Offline',
    description:  'Godrej Properties campus guest lecture. Sections B & C mandatory. Full formals. Auditorium.',
    notes:        'IB only.',
    status:       'closed',
  }),

  // ── Godrej Consumer Products GL ──────────────────────────────────────────
  opp({
    title:        'Guest Lecture',
    organization: 'Godrej Consumer Products',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-07-17',
    process_mode: 'Offline',
    description:  'GCPL guest lecture with global HR Head. Section D mandatory; B (15), C (25). Full formals. Auditorium.',
    notes:        'IB only.',
    status:       'closed',
  }),

  // ── PepsiCo ───────────────────────────────────────────────────────────────
  opp({
    title:        'Leadership Session (Pre-gauging for campus visit)',
    organization: 'PepsiCo',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-10',
    process_mode: 'Offline',
    description:  'PepsiCo senior alum session for sections C & D during Consumer Behaviour class slot (9 AM). Key deciding factor for whether PepsiCo visits for summers.',
    notes:        'IB only. Smart casuals. NCH. No phones, no dozing off.',
    status:       'closed',
  }),

  // ── Deloitte USI PPT ─────────────────────────────────────────────────────
  opp({
    title:        'Pre-Placement Talk',
    organization: 'Deloitte USI',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-08-19',
    process_mode: 'Online',
    description:  'Deloitte USI PPT via Zoom. Covers all business verticals. Full formals. Highly sensitive opportunity.',
    notes:        'IB only. Zoom link shared. Passcode: 505897.',
    status:       'closed',
  }),

]

// ── Upload ────────────────────────────────────────────────────────────────────

async function checkExisting() {
  const snap = await db.collection('opportunities').get()
  if (snap.empty) {
    console.log('No existing opportunities found — clean slate.\n')
    return []
  }
  const existing = snap.docs.map(d => ({
    id: d.id,
    org: d.data().organization,
    title: d.data().title,
    type: d.data().type,
  }))
  console.log(`Existing opportunities (${existing.length}):`)
  existing.forEach(o => console.log(`  [${o.id}] ${o.org} — ${o.title} (${o.type})`))
  console.log()
  return existing
}

async function upload() {
  const existing = await checkExisting()

  if (existing.length > 0) {
    console.log('⚠️  Existing opportunities found. To avoid duplicates, this script will skip upload.')
    console.log('   Delete existing docs first, or run with --force to overwrite.\n')
    if (!process.argv.includes('--force')) {
      process.exit(0)
    }
  }

  console.log(`Uploading ${OPPORTUNITIES.length} opportunities...\n`)

  for (const data of OPPORTUNITIES) {
    const ref = db.collection('opportunities').doc()

    // Initial stage record
    const stageMsg = `[Seeded from IB Bulletin BO'28 WhatsApp chat]`

    await ref.set(data)
    await ref.collection('stages').add({
      type: 'opportunity',
      message: stageMsg,
      createdAt: Timestamp.now(),
      createdBy: POSTED_BY,
    })

    // If shortlisted, add a shortlist stage too
    if (data.status === 'shortlisted') {
      await ref.collection('stages').add({
        type: 'shortlist',
        message: '',
        createdAt: Timestamp.now(),
        createdBy: POSTED_BY,
      })
      await ref.update({ status: 'shortlisted', updatedAt: Timestamp.now() })
    }

    // If closed, add a closed stage
    if (data.status === 'closed') {
      await ref.update({ status: 'closed', updatedAt: Timestamp.now() })
    }

    console.log(`✓ [${data.type}] ${data.organization} — ${data.title}`)
  }

  console.log(`\n✅ Done. ${OPPORTUNITIES.length} opportunities uploaded to ${PROJECT_ID}.`)
  console.log('\nNext steps:')
  console.log('  1. Go to the Activity page and verify all entries look correct.')
  console.log('  2. Manually mark placed students for Morgan Stanley, GCPL, GPL, TAS, Titan/CaratLane.')
  console.log('  3. The "IB only" note is in each record\'s notes field — searchable in the app.')
}

upload().catch(e => { console.error(e); process.exit(1) })
